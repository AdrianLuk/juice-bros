"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { SETTINGS_PATH } from "../routes.ts";
import type { ActionResult } from "./result.ts";

export type { ActionResult } from "./result.ts";

export type PushSubscriptionKeys = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Called directly from client code (not a `<form action>`) — a browser push
 * subscription comes back from `PushManager.subscribe()`, not a form submit,
 * so this takes a plain object rather than `FormData`.
 *
 * Upserts on `endpoint` (issue #12's device-level table, see the migration):
 * re-subscribing on the same browser replaces its row rather than
 * duplicating it. Also flips `notification_preferences.push_enabled` on —
 * subscribing *is* opting in, the two aren't separate steps a User has to
 * take.
 */
export async function savePushSubscription(
  subscription: PushSubscriptionKeys,
): Promise<ActionResult> {
  const session = await verifySession();
  const supabase = await createClient();

  const { error: subscriptionError } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: session.userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
    { onConflict: "endpoint" },
  );
  if (subscriptionError) {
    return { error: "Couldn't turn on push notifications. Try again." };
  }

  const { error: preferenceError } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: session.userId, push_enabled: true }, { onConflict: "user_id" });
  if (preferenceError) {
    return { error: "Couldn't turn on push notifications. Try again." };
  }

  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}

/**
 * Removes one device's subscription (called after the client's own
 * `PushSubscription.unsubscribe()`). Only flips `push_enabled` back off once
 * it was the User's *last* device — someone who disables push on their phone
 * but still has it on their laptop is still opted in overall.
 */
export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  const session = await verifySession();
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", session.userId)
    .eq("endpoint", endpoint);
  if (deleteError) {
    return { error: "Couldn't turn off push notifications. Try again." };
  }

  const { count, error: countError } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.userId);
  if (countError) {
    return { error: "Couldn't turn off push notifications. Try again." };
  }

  if (!count) {
    const { error: preferenceError } = await supabase
      .from("notification_preferences")
      .upsert({ user_id: session.userId, push_enabled: false }, { onConflict: "user_id" });
    if (preferenceError) {
      return { error: "Couldn't turn off push notifications. Try again." };
    }
  }

  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}

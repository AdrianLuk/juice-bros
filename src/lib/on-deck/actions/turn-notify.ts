"use server";

import { createClient } from "../supabase/server.ts";

/**
 * The Player's opt-in for the turn notification (issue #260) — mirrors Booking
 * Buddy's `savePushSubscription` / `removePushSubscription`, but with a device
 * token instead of an account (ADR 0001) and scoped to one Session.
 *
 * Called directly from client code (not a `<form action>`): a browser push
 * subscription comes back from `PushManager.subscribe()`, not a form submit.
 *
 * Every failure is a soft one — the control fails silent (issue #260's
 * acceptance criteria), so these return a plain `{ ok }` the client uses only
 * to decide whether to show the "on" state.
 */

export type TurnNotifyResult = { ok: boolean };

export type TurnPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Turn the notification on for this device. Goes through
 * `on_deck_subscribe_turn_notification` — `anon`-callable, roster-gated,
 * open-Session-gated, idempotent on the endpoint.
 */
export async function subscribeTurnNotifications(
  sessionId: string,
  token: string,
  subscription: TurnPushSubscription,
): Promise<TurnNotifyResult> {
  const trimmed = token?.trim() ?? "";
  if (trimmed.length < 8) {
    return { ok: false };
  }
  if (!subscription.endpoint || !subscription.p256dh || !subscription.auth) {
    return { ok: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("on_deck_subscribe_turn_notification", {
    p_session_id: sessionId,
    p_token: trimmed,
    p_endpoint: subscription.endpoint,
    p_p256dh: subscription.p256dh,
    p_auth: subscription.auth,
  });

  if (error) {
    console.error("on-deck: subscribing to turn notifications failed", error);
    return { ok: false };
  }
  return { ok: true };
}

/**
 * Turn it off for this device (after the browser's own `unsubscribe()`).
 * Keyed by the endpoint alone — the endpoint is the browser's own secret.
 */
export async function unsubscribeTurnNotifications(
  endpoint: string,
): Promise<TurnNotifyResult> {
  if (!endpoint) {
    return { ok: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("on_deck_unsubscribe_turn_notification", {
    p_endpoint: endpoint,
  });

  if (error) {
    console.error("on-deck: unsubscribing from turn notifications failed", error);
    return { ok: false };
  }
  return { ok: true };
}

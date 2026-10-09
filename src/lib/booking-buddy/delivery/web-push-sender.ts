import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

import { readVapidEnv, type VapidEnv } from "../env.ts";
import type { PushSender } from "./deliver.ts";
import { pushResultForError } from "./push-error.ts";
import { pruneSubscription } from "./supabase-adapters.ts";

/**
 * `deliver`'s push port over web-push. The VAPID details go with each request
 * rather than through `webpush.setVapidDetails`, so nothing global is set.
 * What a throw means (`gone` for 404/410) is `pushResultForError`.
 */
function webPushSender(env: VapidEnv, forget: (subscriptionId: string) => Promise<void>): PushSender {
  const vapidDetails = { subject: env.subject, publicKey: env.publicKey, privateKey: env.privateKey };
  return {
    async send(subscription, payload) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
          { vapidDetails },
        );
        return { status: "ok" };
      } catch (error) {
        return pushResultForError(error);
      }
    },
    forget,
  };
}

/**
 * The push port from the VAPID env vars, pruning gone subscriptions through the
 * caller's admin client, or `null` (`deliver` then skips push) when any is unset.
 */
export function pushSenderFromEnv(supabase: SupabaseClient): PushSender | null {
  const env = readVapidEnv();
  return env
    ? webPushSender(env, (subscriptionId) => pruneSubscription(supabase, subscriptionId))
    : null;
}

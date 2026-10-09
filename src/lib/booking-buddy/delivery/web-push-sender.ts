import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";

import { readVapidEnv, type VapidEnv } from "../env.ts";
import type { PushSender } from "./deliver.ts";
import { pruneSubscription } from "./supabase-adapters.ts";

/**
 * `deliver`'s push port over web-push. The VAPID details go with each request
 * rather than through `webpush.setVapidDetails`, so nothing global is set.
 * A 404 or 410 means the push service has dropped the device: `gone`, and
 * `deliver` hands it to `forget`.
 */
export function webPushSender(
  env: VapidEnv,
  forget: (deviceId: string) => Promise<void>,
): PushSender {
  const vapidDetails = { subject: env.subject, publicKey: env.publicKey, privateKey: env.privateKey };
  return {
    async send(device, payload) {
      try {
        await webpush.sendNotification(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          JSON.stringify(payload),
          { vapidDetails },
        );
        return { status: "ok" };
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        return statusCode === 404 || statusCode === 410
          ? { status: "gone" }
          : { status: "error", error };
      }
    },
    forget,
  };
}

/**
 * The push port from the VAPID env vars, pruning gone devices through the
 * caller's admin client, or `null` (`deliver` then skips push) when any is unset.
 */
export function pushSenderFromEnv(supabase: SupabaseClient): PushSender | null {
  const env = readVapidEnv();
  return env ? webPushSender(env, (deviceId) => pruneSubscription(supabase, deviceId)) : null;
}

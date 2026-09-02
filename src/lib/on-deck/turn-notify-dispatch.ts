import "server-only";

import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "./supabase/admin.ts";
import { getSession } from "./sessions.ts";
import { sessionPath } from "./routes.ts";
import { onDeckAbsoluteUrl } from "./request-origin.ts";
import { readWebPushEnv } from "./env.ts";
import {
  planTurnNotificationRun,
  type StoredTurnSubscription,
} from "./turn-notify-run.ts";
import type { SessionState } from "./session/types.ts";

/**
 * The I/O half of the opt-in turn notification (issue #260) — the send job
 * `booking-buddy/send-reminders/route.ts` is for the cron path, except On Deck
 * has no cron: this runs inline, right after an operational event is appended,
 * inside the Server Action that appended it.
 *
 * `dispatchTurnNotifications` takes the folded `SessionState` from *before* the
 * write, re-loads the Session to get the state *after*, and lets
 * `planTurnNotificationRun` (unit tested) decide the sends. This module does
 * only the effects: the `service_role` reads of every opted-in subscription,
 * the `web-push` calls, pruning a dead subscription, and the idempotency-log
 * writes.
 *
 * **It never throws.** A turn notification is a courtesy on top of the Display
 * and Kiosk (CONTEXT.md's On Deck entry); a push-service hiccup, a missing
 * VAPID key, or a transient DB error must not fail the "Court N done" tap that
 * triggered it. Every failure is swallowed with a `console.error`.
 */
export async function dispatchTurnNotifications(
  beforeState: SessionState,
  sessionId: string,
): Promise<void> {
  try {
    const webPushEnv = readWebPushEnv();
    if (!webPushEnv) {
      // No VAPID keys on this deploy — the feature stays off, silently.
      return;
    }

    const admin = createAdminClient();

    // Cheapest gate first: nobody opted in for this Session means nothing to
    // do — skip the re-fold entirely (this runs inline on every floor op).
    const { data: subscriptionRows, error: subscriptionsError } = await admin
      .from("on_deck_push_subscriptions")
      .select("id, player_token, endpoint, p256dh, auth")
      .eq("session_id", sessionId);
    if (subscriptionsError) {
      console.error(
        "on-deck: reading turn-notification subscriptions failed",
        subscriptionsError,
      );
      return;
    }
    if (!subscriptionRows || subscriptionRows.length === 0) {
      return;
    }

    // The state *after* the write — re-fold through the same loader every
    // surface uses.
    const loaded = await getSession(admin, sessionId).catch(() => null);
    if (!loaded || loaded.status !== "open") {
      return;
    }

    const subscriptionsByPlayer = new Map<string, StoredTurnSubscription[]>();
    for (const row of subscriptionRows) {
      const list = subscriptionsByPlayer.get(row.player_token) ?? [];
      list.push({
        id: row.id,
        endpoint: row.endpoint,
        p256dh: row.p256dh,
        auth: row.auth,
      });
      subscriptionsByPlayer.set(row.player_token, list);
    }

    const { data: sentRows, error: sentError } = await admin
      .from("on_deck_turn_notification_sends")
      .select("player_token, transition")
      .eq("session_id", sessionId);
    if (sentError) {
      console.error(
        "on-deck: reading the turn-notification send log failed",
        sentError,
      );
      return;
    }
    const alreadySent = new Set(
      (sentRows ?? []).map(
        (row) => `${sessionId}:${row.player_token}:${row.transition}`,
      ),
    );
    // `transition` holds the per-turn key (`court:5:1699…`), not just the
    // coarse kind — a Player is buzzed for every Game's turn, not only the
    // first (see `TurnTransition.turnKey`).

    const { sends } = planTurnNotificationRun({
      before: beforeState,
      after: loaded.state,
      venueName: loaded.config.venueName,
      sessionUrl: await onDeckAbsoluteUrl(sessionPath(sessionId)),
      subscriptionsByPlayer,
      alreadySent,
      sessionId,
      pushConfigured: true,
    });
    if (sends.length === 0) {
      return;
    }

    webpush.setVapidDetails(
      webPushEnv.subject,
      webPushEnv.publicKey,
      webPushEnv.privateKey,
    );

    for (const send of sends) {
      let anySucceeded = false;
      for (const subscription of send.subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            JSON.stringify(send.payload),
          );
          anySucceeded = true;
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // The push service says this registration is gone — prune it so
            // future dispatches stop retrying a dead device (standard
            // web-push practice, same as the Booking Buddy send job).
            await pruneSubscription(admin, subscription.id);
          } else {
            console.error("on-deck: turn-notification web-push error", error);
          }
        }
      }

      if (anySucceeded) {
        // Best-effort — the push is already out; a duplicate row (a race with
        // another dispatch) trips the table's unique constraint and is not a
        // failure worth surfacing.
        const { error: logError } = await admin
          .from("on_deck_turn_notification_sends")
          .insert({
            session_id: sessionId,
            player_token: send.playerToken,
            transition: send.turnKey,
          });
        if (logError && logError.code !== "23505") {
          console.error(
            "on-deck: logging a turn-notification send failed",
            logError,
          );
        }
      }
    }
  } catch (error) {
    console.error("on-deck: dispatching turn notifications failed", error);
  }
}

async function pruneSubscription(
  admin: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await admin
    .from("on_deck_push_subscriptions")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("on-deck: pruning a dead turn-notification subscription failed", error);
  }
}

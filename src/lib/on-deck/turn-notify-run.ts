/**
 * The opt-in turn notification (issue #260), plan half — what one dispatch
 * should actually push, lifted out of the Server Action that triggers it the
 * way `booking-buddy/reminder-run.ts` is lifted out of its cron route.
 *
 * On Deck has no cron: a turn notification is decided and sent inline, right
 * after an operational event is appended (a `COURT_FINISHED`, a Player queuing,
 * a no-show swap — anything that can move a Foursome On Deck or onto a Court).
 * The Server Action folds the Session before and after its write, hands both
 * states here, and this returns a flat list of pushes to attempt.
 *
 * Free of Next.js and Supabase imports on purpose — the caller does the
 * `service_role` reads (every opted-in subscription for the Session), the
 * web-push calls, and pruning a dead subscription. Everything decidable from
 * plain data is here and unit tested.
 *
 * The acceptance criteria this encodes:
 *
 *   - **Only opted-in Players.** A `StoredTurnSubscription` exists only for a
 *     Player who tapped enable; a Player with none gets nothing.
 *   - **One buzz per step.** `alreadySent` carries the
 *     `sessionId:playerToken:kind` keys already in
 *     `on_deck_turn_notification_sends`; a re-fold or a replay of the same
 *     transition produces no send.
 *   - **Never a broadcast.** Every send targets one Player's own device
 *     subscriptions; there is no all-Players path.
 *   - **Degrades silently.** `pushConfigured` false (no VAPID keys on the
 *     deploy) yields an empty plan — the feature just stays off.
 */

import { turnTransitions, formatTurnPush } from "./session/turn-notify.ts";
import type { SessionState } from "./session/types.ts";

/** One `on_deck_push_subscriptions` row — `id` rides along for the caller's 404/410 prune. */
export type StoredTurnSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** One push to attempt: every device the Player has registered, and the payload. */
export type TurnPushSend = {
  playerToken: string;
  /** `on-deck` or `court` — the coarse step, for the push copy. */
  kind: "on-deck" | "court";
  /**
   * The per-turn idempotency key, written to
   * `on_deck_turn_notification_sends.transition`. Distinct per Game so a Player
   * is buzzed for every turn across a multi-hour Session, not just their first.
   */
  turnKey: string;
  subscriptions: StoredTurnSubscription[];
  payload: ReturnType<typeof formatTurnPush>;
};

export type PlanTurnNotificationRunInput = {
  before: SessionState;
  after: SessionState;
  /** The venue name for the push body — off the Session config. */
  venueName: string;
  /** Absolute URL of the Player-facing Session view; a notification tap opens it. */
  sessionUrl: string;
  /** Every opted-in Player's device subscriptions, keyed by device token. */
  subscriptionsByPlayer: ReadonlyMap<string, StoredTurnSubscription[]>;
  /** `sessionId:playerToken:turnKey` keys already recorded in `on_deck_turn_notification_sends`. */
  alreadySent: ReadonlySet<string>;
  /** The Session id — for building the `alreadySent` keys. */
  sessionId: string;
  /** `false` when the deploy has no VAPID keys — the whole run is skipped. */
  pushConfigured: boolean;
};

/**
 * Every turn-notification push this dispatch should carry out. A Player
 * produces at most one send per call (a `court` transition supersedes an
 * `on-deck` one — see `turnTransitions`), and only when they opted in, have a
 * live subscription, and haven't already been sent this exact transition.
 */
export function planTurnNotificationRun(input: PlanTurnNotificationRunInput): {
  sends: TurnPushSend[];
} {
  if (!input.pushConfigured) {
    return { sends: [] };
  }

  const sends: TurnPushSend[] = [];

  for (const transition of turnTransitions(input.before, input.after)) {
    const key = `${input.sessionId}:${transition.playerId}:${transition.turnKey}`;
    if (input.alreadySent.has(key)) {
      continue;
    }

    // No subscription on file is the graceful-skip case (issue #260, "degrades
    // silently") — the Player didn't opt in, or their browser can't subscribe.
    const subscriptions = input.subscriptionsByPlayer.get(transition.playerId) ?? [];
    if (subscriptions.length === 0) {
      continue;
    }

    sends.push({
      playerToken: transition.playerId,
      kind: transition.kind,
      turnKey: transition.turnKey,
      subscriptions,
      payload: formatTurnPush({
        transition,
        venueName: input.venueName,
        sessionUrl: input.sessionUrl,
      }),
    });
  }

  return { sends };
}

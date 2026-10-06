/**
 * The Weekly Invite (issue #579, CONTEXT.md): what each Regular is sent when
 * a Standing Game posts a Slot, and who gets it on which channel.
 *
 * Same split as `reminder-run.ts`: this module decides every send from plain
 * data, and `weekly-invite-sending.ts` does the `service_role` reads, the
 * Resend / web-push calls and the `weekly_invite_sends` marker writes around
 * it. Free of Next.js and Supabase imports, relative imports only, so it runs
 * under `node --test`.
 */

import { slotPath } from "./routes.ts";
import { formatSlotWhen } from "./slots.ts";
import { renderEmailLayout } from "./email-layout.ts";
import type { ReminderSend, StoredPushSubscription } from "./reminder-run.ts";

/** One Slot a Standing Game just posted, with what its invite needs to say. */
export type PostedSlotForInvite = {
  slotId: string;
  standingGameId: string;
  ownerId: string;
  /** The organizer's display label (`personOptionLabel`). */
  organizerName: string;
  proposedStart: string;
  proposedEnd: string;
  timeZone: string;
};

/** Email and push share the Reminder's send shape, so delivery reads the same. */
export type WeeklyInviteSend = ReminderSend;

export type WeeklyInviteChannel = WeeklyInviteSend["channel"];

/** The key a sent-marker is looked up by: `slotId:userId:channel`. */
export function weeklyInviteSendKey(
  slotId: string,
  userId: string,
  channel: WeeklyInviteChannel,
): string {
  return `${slotId}:${userId}:${channel}`;
}

/** The key of one accepted Connection seen from the organizer's side: `ownerId:userId`. */
export function connectedPairKey(ownerId: string, userId: string): string {
  return `${ownerId}:${userId}`;
}

/**
 * Subject and body of one Weekly Invite email. #580 adds the Yes / No / Maybe
 * answer links here, as the layout's primary and secondary actions.
 */
export function formatWeeklyInviteEmail(params: {
  organizerName: string;
  slotWhen: string;
  slotUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Weekly game: ${params.slotWhen}`,
    html: renderEmailLayout({
      heading: `${params.organizerName} posted this week's game`,
      emphasis: params.slotWhen,
      paragraphs: [
        "You're one of the regulars for this weekly game. Let them know if you're in.",
      ],
      primaryAction: { label: "View the game", url: params.slotUrl },
      smallPrint:
        "You get this because you're a regular. Turn off weekly game invites in Booking Buddy's settings.",
    }),
  };
}

/** Title, body and target of one Weekly Invite push. */
export function formatWeeklyInvitePush(params: {
  organizerName: string;
  slotWhen: string;
  slotUrl: string;
}): { title: string; body: string; url: string } {
  return {
    title: "Booking Buddy",
    body: `${params.organizerName} posted the weekly game for ${params.slotWhen}. Are you in?`,
    url: params.slotUrl,
  };
}

export type PlanWeeklyInviteRunInput = {
  /** Slots posted in this run (creation or cron). */
  slots: readonly PostedSlotForInvite[];
  /** Each Standing Game's Regulars, by `standing_game_regulars`. */
  regularsByGame: ReadonlyMap<string, readonly string[]>;
  /**
   * `connectedPairKey(ownerId, userId)` for every accepted Connection of the
   * organizers involved. Ending a Connection already removes the Regular in
   * the database; this is the planner's own guard against a stale list.
   */
  connectedPairs: ReadonlySet<string>;
  /** `weekly_invite_enabled`; a missing entry means the default (`true`). Off stops both channels. */
  inviteEnabledByUser: ReadonlyMap<string, boolean>;
  /** `push_enabled`; a missing entry means the default (`false`). */
  pushEnabledByUser: ReadonlyMap<string, boolean>;
  /** `weeklyInviteSendKey`s already recorded in `weekly_invite_sends`. */
  alreadySent: ReadonlySet<string>;
  subscriptionsByUser: ReadonlyMap<string, StoredPushSubscription[]>;
  /** `false` when the deploy has no VAPID keys: no push for the whole run. */
  pushConfigured: boolean;
  origin: string;
};

/**
 * Every Weekly Invite to send for the Slots just posted: one email per
 * Regular with the preference on, plus a push to each with push on and a
 * device on file. Never the organizer, never someone no longer a Connection,
 * never a (Slot, User, channel) already sent.
 */
export function planWeeklyInviteRun(input: PlanWeeklyInviteRunInput): {
  sends: WeeklyInviteSend[];
} {
  const sends: WeeklyInviteSend[] = [];

  for (const slot of input.slots) {
    const slotWhen = formatSlotWhen(slot);
    const slotUrl = new URL(slotPath(slot.slotId), input.origin).toString();
    const copy = { organizerName: slot.organizerName, slotWhen, slotUrl };
    const { subject, html } = formatWeeklyInviteEmail(copy);
    const payload = formatWeeklyInvitePush(copy);

    for (const userId of input.regularsByGame.get(slot.standingGameId) ?? []) {
      if (userId === slot.ownerId) {
        continue;
      }
      if (!input.connectedPairs.has(connectedPairKey(slot.ownerId, userId))) {
        continue;
      }
      if (input.inviteEnabledByUser.get(userId) === false) {
        continue;
      }

      if (!input.alreadySent.has(weeklyInviteSendKey(slot.slotId, userId, "email"))) {
        sends.push({ channel: "email", slotId: slot.slotId, userId, subject, html });
      }

      const pushDue =
        input.pushConfigured &&
        (input.pushEnabledByUser.get(userId) ?? false) &&
        !input.alreadySent.has(weeklyInviteSendKey(slot.slotId, userId, "push"));
      const subscriptions = input.subscriptionsByUser.get(userId) ?? [];
      if (pushDue && subscriptions.length > 0) {
        sends.push({ channel: "push", slotId: slot.slotId, userId, subscriptions, payload });
      }
    }
  }

  return { sends };
}

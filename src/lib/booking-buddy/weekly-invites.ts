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

import { slotPath, weeklyInviteAnswerPath } from "./routes.ts";
import { formatSlotWhen } from "./slots.ts";
import { renderEmailLayout } from "./email-layout.ts";
import type { ReminderSend, StoredPushSubscription } from "./reminder-run.ts";
import { isResponseAnswer, type ResponseAnswer } from "./responses.ts";

const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A `weekly_invite_links` token is a uuid. Anything else is turned away
 * before it reaches Postgres, where a malformed uuid would be a cast error
 * rather than "this link isn't valid".
 */
export function isWeeklyInviteToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

/** The answer page's confirm form: the token and the chosen answer. */
export function parseWeeklyInviteAnswer(
  formData: FormData,
): { token: string; answer: ResponseAnswer } | { error: string } {
  const token = String(formData.get("token") ?? "").trim();
  if (!isWeeklyInviteToken(token)) {
    return { error: "This link isn't valid." };
  }

  const answer = formData.get("answer");
  if (!isResponseAnswer(answer)) {
    return { error: "Pick yes, no, or maybe." };
  }

  return { token, answer };
}

/**
 * Which answer the page opens with: the one the email link carried (`?a=`),
 * else the Regular's current Response, else none. Only preselects; nothing is
 * written until the Regular confirms.
 */
export function preselectedInviteAnswer(
  fromLink: string | string[] | undefined,
  current: ResponseAnswer | null,
): ResponseAnswer | null {
  const linked = Array.isArray(fromLink) ? fromLink[0] : fromLink;
  return isResponseAnswer(linked) ? linked : current;
}

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

/**
 * The key a Regular's answer token is looked up by: `slotId:userId`. One
 * `weekly_invite_links` row per (Slot, Regular), so one token per invite.
 */
export function weeklyInviteLinkKey(slotId: string, userId: string): string {
  return `${slotId}:${userId}`;
}

/** The three answer URLs one Regular's invite carries, from their own token. */
export type WeeklyInviteAnswerLinks = { yes: string; maybe: string; no: string };

export function weeklyInviteAnswerLinks(token: string, origin: string): WeeklyInviteAnswerLinks {
  const at = (answer: "yes" | "maybe" | "no") =>
    new URL(weeklyInviteAnswerPath(token, answer), origin).toString();
  return { yes: at("yes"), maybe: at("maybe"), no: at("no") };
}

/** The key of one accepted Connection seen from the organizer's side: `ownerId:userId`. */
export function connectedPairKey(ownerId: string, userId: string): string {
  return `${ownerId}:${userId}`;
}

/**
 * Subject and body of one Weekly Invite email. With `answerLinks` (issue
 * #580) Yes is the one orange button and Maybe / No sit beside it; each opens
 * the answer page with that choice preselected, which writes nothing until it
 * is confirmed (ADR 0022). Without them it falls back to "View the game".
 */
export function formatWeeklyInviteEmail(params: {
  organizerName: string;
  slotWhen: string;
  slotUrl: string;
  answerLinks?: WeeklyInviteAnswerLinks;
}): { subject: string; html: string } {
  const { answerLinks } = params;
  return {
    subject: `Weekly game: ${params.slotWhen}`,
    html: renderEmailLayout({
      heading: `${params.organizerName} posted this week's game`,
      emphasis: params.slotWhen,
      paragraphs: answerLinks
        ? [
            "You're one of the regulars for this weekly game. Are you in? Tap your answer and confirm it on the page that opens. You don't need to sign in, and you can change it until the game starts.",
          ]
        : ["You're one of the regulars for this weekly game. Let them know if you're in."],
      primaryAction: answerLinks
        ? { label: "Yes", url: answerLinks.yes }
        : { label: "View the game", url: params.slotUrl },
      secondaryActions: answerLinks
        ? [
            { label: "Maybe", url: answerLinks.maybe },
            { label: "No", url: answerLinks.no },
          ]
        : undefined,
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
  /**
   * Each Regular's answer token, by `weeklyInviteLinkKey(slotId, userId)`.
   * A Regular with no token gets the "View the game" email instead.
   */
  answerTokens: ReadonlyMap<string, string>;
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

      // Tokens are per (Slot, Regular), so each Regular's email is their own.
      const token = input.answerTokens.get(weeklyInviteLinkKey(slot.slotId, userId));

      if (!input.alreadySent.has(weeklyInviteSendKey(slot.slotId, userId, "email"))) {
        const { subject, html } = formatWeeklyInviteEmail({
          ...copy,
          answerLinks: token ? weeklyInviteAnswerLinks(token, input.origin) : undefined,
        });
        sends.push({ channel: "email", slotId: slot.slotId, userId, subject, html });
      }

      const pushDue =
        input.pushConfigured &&
        (input.pushEnabledByUser.get(userId) ?? false) &&
        !input.alreadySent.has(weeklyInviteSendKey(slot.slotId, userId, "push"));
      const subscriptions = input.subscriptionsByUser.get(userId) ?? [];
      if (pushDue && subscriptions.length > 0) {
        // The push lands on the Regular's own device, so it opens their answer
        // page too: that shows the game even without Visibility.
        const payload = formatWeeklyInvitePush({
          ...copy,
          slotUrl: token ? new URL(weeklyInviteAnswerPath(token), input.origin).toString() : slotUrl,
        });
        sends.push({ channel: "push", slotId: slot.slotId, userId, subscriptions, payload });
      }
    }
  }

  return { sends };
}

/**
 * What a single cron run of each Reminder job should actually send (issue #187)
 * — the decision half of `send-reminders` and `send-booking-window-reminders`,
 * lifted out of the route handlers.
 *
 * `reminders.ts` and `booking-window.ts` hold the leaf primitives — is this
 * Slot due, who are its recipients, should this one channel fire, what does
 * the email/push body say — each unit tested in isolation. This module is the
 * one place they're composed into a run: filter the due Slots, resolve each
 * one's recipients, decide every (Slot, recipient, channel) send against the
 * preference and idempotency state, and emit a flat list of sends for the
 * route to carry out. That composition — the nested Slot × recipient ×
 * {email, push} × subscription fan-out, the `slotId:userId:channel` keying,
 * the "no subscription on file, skip quietly" case — is where the jobs' real
 * behaviour lives, and until this module existed it could only run against
 * the admin Supabase client, Resend and web-push all at once.
 *
 * Free of Next.js and Supabase imports on purpose: the routes do the
 * `service_role` reads, resolve each recipient's email address, call Resend /
 * web-push, prune a dead push subscription, and write the `*_sends` log rows.
 * Everything decidable from plain data lives here.
 */

import { slotPath } from "./routes.ts";
import { formatSlotWhen } from "./slots.ts";
import { orgDisplayName, type CachedPlace } from "./orgs.ts";
import { formatBookingReminderEmail } from "./booking-window.ts";
import {
  formatReminderEmail,
  formatReminderPush,
  getReminderRecipients,
  isReminderDue,
  shouldSendReminder,
  type ReminderResponder,
} from "./reminders.ts";

/** A `slots` row narrowed to what the attendee Reminder run needs — the route maps the query result down to this. */
export type CandidateSlot = {
  id: string;
  proposedStart: string;
  proposedEnd: string;
  timeZone: string;
  reminderOffsetMinutes: number;
};

/** A `slot_booking_windows` row (its due-check is SQL) narrowed to what the Booking Window Reminder run needs. */
export type DueBookingWindow = {
  slotId: string;
  ownerId: string;
  proposedStart: string;
  proposedEnd: string;
  timeZone: string;
  /** The Org's own hand-typed name, or `null` for a Place-backed Org (resolved via `placeById`). */
  orgName: string | null;
  orgGooglePlaceId: string | null;
};

/** One `push_subscriptions` row — `id` rides along for the route's own 404/410 prune. */
export type StoredPushSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** One email to send: the route resolves `userId`'s address and hands `subject`/`html` to Resend. */
export type EmailReminderSend = {
  slotId: string;
  userId: string;
  subject: string;
  html: string;
};

export type ReminderSend =
  | ({ channel: "email" } & EmailReminderSend)
  | {
      channel: "push";
      slotId: string;
      userId: string;
      /** Every device the recipient has registered — the route attempts each and prunes the dead ones. */
      subscriptions: StoredPushSubscription[];
      payload: ReturnType<typeof formatReminderPush>;
    };

function reminderSlotUrl(origin: string, slotId: string): string {
  return new URL(slotPath(slotId), origin).toString();
}

/**
 * The Slots whose Reminder is due right now, out of the coarse set the route's
 * own SQL bound (`proposed_start` within the widest offset). Kept a separate
 * export so the route can use it both to short-circuit an empty run and to
 * scope its follow-up reads before handing the survivors to
 * `planAttendeeReminderRun`.
 */
export function dueReminderSlots(
  candidateSlots: readonly CandidateSlot[],
  now: Date,
): CandidateSlot[] {
  return candidateSlots.filter((slot) =>
    isReminderDue({
      proposedStart: new Date(slot.proposedStart),
      reminderOffsetMinutes: slot.reminderOffsetMinutes,
      now,
    }),
  );
}

export type PlanAttendeeReminderRunInput = {
  /** Already narrowed by `dueReminderSlots`. */
  dueSlots: readonly CandidateSlot[];
  /** Slots with at least one Booking attached — a bare proposal has nothing to remind anyone about (CONTEXT.md's Reminder entry). */
  confirmedSlotIds: ReadonlySet<string>;
  responsesBySlot: ReadonlyMap<string, ReminderResponder[]>;
  /** A missing entry means the default (`true`) — see `getNotificationPreferences`. */
  emailEnabledByUser: ReadonlyMap<string, boolean>;
  /** A missing entry means the default (`false`). */
  pushEnabledByUser: ReadonlyMap<string, boolean>;
  /** `slotId:userId:channel` keys of sends already recorded in `reminder_sends`. */
  alreadySent: ReadonlySet<string>;
  subscriptionsByUser: ReadonlyMap<string, StoredPushSubscription[]>;
  /** `false` when the deploy has no VAPID keys — the push channel is skipped for the whole run. */
  pushConfigured: boolean;
  origin: string;
};

/**
 * Every send the attendee Reminder job (issue #11/#12) should carry out this
 * run. Email and push are independent per recipient: one can be due while the
 * other isn't, one can already have been sent while the other hasn't, so a
 * single (Slot, recipient) can produce zero, one, or two sends.
 */
export function planAttendeeReminderRun(input: PlanAttendeeReminderRunInput): {
  sends: ReminderSend[];
  checked: number;
} {
  const sends: ReminderSend[] = [];

  for (const slot of input.dueSlots) {
    const recipients = getReminderRecipients(
      input.responsesBySlot.get(slot.id) ?? [],
      input.confirmedSlotIds.has(slot.id),
    );
    if (recipients.length === 0) {
      continue;
    }

    const slotWhen = formatSlotWhen({
      proposedStart: slot.proposedStart,
      proposedEnd: slot.proposedEnd,
      timeZone: slot.timeZone,
    });
    const slotUrl = reminderSlotUrl(input.origin, slot.id);
    const { subject, html } = formatReminderEmail({ slotWhen, slotUrl });
    const payload = formatReminderPush({ slotWhen, slotUrl });

    for (const userId of recipients) {
      const emailDue = shouldSendReminder({
        channel: "email",
        emailEnabled: input.emailEnabledByUser.get(userId) ?? true,
        pushEnabled: false,
        alreadySent: input.alreadySent.has(`${slot.id}:${userId}:email`),
      });
      if (emailDue) {
        sends.push({ channel: "email", slotId: slot.id, userId, subject, html });
      }

      const pushDue =
        input.pushConfigured &&
        shouldSendReminder({
          channel: "push",
          emailEnabled: false,
          pushEnabled: input.pushEnabledByUser.get(userId) ?? false,
          alreadySent: input.alreadySent.has(`${slot.id}:${userId}:push`),
        });
      if (!pushDue) {
        continue;
      }

      // No subscription on file is the graceful-skip case (issue #12) — not a
      // failure, nothing to send to.
      const subscriptions = input.subscriptionsByUser.get(userId) ?? [];
      if (subscriptions.length === 0) {
        continue;
      }

      sends.push({ channel: "push", slotId: slot.id, userId, subscriptions, payload });
    }
  }

  return { sends, checked: input.dueSlots.length };
}

export type PlanBookingWindowReminderRunInput = {
  /** The route's SQL already did the due-check (`window_opens_at <= now < proposed_start`). */
  dueWindows: readonly DueBookingWindow[];
  /** A Booking attached means there's nothing left to remind the organizer to do. */
  confirmedSlotIds: ReadonlySet<string>;
  /** Keyed by owner id; a missing entry means the default (`true`). Governs `booking_window_email_enabled`, independent of the attendee Reminder's own preference. */
  emailEnabledByOwner: ReadonlyMap<string, boolean>;
  /** `slotId` keys of Booking Window Reminders already recorded in `booking_window_reminder_sends`. */
  alreadySent: ReadonlySet<string>;
  placeById: ReadonlyMap<string, CachedPlace>;
  origin: string;
};

/**
 * Every send the Booking Window Reminder job (issue #36) should carry out this
 * run — one email per still-unbooked, not-yet-reminded Slot organizer whose
 * facility's booking window has opened.
 */
export function planBookingWindowReminderRun(input: PlanBookingWindowReminderRunInput): {
  sends: EmailReminderSend[];
  checked: number;
} {
  const relevant = input.dueWindows.filter(
    (window) => !input.confirmedSlotIds.has(window.slotId),
  );

  const sends: EmailReminderSend[] = [];

  for (const window of relevant) {
    const shouldSend = shouldSendReminder({
      channel: "email",
      emailEnabled: input.emailEnabledByOwner.get(window.ownerId) ?? true,
      pushEnabled: false,
      alreadySent: input.alreadySent.has(window.slotId),
    });
    if (!shouldSend) {
      continue;
    }

    const orgName = orgDisplayName(
      { name: window.orgName, googlePlaceId: window.orgGooglePlaceId },
      window.orgGooglePlaceId ? (input.placeById.get(window.orgGooglePlaceId) ?? null) : null,
    );
    const slotWhen = formatSlotWhen({
      proposedStart: window.proposedStart,
      proposedEnd: window.proposedEnd,
      timeZone: window.timeZone,
    });
    const slotUrl = reminderSlotUrl(input.origin, window.slotId);
    const { subject, html } = formatBookingReminderEmail({ orgName, slotWhen, slotUrl });

    sends.push({ slotId: window.slotId, userId: window.ownerId, subject, html });
  }

  return { sends, checked: relevant.length };
}

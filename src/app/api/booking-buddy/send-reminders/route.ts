import { NextResponse, type NextRequest } from "next/server";

import { deliver, type DeliveryResult } from "@/lib/booking-buddy/delivery/deliver";
import { emailSenderFromEnv } from "@/lib/booking-buddy/delivery/resend-sender";
import {
  slotUserChannelLog,
  supabaseAddressLookup,
} from "@/lib/booking-buddy/delivery/supabase-adapters";
import { pushSenderFromEnv } from "@/lib/booking-buddy/delivery/web-push-sender";
import { readVapidEnv } from "@/lib/booking-buddy/env";
import { createAdminClient } from "@/lib/booking-buddy/supabase/admin";
import { MAX_REMINDER_OFFSET_MINUTES, type ReminderResponder } from "@/lib/booking-buddy/reminders";
import {
  dueReminderSlots,
  planAttendeeReminderRun,
  type CandidateSlot,
  type StoredPushSubscription,
} from "@/lib/booking-buddy/reminder-run";

export const runtime = "nodejs";

/**
 * The send job behind Reminders (issue #11, 8.5; the push channel is #12).
 * Fired by Vercel Cron (`vercel.json`) hitting this route on a schedule;
 * nothing about the logic below assumes any particular cadence —
 * `isReminderDue`'s window stays open from the configured offset all the way
 * to the Slot's own start, and `reminder_sends` is what makes a re-run safe,
 * so running this more or less often only changes how promptly a Reminder
 * goes out, never whether it's sent twice.
 *
 * The route reads as read → plan → deliver. The `service_role` reads come
 * first; which sends go out is `planAttendeeReminderRun` (`reminder-run.ts`);
 * `deliver` (`delivery/deliver.ts`) does the address lookup, the Resend /
 * web-push calls, pruning a dead push subscription, the `reminder_sends` log
 * writes and the counting. Both planner and delivery are unit tested.
 *
 * Push is additive, not a replacement: a User with no push subscription (or
 * `push_enabled: false`) simply gets nothing on that channel, same as
 * `shouldSendReminder` already decided before this ticket wired up delivery.
 * If the VAPID env vars are unset, the planner drops the push channel for the
 * whole run (and the subscriptions read is skipped). If Resend is unset, every
 * planned email counts as `skipped` rather than failing the run.
 *
 * `vercel.json`'s schedule is `"0 13 * * *"` — once daily, the most Vercel's
 * Hobby plan allows (2 Cron Jobs total, each invoked at most once a day; Pro
 * and above allow any frequency). **Upgrading later is a one-line change**:
 * edit that schedule string to a more frequent cron expression (every 15
 * minutes, for instance) — no code here needs to change, since the
 * due-window design above was already built to tolerate any cadence.
 *
 * One real consequence of daily-only cron worth knowing, not just a "runs
 * later" inconvenience: a Reminder's own due-window is only as wide as its
 * configured offset (`REMINDER_OFFSET_PRESETS` in `reminders.ts` — as
 * narrow as 15 minutes). If that window opens and fully closes between two
 * daily runs, the Reminder is silently never sent at all — not late, just
 * missed, since `isReminderDue` requires `now < proposedStart` and a Slot
 * that's already started won't retroactively get one. Short offsets are
 * only reliable once cron runs more often than the offset itself; until an
 * upgrade, a 1-day or 2-day offset is the dependable choice.
 *
 * Runs entirely through the admin (`service_role`) client — the same posture
 * issue #10's Guest RSVP path established: this is not a User acting through
 * their own session, and it needs to read across every User's Slots and
 * preferences at once, which no single User's RLS grant would ever allow.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("send-reminders: CRON_SECRET is not configured.");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // A deploy without VAPID keys still sends email Reminders, just not push
  // ones. The planner never produces a push send then, so `deliver` would not
  // warn about it; this is that one warning for the run.
  const pushConfigured = readVapidEnv() !== null;
  if (!pushConfigured) {
    console.warn("send-reminders: push is not configured, skipping it this run.");
  }

  const supabase = createAdminClient();
  const now = new Date();

  // Bounded to what could possibly be due right now — a Slot starting further
  // out than the widest configurable offset can't be due yet no matter what
  // its own offset is.
  const lookaheadEnd = new Date(now.getTime() + MAX_REMINDER_OFFSET_MINUTES * 60_000);

  const { data: candidateRows, error: slotsError } = await supabase
    .from("slots")
    .select("id, proposed_start, proposed_end, time_zone, reminder_offset_minutes")
    .gt("proposed_start", now.toISOString())
    .lte("proposed_start", lookaheadEnd.toISOString());

  if (slotsError) {
    console.error("send-reminders: reading candidate slots failed", slotsError);
    return NextResponse.json({ error: "Read failed." }, { status: 502 });
  }

  const dueSlots: CandidateSlot[] = dueReminderSlots(
    (candidateRows ?? []).map((row) => ({
      id: row.id,
      proposedStart: row.proposed_start,
      proposedEnd: row.proposed_end,
      timeZone: row.time_zone,
      reminderOffsetMinutes: row.reminder_offset_minutes,
    })),
    now,
  );

  let delivered: DeliveryResult = { sent: 0, failed: 0, skipped: 0 };

  if (dueSlots.length > 0) {
    const dueSlotIds = dueSlots.map((slot) => slot.id);

    // A due Slot only actually gets Reminders once it's confirmed — CONTEXT.md's
    // Reminder entry: a bare proposal has nothing concrete to remind anyone about.
    const { data: bookingRows, error: bookingsError } = await supabase
      .from("slot_bookings")
      .select("slot_id")
      .in("slot_id", dueSlotIds);

    if (bookingsError) {
      console.error("send-reminders: reading attached bookings failed", bookingsError);
      return NextResponse.json({ error: "Read failed." }, { status: 502 });
    }

    const confirmedSlotIds = new Set((bookingRows ?? []).map((row) => row.slot_id));

    const { data: responseRows, error: responsesError } = await supabase
      .from("responses")
      .select("slot_id, user_id, answer")
      .in("slot_id", dueSlotIds);

    if (responsesError) {
      console.error("send-reminders: reading responses failed", responsesError);
      return NextResponse.json({ error: "Read failed." }, { status: 502 });
    }

    const responsesBySlot = new Map<string, ReminderResponder[]>();
    for (const row of responseRows ?? []) {
      const list = responsesBySlot.get(row.slot_id) ?? [];
      list.push({ userId: row.user_id, answer: row.answer });
      responsesBySlot.set(row.slot_id, list);
    }

    // Everyone who responded to a due Slot — a superset of the actual
    // recipients (`getReminderRecipients` drops "no"/"maybe" and Guests),
    // which is all the preference and subscription reads need to be scoped to.
    const responderIds = [
      ...new Set(
        (responseRows ?? [])
          .map((row) => row.user_id)
          .filter((id): id is string => id !== null),
      ),
    ];

    if (responderIds.length > 0) {
      const [
        { data: preferenceRows, error: preferencesError },
        { data: sentRows, error: sentError },
        { data: subscriptionRows, error: subscriptionsError },
      ] = await Promise.all([
        supabase
          .from("notification_preferences")
          .select("user_id, email_enabled, push_enabled")
          .in("user_id", responderIds),
        supabase
          .from("reminder_sends")
          .select("slot_id, user_id, channel")
          .in("slot_id", dueSlotIds),
        pushConfigured
          ? supabase
              .from("push_subscriptions")
              .select("id, user_id, endpoint, p256dh, auth")
              .in("user_id", responderIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (preferencesError) {
        console.error("send-reminders: reading notification preferences failed", preferencesError);
        return NextResponse.json({ error: "Read failed." }, { status: 502 });
      }
      if (sentError) {
        console.error("send-reminders: reading reminder_sends failed", sentError);
        return NextResponse.json({ error: "Read failed." }, { status: 502 });
      }
      if (subscriptionsError) {
        console.error("send-reminders: reading push_subscriptions failed", subscriptionsError);
        return NextResponse.json({ error: "Read failed." }, { status: 502 });
      }

      // A missing row means the defaults — see getNotificationPreferences.
      const emailEnabledByUser = new Map(
        (preferenceRows ?? []).map((row) => [row.user_id, row.email_enabled]),
      );
      const pushEnabledByUser = new Map(
        (preferenceRows ?? []).map((row) => [row.user_id, row.push_enabled]),
      );
      const alreadySent = new Set(
        (sentRows ?? []).map((row) => `${row.slot_id}:${row.user_id}:${row.channel}`),
      );

      const subscriptionsByUser = new Map<string, StoredPushSubscription[]>();
      for (const row of subscriptionRows ?? []) {
        const list = subscriptionsByUser.get(row.user_id) ?? [];
        list.push({ id: row.id, endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth });
        subscriptionsByUser.set(row.user_id, list);
      }

      const { sends } = planAttendeeReminderRun({
        dueSlots,
        confirmedSlotIds,
        responsesBySlot,
        emailEnabledByUser,
        pushEnabledByUser,
        alreadySent,
        subscriptionsByUser,
        pushConfigured,
        origin: request.nextUrl.origin,
      });

      delivered = await deliver(sends, {
        logTag: "send-reminders",
        lookupAddress: supabaseAddressLookup(supabase),
        sendEmail: emailSenderFromEnv(),
        sendPush: pushSenderFromEnv(supabase),
        markSent: slotUserChannelLog(supabase, "reminder_sends"),
      });
    }
  }

  return NextResponse.json({ ok: true, checked: dueSlots.length, ...delivered });
}

import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";

import { createAdminClient } from "@/lib/booking-buddy/supabase/admin";
import { slotPath } from "@/lib/booking-buddy/routes";
import { formatSlotWhen } from "@/lib/booking-buddy/slots";
import {
  MAX_REMINDER_OFFSET_MINUTES,
  formatReminderEmail,
  getReminderRecipients,
  isReminderDue,
  shouldSendReminder,
} from "@/lib/booking-buddy/reminders";

export const runtime = "nodejs";

/**
 * The send job behind Reminders (issue #11, 8.5). Fired by Vercel Cron
 * (`vercel.json`) hitting this route on a schedule; nothing about the logic
 * below assumes any particular cadence — `isReminderDue`'s window stays open
 * from the configured offset all the way to the Slot's own start, and
 * `reminder_sends` is what makes a re-run safe, so running this more or less
 * often only changes how promptly a Reminder goes out, never whether it's
 * sent twice.
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

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;
  if (!apiKey || !from) {
    console.error("send-reminders: missing RESEND_API_KEY or REMINDER_FROM_EMAIL.");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }

  const supabase = createAdminClient();
  const resend = new Resend(apiKey);
  const now = new Date();

  // Bounded to what could possibly be due right now — a Slot starting further
  // out than the widest configurable offset can't be due yet no matter what
  // its own offset is.
  const lookaheadEnd = new Date(now.getTime() + MAX_REMINDER_OFFSET_MINUTES * 60_000);

  const { data: candidates, error: slotsError } = await supabase
    .from("slots")
    .select("id, proposed_start, proposed_end, time_zone, reminder_offset_minutes")
    .gt("proposed_start", now.toISOString())
    .lte("proposed_start", lookaheadEnd.toISOString());

  if (slotsError) {
    console.error("send-reminders: reading candidate slots failed", slotsError);
    return NextResponse.json({ error: "Read failed." }, { status: 502 });
  }

  const dueSlots = (candidates ?? []).filter((slot) =>
    isReminderDue({
      proposedStart: new Date(slot.proposed_start),
      reminderOffsetMinutes: slot.reminder_offset_minutes,
      now,
    }),
  );

  let sent = 0;
  let failed = 0;

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

    const responsesBySlot = new Map<string, { userId: string | null; answer: "yes" | "no" | "maybe" }[]>();
    for (const row of responseRows ?? []) {
      const list = responsesBySlot.get(row.slot_id) ?? [];
      list.push({ userId: row.user_id, answer: row.answer });
      responsesBySlot.set(row.slot_id, list);
    }

    const recipientsBySlot = new Map<string, string[]>();
    const allRecipientIds = new Set<string>();
    for (const slot of dueSlots) {
      const recipients = getReminderRecipients(
        responsesBySlot.get(slot.id) ?? [],
        confirmedSlotIds.has(slot.id),
      );
      recipientsBySlot.set(slot.id, recipients);
      recipients.forEach((id) => allRecipientIds.add(id));
    }

    if (allRecipientIds.size > 0) {
      const recipientIds = [...allRecipientIds];

      const [{ data: preferenceRows, error: preferencesError }, { data: sentRows, error: sentError }] =
        await Promise.all([
          supabase
            .from("notification_preferences")
            .select("user_id, email_enabled")
            .in("user_id", recipientIds),
          supabase
            .from("reminder_sends")
            .select("slot_id, user_id")
            .eq("channel", "email")
            .in("slot_id", dueSlotIds),
        ]);

      if (preferencesError) {
        console.error("send-reminders: reading notification preferences failed", preferencesError);
        return NextResponse.json({ error: "Read failed." }, { status: 502 });
      }
      if (sentError) {
        console.error("send-reminders: reading reminder_sends failed", sentError);
        return NextResponse.json({ error: "Read failed." }, { status: 502 });
      }

      // A missing row means the default — see getNotificationPreferences.
      const emailEnabledById = new Map(
        (preferenceRows ?? []).map((row) => [row.user_id, row.email_enabled]),
      );
      const alreadySent = new Set(
        (sentRows ?? []).map((row) => `${row.slot_id}:${row.user_id}`),
      );

      for (const slot of dueSlots) {
        const recipients = recipientsBySlot.get(slot.id) ?? [];
        if (recipients.length === 0) {
          continue;
        }

        const slotWhen = formatSlotWhen({
          proposedStart: slot.proposed_start,
          proposedEnd: slot.proposed_end,
          timeZone: slot.time_zone,
        });
        const slotUrl = new URL(slotPath(slot.id), request.nextUrl.origin).toString();
        const { subject, html } = formatReminderEmail({ slotWhen, slotUrl });

        for (const userId of recipients) {
          const shouldSend = shouldSendReminder({
            channel: "email",
            emailEnabled: emailEnabledById.get(userId) ?? true,
            pushEnabled: false,
            alreadySent: alreadySent.has(`${slot.id}:${userId}`),
          });
          if (!shouldSend) {
            continue;
          }

          // The `service_role` admin API, not a table read — no table anywhere
          // in this schema is granted an email column to read one from.
          const { data: userData, error: userError } =
            await supabase.auth.admin.getUserById(userId);
          if (userError || !userData?.user?.email) {
            console.error("send-reminders: no email for recipient", userId, userError);
            failed += 1;
            continue;
          }

          const { error: sendError } = await resend.emails.send({
            from,
            to: userData.user.email,
            subject,
            html,
          });

          if (sendError) {
            console.error("send-reminders: Resend error", sendError);
            failed += 1;
            continue;
          }

          // Best-effort — the email is already sent; a duplicate log row (a
          // race with another run) is caught by the table's own unique
          // constraint and is not itself a failure worth reporting.
          const { error: logError } = await supabase
            .from("reminder_sends")
            .insert({ slot_id: slot.id, user_id: userId, channel: "email" });
          if (logError && logError.code !== "23505") {
            console.error("send-reminders: logging the send failed", logError);
          }

          sent += 1;
        }
      }
    }
  }

  return NextResponse.json({ ok: true, checked: dueSlots.length, sent, failed });
}

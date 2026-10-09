import { NextResponse, type NextRequest } from "next/server";

import { deliver } from "@/lib/booking-buddy/delivery/deliver";
import { emailSenderFromEnv } from "@/lib/booking-buddy/delivery/resend-sender";
import {
  bookingWindowReminderLog,
  supabaseAddressLookup,
} from "@/lib/booking-buddy/delivery/supabase-adapters";
import { createAdminClient } from "@/lib/booking-buddy/supabase/admin";
import type { CachedPlace } from "@/lib/booking-buddy/orgs";
import {
  planBookingWindowReminderRun,
  type DueBookingWindow,
} from "@/lib/booking-buddy/reminder-run";

export const runtime = "nodejs";

/**
 * The send job behind Booking Window Reminders (issue #36) — distinct from
 * `send-reminders` (issue #11): this one tells a Slot's *organizer* it's
 * time to go reserve a court, not attendees that a confirmed game is coming
 * up. Kept as its own route rather than folded into the other one, since the
 * recipient, trigger and eligibility logic are all different — same
 * reasoning `slot-links.ts`/`guest-rsvp.ts` stayed separate action files
 * despite being related.
 *
 * Which sends actually go out is `planBookingWindowReminderRun`
 * (`reminder-run.ts`), unit tested; this route reads, plans, then hands the
 * sends to `deliver` (`delivery/`, spec #610), which looks up the address,
 * sends through Resend, logs to `booking_window_reminder_sends` and counts.
 * Without Resend configured the run still succeeds, every email `skipped`.
 *
 * `slot_booking_windows` (the migration) already computes `window_opens_at`
 * as a real instant in Postgres, so unlike the attendee Reminder there's no
 * JS-side due-window logic here — the query itself is the due-check. Runs
 * entirely through the admin (`service_role`) client, same posture as every
 * other cross-User job in this app.
 *
 * `vercel.json`'s schedule is `"0 13 * * *"` — once daily, the most Vercel's
 * Hobby plan allows (2 Cron Jobs total, each invoked at most once a day; Pro
 * and above allow any frequency — see `send-reminders`'s own header comment
 * for the fuller story). **Upgrading later is a one-line change**: edit
 * that schedule string to a more frequent cron expression — nothing here
 * needs to change, since this due-check already runs in SQL regardless of
 * how often it's asked.
 *
 * The missed-entirely risk `send-reminders` carries for a short offset is
 * much smaller here, by construction: the due-window stretches from
 * `window_opens_at` all the way to the Slot's own `proposed_start`, which is
 * typically days, not minutes. The one case that still narrows it is a
 * `booking_window_days_before` of 0 (opens the same day as play) on a Slot
 * later that same day — worth knowing, same as the attendee Reminder's
 * short-offset caveat, but a much rarer configuration to actually hit.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("send-booking-window-reminders: CRON_SECRET is not configured.");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  const { data: windowRows, error: windowsError } = await supabase
    .from("slot_booking_windows")
    .select(
      "slot_id, owner_id, proposed_start, proposed_end, time_zone, org_id, org_name, org_google_place_id",
    )
    .lte("window_opens_at", now.toISOString())
    .gt("proposed_start", now.toISOString());

  if (windowsError) {
    console.error(
      "send-booking-window-reminders: reading due booking windows failed",
      windowsError,
    );
    return NextResponse.json({ error: "Read failed." }, { status: 502 });
  }

  const dueWindows: DueBookingWindow[] = (windowRows ?? []).map((row) => ({
    slotId: row.slot_id,
    ownerId: row.owner_id,
    proposedStart: row.proposed_start,
    proposedEnd: row.proposed_end,
    timeZone: row.time_zone,
    orgName: row.org_name,
    orgGooglePlaceId: row.org_google_place_id,
  }));

  if (dueWindows.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, sent: 0, failed: 0, skipped: 0 });
  }

  const slotIds = dueWindows.map((window) => window.slotId);
  const ownerIds = [...new Set(dueWindows.map((window) => window.ownerId))];
  const placeIds = [
    ...new Set(
      dueWindows
        .map((window) => window.orgGooglePlaceId)
        .filter((id): id is string => id !== null),
    ),
  ];

  // Stops being relevant the moment a real Booking is attached — there's
  // nothing left to remind the organizer to go do.
  const { data: bookingRows, error: bookingsError } = await supabase
    .from("slot_bookings")
    .select("slot_id")
    .in("slot_id", slotIds);

  if (bookingsError) {
    console.error(
      "send-booking-window-reminders: reading attached bookings failed",
      bookingsError,
    );
    return NextResponse.json({ error: "Read failed." }, { status: 502 });
  }

  const confirmedSlotIds = new Set((bookingRows ?? []).map((row) => row.slot_id));

  const [
    { data: preferenceRows, error: preferencesError },
    { data: sentRows, error: sentError },
    { data: placeRows, error: placesError },
  ] = await Promise.all([
    supabase
      .from("notification_preferences")
      .select("user_id, booking_window_email_enabled")
      .in("user_id", ownerIds),
    supabase.from("booking_window_reminder_sends").select("slot_id").in("slot_id", slotIds),
    placeIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("place_cache").select("place_id, name, formatted_address").in(
          "place_id",
          placeIds,
        ),
  ]);

  if (preferencesError) {
    console.error(
      "send-booking-window-reminders: reading notification preferences failed",
      preferencesError,
    );
    return NextResponse.json({ error: "Read failed." }, { status: 502 });
  }
  if (sentError) {
    console.error(
      "send-booking-window-reminders: reading booking_window_reminder_sends failed",
      sentError,
    );
    return NextResponse.json({ error: "Read failed." }, { status: 502 });
  }
  if (placesError) {
    console.error(
      "send-booking-window-reminders: reading the place cache failed",
      placesError,
    );
    return NextResponse.json({ error: "Read failed." }, { status: 502 });
  }

  // A missing row means the default — see getNotificationPreferences.
  const emailEnabledByOwner = new Map(
    (preferenceRows ?? []).map((row) => [row.user_id, row.booking_window_email_enabled]),
  );
  const alreadySent = new Set((sentRows ?? []).map((row) => row.slot_id));
  const placeById = new Map<string, CachedPlace>(
    (placeRows ?? []).map((row) => [
      row.place_id,
      { name: row.name, formattedAddress: row.formatted_address },
    ]),
  );

  const plan = planBookingWindowReminderRun({
    dueWindows,
    confirmedSlotIds,
    emailEnabledByOwner,
    alreadySent,
    placeById,
    origin: request.nextUrl.origin,
  });

  const { sent, failed, skipped } = await deliver(
    plan.sends.map((send) => ({ ...send, channel: "email" as const })),
    {
      logTag: "send-booking-window-reminders",
      lookupAddress: supabaseAddressLookup(supabase),
      sendEmail: emailSenderFromEnv(),
      sendPush: null,
      markSent: bookingWindowReminderLog(supabase),
    },
  );

  return NextResponse.json({ ok: true, checked: plan.checked, sent, failed, skipped });
}

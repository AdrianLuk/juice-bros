import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";

import { createAdminClient } from "@/lib/booking-buddy/supabase/admin";
import { slotPath } from "@/lib/booking-buddy/routes";
import { formatSlotWhen } from "@/lib/booking-buddy/slots";
import { orgDisplayName, type CachedPlace } from "@/lib/booking-buddy/orgs";
import { formatBookingReminderEmail } from "@/lib/booking-buddy/booking-window";
import { shouldSendReminder } from "@/lib/booking-buddy/reminders";

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
 * `slot_booking_windows` (the migration) already computes `window_opens_at`
 * as a real instant in Postgres, so unlike the attendee Reminder there's no
 * JS-side due-window logic here — the query itself is the due-check. Runs
 * entirely through the admin (`service_role`) client, same posture as every
 * other cross-User job in this app.
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

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;
  if (!apiKey || !from) {
    console.error(
      "send-booking-window-reminders: missing RESEND_API_KEY or REMINDER_FROM_EMAIL.",
    );
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }

  const supabase = createAdminClient();
  const resend = new Resend(apiKey);
  const now = new Date();

  const { data: dueWindows, error: windowsError } = await supabase
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

  let candidates = dueWindows ?? [];
  let sent = 0;
  let failed = 0;

  if (candidates.length > 0) {
    const slotIds = candidates.map((row) => row.slot_id);

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
    candidates = candidates.filter((row) => !confirmedSlotIds.has(row.slot_id));
  }

  if (candidates.length > 0) {
    const slotIds = candidates.map((row) => row.slot_id);
    const ownerIds = [...new Set(candidates.map((row) => row.owner_id))];
    const placeIds = [
      ...new Set(
        candidates
          .map((row) => row.org_google_place_id)
          .filter((id): id is string => id !== null),
      ),
    ];

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

    for (const row of candidates) {
      const shouldSend = shouldSendReminder({
        channel: "email",
        emailEnabled: emailEnabledByOwner.get(row.owner_id) ?? true,
        pushEnabled: false,
        alreadySent: alreadySent.has(row.slot_id),
      });
      if (!shouldSend) {
        continue;
      }

      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
        row.owner_id,
      );
      if (userError || !userData?.user?.email) {
        console.error(
          "send-booking-window-reminders: no email for recipient",
          row.owner_id,
          userError,
        );
        failed += 1;
        continue;
      }

      const orgName = orgDisplayName(
        { name: row.org_name, googlePlaceId: row.org_google_place_id },
        row.org_google_place_id ? (placeById.get(row.org_google_place_id) ?? null) : null,
      );
      const slotWhen = formatSlotWhen({
        proposedStart: row.proposed_start,
        proposedEnd: row.proposed_end,
        timeZone: row.time_zone,
      });
      const slotUrl = new URL(slotPath(row.slot_id), request.nextUrl.origin).toString();
      const { subject, html } = formatBookingReminderEmail({ orgName, slotWhen, slotUrl });

      const { error: sendError } = await resend.emails.send({
        from,
        to: userData.user.email,
        subject,
        html,
      });

      if (sendError) {
        console.error("send-booking-window-reminders: Resend error", sendError);
        failed += 1;
        continue;
      }

      // Best-effort — the email is already sent; a duplicate log row (a race
      // with another run) is caught by the table's own unique constraint and
      // is not itself a failure worth reporting.
      const { error: logError } = await supabase
        .from("booking_window_reminder_sends")
        .insert({ slot_id: row.slot_id });
      if (logError && logError.code !== "23505") {
        console.error("send-booking-window-reminders: logging the send failed", logError);
      }

      sent += 1;
    }
  }

  return NextResponse.json({ ok: true, checked: candidates.length, sent, failed });
}

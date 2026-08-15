/**
 * Pure input handling and display logic for Bookings.
 *
 * A Booking mirrors a reservation that already exists on the facility's own
 * platform (ADR 0002), so everything here is about keeping hand-entered data
 * coherent and rendering it back as the same wall-clock time the User read off
 * that platform.
 *
 * Free of Next.js and Supabase imports on purpose. The limits mirror the
 * `bookings` migration — change one and you must change the other.
 */

import {
  HALF_HOUR_TIMES,
  formatInstantRange,
  formatTimeLabel,
  isHalfHourTime,
  isRealDate,
} from "./datetime.ts";

export { HALF_HOUR_TIMES, formatTimeLabel };

export const COURT_LABEL_MAX_LENGTH = 40;

export type NewBooking = {
  orgId: string;
  courtLabel: string;
  date: string;
  startTime: string;
  endTime: string;
};

export function parseNewBooking(
  formData: FormData,
): NewBooking | { error: string } {
  const orgId = String(formData.get("org_id") ?? "").trim();
  if (!orgId) {
    return { error: "Pick which place this booking is at." };
  }

  const courtLabel = String(formData.get("court_label") ?? "").trim();
  if (!courtLabel) {
    return { error: "Which court? Put in whatever the booking screen calls it." };
  }

  if (courtLabel.length > COURT_LABEL_MAX_LENGTH) {
    return {
      error: `That court name is too long — ${COURT_LABEL_MAX_LENGTH} characters at most.`,
    };
  }

  const date = String(formData.get("date") ?? "").trim();
  if (!isRealDate(date)) {
    return { error: "Pick a date for the booking." };
  }

  const startTime = String(formData.get("start_time") ?? "").trim();
  const endTime = String(formData.get("end_time") ?? "").trim();

  if (!isHalfHourTime(startTime) || !isHalfHourTime(endTime)) {
    return { error: "Pick a start and end time." };
  }

  // Zero-padded 24-hour times compare correctly as strings. A Booking that ran
  // past midnight would defeat this, and is not a thing a court reservation
  // does — the database refuses it too.
  if (endTime <= startTime) {
    return { error: "The end time has to be after the start time." };
  }

  return { orgId, courtLabel, date, startTime, endTime };
}

/**
 * When a Booking is, written as the facility's own clock read it.
 *
 * `starts_at` is an instant, so rendering it needs to be told which clock to
 * use. Left to the server's own zone it reads four hours out in production, and
 * nobody notices until someone shows up late.
 */
export function formatBookingWhen(booking: {
  startsAt: string;
  endsAt: string;
  timeZone: string;
}): string {
  return formatInstantRange({
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    timeZone: booking.timeZone,
  });
}

/**
 * Turns a failed Booking write into something worth reading.
 *
 * `23514` arrives from five rules now — the org-ownership branch of
 * `assert_booking_coherent`, three check constraints, and
 * `bookings_not_in_the_past` — so the code alone doesn't say what went wrong.
 * The zone-validity branch that used to live here moved to `orgs` with the
 * column (issue #20); a Booking write can no longer raise it.
 */
export function bookingWriteMessage(error: {
  code?: string;
  message?: string;
}): string {
  if (error.code !== "23514") {
    return "Couldn't save that booking. Try again.";
  }

  if (error.message?.includes("orgs")) {
    return "That booking doesn't sit under one of your own places.";
  }

  // `createBooking`'s own past-date check (`isPastDate`) is calendar-day-only,
  // so a same-day booking whose start time already passed reaches here —
  // the one past-time cause the action can't pre-empt itself.
  if (error.message?.includes("in the past")) {
    return "That time has already passed. Pick a time in the future.";
  }

  // The three check constraints — court label blank or over-long, and an end
  // that isn't after the start. `parseNewBooking` catches all of them first, so
  // getting here means the form and the schema have drifted apart.
  return "Something about that booking doesn't add up. Check the court and times.";
}

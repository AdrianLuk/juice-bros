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

import { isKnownTimeZone } from "./timezone.ts";

export const COURT_LABEL_MAX_LENGTH = 40;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// Half-hour boundaries only. Courts are booked in half-hour chunks, not
// whatever a free-typed or click-dragged time picker happens to land on — a
// "6:23 PM" booking isn't a real reservation anyone could have made.
const TIME_PATTERN = /^([01]\d|2[0-3]):(00|30)$/;

export type NewBooking = {
  orgId: string;
  courtLabel: string;
  date: string;
  startTime: string;
  endTime: string;
};

/**
 * Every half-hour slot in a day, `"00:00"` through `"23:30"` — what the start
 * and end pickers offer. A `<select>` rather than `<input type="time">` so a
 * User physically cannot choose anything off the half-hour grid; the pattern
 * above is the server-side backstop for a request built by hand.
 */
export const HALF_HOUR_TIMES: readonly string[] = Array.from(
  { length: 48 },
  (_, index) =>
    `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 === 0 ? "00" : "30"}`,
);

/** `"18:30"` → `"6:30 PM"`, for the option labels — the value posted is still 24-hour. */
export function formatTimeLabel(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours < 12 ? "AM" : "PM";
  const twelveHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelveHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

/** A calendar date, not merely four digits and two hyphens. */
function isRealDate(date: string): boolean {
  if (!DATE_PATTERN.test(date)) {
    return false;
  }

  // Round-tripping is what catches 2026-13-01 and 2026-02-30, which the
  // pattern alone is happy with.
  const parsed = new Date(`${date}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
  );
}

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

  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
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
  const start = new Date(booking.startsAt);
  const end = new Date(booking.endsAt);

  // The trigger refuses a zone Postgres doesn't know, so a row that lands here
  // should not exist. Throwing anyway would take down the whole list to punish
  // one row, so UTC and an admission is the better answer.
  const usable = isKnownTimeZone(booking.timeZone);
  const zone = usable ? booking.timeZone : "UTC";

  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: zone,
  });

  const clock = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: zone,
  });

  const when = `${day.format(start)} · ${clock.format(start)} – ${clock.format(end)}`;

  return usable ? when : `${when} (UTC)`;
}

/**
 * Turns a failed Booking write into something worth reading.
 *
 * `23514` arrives from four rules — the org-ownership branch of
 * `assert_booking_coherent` and three check constraints — so the code alone
 * doesn't say what went wrong. The zone-validity branch that used to live here
 * moved to `orgs` with the column (issue #20); a Booking write can no longer
 * raise it.
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

  // The three check constraints — court label blank or over-long, and an end
  // that isn't after the start. `parseNewBooking` catches all of them first, so
  // getting here means the form and the schema have drifted apart.
  return "Something about that booking doesn't add up. Check the court and times.";
}

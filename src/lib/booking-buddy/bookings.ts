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
  HOUR_TIMES,
  addHoursToTime,
  formatInstantRange,
  formatTimeLabel,
  isHourTime,
  isRealDate,
} from "./datetime.ts";
import { isBookingFormat, type BookingFormat } from "./capacity.ts";

export { HOUR_TIMES, addHoursToTime, formatTimeLabel };

/** Preset duration choices the Booking form offers before falling back to a custom hour count. */
export const DURATION_PRESET_HOURS = [1, 2, 3] as const;

export const DEFAULT_DURATION_HOURS = 2;

export const COURT_LABEL_MAX_LENGTH = 40;

export const NAME_MAX_LENGTH = 60;

export const DEFAULT_BOOKING_FORMAT: BookingFormat = "doubles";

export type NewBooking = {
  orgId: string;
  /** Null when the User didn't note one down — not every facility labels its courts. */
  courtLabel: string | null;
  /** Null when the User didn't give the Booking a name — a free-text label distinct from the court label. */
  name: string | null;
  date: string;
  startTime: string;
  endTime: string;
  /** What the court holds Capacity to (ADR 0008) — defaults to doubles, the common case. */
  format: BookingFormat;
};

export function parseNewBooking(
  formData: FormData,
): NewBooking | { error: string } {
  const orgId = String(formData.get("org_id") ?? "").trim();
  if (!orgId) {
    return { error: "Pick which place this booking is at." };
  }

  const rawCourtLabel = String(formData.get("court_label") ?? "").trim();
  const courtLabel = rawCourtLabel === "" ? null : rawCourtLabel;

  if (courtLabel && courtLabel.length > COURT_LABEL_MAX_LENGTH) {
    return {
      error: `That court name is too long — ${COURT_LABEL_MAX_LENGTH} characters at most.`,
    };
  }

  const rawName = String(formData.get("name") ?? "").trim();
  const name = rawName === "" ? null : rawName;

  if (name && name.length > NAME_MAX_LENGTH) {
    return {
      error: `That name is too long — ${NAME_MAX_LENGTH} characters at most.`,
    };
  }

  const date = String(formData.get("date") ?? "").trim();
  if (!isRealDate(date)) {
    return { error: "Pick a date for the booking." };
  }

  const startTime = String(formData.get("start_time") ?? "").trim();
  const endTime = String(formData.get("end_time") ?? "").trim();

  if (!isHourTime(startTime) || !isHourTime(endTime)) {
    return { error: "Pick a start and end time." };
  }

  // Zero-padded 24-hour times compare correctly as strings. A Booking that ran
  // past midnight would defeat this, and is not a thing a court reservation
  // does — the database refuses it too.
  if (endTime <= startTime) {
    return { error: "The end time has to be after the start time." };
  }

  // Never refused for an odd value — a stray/tampered value just falls back
  // to the common case, the same "default rather than error" the User
  // themselves gets by leaving the field alone.
  const rawFormat = formData.get("format");
  const format: BookingFormat = isBookingFormat(rawFormat) ? rawFormat : DEFAULT_BOOKING_FORMAT;

  return { orgId, courtLabel, name, date, startTime, endTime, format };
}

/** "Court 3" when the User noted one down, otherwise a plain fallback. */
export function formatCourtLabel(courtLabel: string | null): string {
  return courtLabel ? `Court ${courtLabel}` : "No court noted";
}

/** `"2026-08-19"` → `"08-19-2026"` — a plain string reslice, not a `Date` round-trip, since the input already is a calendar date with no zone to misread. */
export function formatCandidateDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${month}-${day}-${year}`;
}

/**
 * Strips a leading "Court" word off a CourtReserve email's own Court(s) text
 * (e.g. "Court #6 - Hard") before it becomes a candidate's `court_label`
 * (issue #64) — without this, `formatCourtLabel` re-adding its own "Court "
 * prefix at display time would double up to "Court Court #6 - Hard". A
 * facility's own free text after that word (like "#6 - Hard") is kept as-is;
 * only the word CourtReserve's template itself always prepends is removed.
 */
export function stripCourtLabelPrefix(courtLabel: string | null): string | null {
  if (!courtLabel) {
    return null;
  }

  const stripped = courtLabel.replace(/^court\s*/i, "").trim();
  return stripped || null;
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

  // The check constraints — court label or name blank or over-long, and an
  // end that isn't after the start. `parseNewBooking` catches all of them
  // first, so getting here means the form and the schema have drifted apart.
  return "Something about that booking doesn't add up. Check the name, court, and times.";
}

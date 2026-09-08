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

/** Bigger than NAME_MAX_LENGTH on purpose — notes is meant to hold more than a short label. */
export const NOTES_MAX_LENGTH = 500;

/** Mirrors `booking_player_name_length` — the same cap `court_label` itself uses. */
export const PLAYER_NAME_MAX_LENGTH = 40;

export const DEFAULT_BOOKING_FORMAT: BookingFormat = "doubles";

export type NewBooking = {
  orgId: string;
  /** Null when the User didn't note one down — not every facility labels its courts. */
  courtLabel: string | null;
  /** Null when the User didn't give the Booking a name — a free-text label distinct from the court label. */
  name: string | null;
  /** Null when the User didn't add one — free-text detail distinct from the name (a label) and the court label (which court). */
  notes: string | null;
  date: string;
  startTime: string;
  endTime: string;
  /** What the court holds Capacity to (ADR 0008) — defaults to doubles, the common case. */
  format: BookingFormat;
  /** Raw names, trimmed and blank-filtered — matching against Connections happens at write time (ADR 0011). Empty is valid; a Booking with zero Players is not an error. */
  players: string[];
};

/**
 * A comma-separated list of names into trimmed, non-blank entries — the same
 * shape `courtreserve-email.ts` splits a CourtReserve "Player(s)" section
 * into, shared so the two don't drift apart.
 */
export function splitPlayerNames(text: string | null): string[] {
  if (!text) {
    return [];
  }
  return text
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

export function parseNewBooking(
  formData: FormData,
): NewBooking | { error: string } {
  const orgId = String(formData.get("org_id") ?? "").trim();
  if (!orgId) {
    return { error: "Pick which place this booking is at." };
  }

  const rawName = String(formData.get("name") ?? "").trim();
  const name = rawName === "" ? null : rawName;

  if (name && name.length > NAME_MAX_LENGTH) {
    return {
      error: `That name is too long. ${NAME_MAX_LENGTH} characters at most.`,
    };
  }

  const reservation = parseReservationFields(formData);
  if ("error" in reservation) {
    return reservation;
  }

  return { orgId, name, ...reservation };
}

/**
 * The fields a reservation itself carries — everything on a Booking form
 * except which place it's at and what the User called it. Split out of
 * `parseNewBooking` so that applying a Reservation Update Notice
 * (`parseUpdateApplication`) validates the same values the same way, with the
 * same messages, rather than growing a second, drifting copy of them.
 */
function parseReservationFields(
  formData: FormData,
):
  | Omit<NewBooking, "orgId" | "name">
  | { error: string } {
  const rawCourtLabel = String(formData.get("court_label") ?? "").trim();
  const courtLabel = rawCourtLabel === "" ? null : rawCourtLabel;

  if (courtLabel && courtLabel.length > COURT_LABEL_MAX_LENGTH) {
    return {
      error: `That court name is too long. ${COURT_LABEL_MAX_LENGTH} characters at most.`,
    };
  }

  const rawNotes = String(formData.get("notes") ?? "").trim();
  const notes = rawNotes === "" ? null : rawNotes;

  if (notes && notes.length > NOTES_MAX_LENGTH) {
    return {
      error: `That note is too long. ${NOTES_MAX_LENGTH} characters at most.`,
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

  // An End at or before the Start reads as the next day — a 9pm–midnight or
  // 10pm–1am session is a real reservation. The write path turns that into an
  // End instant on `date + 1` (`crossesMidnight` in `actions/bookings.ts`).
  // Only a zero-length range is refused; the database's `ends_at > starts_at`
  // check is satisfied either way once the day is bumped.
  if (endTime === startTime) {
    return { error: "The end time can't be the same as the start time." };
  }

  // Never refused for an odd value — a stray/tampered value just falls back
  // to the common case, the same "default rather than error" the User
  // themselves gets by leaving the field alone.
  const rawFormat = formData.get("format");
  const format: BookingFormat = isBookingFormat(rawFormat) ? rawFormat : DEFAULT_BOOKING_FORMAT;

  const players = splitPlayerNames(String(formData.get("players") ?? ""));
  const overLongPlayer = players.find((player) => player.length > PLAYER_NAME_MAX_LENGTH);
  if (overLongPlayer) {
    return {
      error: `"${overLongPlayer}" is too long for a player name. ${PLAYER_NAME_MAX_LENGTH} characters at most.`,
    };
  }

  return { courtLabel, notes, date, startTime, endTime, format, players };
}

/**
 * What applying a Reservation Update Notice writes to a Booking already on
 * file (issue #458): the reservation as the facility now describes it, plus
 * the Booking it lands on.
 *
 * No `orgId`, unlike a `NewBooking`: an update edits a Booking whose facility
 * is already settled, and the write path reads that Booking's own Org for the
 * zone rather than letting a form name one. No `name` either — the Booking
 * keeps whatever the User called it.
 */
export type BookingUpdateApplication = Omit<NewBooking, "orgId" | "name"> & {
  bookingId: string;
};

/**
 * The Confirm form on an `update` review card, parsed and validated the same
 * way a Booking form is (issue #458).
 *
 * Every field is re-validated here rather than trusted from the already-parsed
 * candidate, the same posture `confirmImportCandidate` takes with
 * `parseNewBooking` — the values crossed a network boundary and came back.
 */
export function parseUpdateApplication(
  formData: FormData,
): BookingUpdateApplication | { error: string } {
  const bookingId = String(formData.get("booking_id") ?? "").trim();
  if (!bookingId) {
    return { error: "Pick which booking this update is for." };
  }

  const reservation = parseReservationFields(formData);
  if ("error" in reservation) {
    return reservation;
  }

  return { bookingId, ...reservation };
}

/** "Court 3" when the User noted one down, otherwise a plain fallback. */
export function formatCourtLabel(courtLabel: string | null): string {
  return courtLabel ? `Court ${courtLabel}` : "No court noted";
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Sept", not "Sep" — the abbreviation people actually write for September. */
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * `"2026-08-19"` → `"Wed Aug 19, 2026"` — the month/day/year part is a plain
 * string reslice, not a `Date` round-trip, since the input already is a
 * calendar date with no zone to misread. The weekday alone needs a `Date` to
 * read off, so it's parsed as UTC midnight and read with `getUTCDay` — the same
 * zoneless-string convention `isRealDate`/`shiftCalendarDate` (datetime.ts)
 * already use for this exact date-only string shape.
 *
 * A month name rather than `08-19-2026` (issue #433): the review cards are read
 * at a glance, and a numeric month/day pair asks the reader which half is
 * which. The day keeps its leading zero and the weekday takes no comma, which
 * is deliberately *not* `Intl`'s `en-US` shape — the Booking cards above these
 * render `"Wed, Aug 19, 2026"` through `formatInstantDateAndTime`. Built by
 * hand for that reason, and because the input is a zoneless date string rather
 * than an instant, so giving `Intl` a zone to read it in would be inventing one.
 *
 * A string that isn't a real calendar date comes back verbatim. Callers only
 * ever pass a validated one, but the old numeric form rendered "undefined" for
 * a bad input and this shouldn't inherit that.
 */
export function formatCandidateDate(date: string): string {
  const weekdayIndex = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (Number.isNaN(weekdayIndex)) {
    return date;
  }

  const [year, month, day] = date.split("-");
  return `${WEEKDAY_SHORT[weekdayIndex]} ${MONTH_SHORT[Number(month) - 1]} ${day}, ${year}`;
}

// The court-label shaping an Import Candidate needs — `splitOverlongCourtLabel`
// and `stripCourtLabelPrefix` — moved to `import-candidate-shaping.ts` for #288
// so the Calendar Feed's review composition can share them; both still read
// `COURT_LABEL_MAX_LENGTH` / `NOTES_MAX_LENGTH` from here.

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

  // The check constraints — court label, name, or notes blank or over-long,
  // and an end instant that isn't after the start (a zero-length range; a
  // cross-midnight one is written with its end on the next day and clears the
  // constraint). `parseNewBooking` catches all of them first, so getting here
  // means the form and the schema have drifted apart.
  return "Something about that booking doesn't add up. Check the name, notes, court, and times.";
}

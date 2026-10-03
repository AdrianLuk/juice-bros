/**
 * Parses Backyard Club's own booking emails — a facility that runs its own
 * booking system rather than CourtReserve, so its notifications come from a
 * different sender in a different template. Built against three real
 * captured emails (see `backyard-club-email.test.ts`):
 *
 * - "You're in — <event>, <date> <time>": joining an open play or social
 *   event.
 * - "Updated — <event>, <date> <time>": that event's details changed (a real
 *   one widened the courts from 6–9 to 6–12). Carries the complete current
 *   state, not a diff — same as a CourtReserve Reservation Update Notice.
 * - "Your booking is confirmed — Court <n>, <date> <time>": an hourly court
 *   booking.
 *
 * Every template shares one body shape: an intro `<p>` (naming the event in a
 * `<strong>`, for the two event emails) followed by a details box of plain
 * `<p>` lines — date, time range and court(s), in that order for an event;
 * court first for an hourly booking. Lines are found by what they look like,
 * not by position or styling, so a restyled template or a reordered box still
 * parses. The footer's own opening-hours line ("Every day · 8:00 AM – 10:00
 * PM") looks like a time range too, which is why the time is read from the
 * line right after the date rather than from the first range anywhere.
 *
 * Results come back in `parseCourtReserveEmail`'s own result shape, so the
 * review, matching and confirm steps downstream handle a Backyard Club
 * email exactly the way they handle a CourtReserve one. No captured
 * cancellation exists yet, so any other subject is `not_a_booking` rather
 * than a guess at a template nobody has seen.
 */

import {
  decodeHtmlEntities,
  parseTimeRange,
  type CourtReserveEmailParseResult,
} from "./courtreserve-email.ts";
import { DEFAULT_BOOKING_FORMAT } from "./bookings.ts";

export const BACKYARD_CLUB_SENDER = "bookings@thebkydclub.com";

/**
 * The facility name every parsed email carries — the sender already says
 * which facility this is, so it isn't read off the body. Matched against the
 * User's own Orgs by name, same as a CourtReserve facility.
 */
export const BACKYARD_CLUB_FACILITY_NAME = "The Backyard Club";

/** An hourly booking names no event; this stands in as its display name. */
const HOURLY_BOOKING_NAME = "Court booking";

type EmailKind = "event" | "update" | "hourly";

// Typographic or plain apostrophe — the subject is plain today, but a
// template edit swapping it would otherwise silently stop every import.
const EVENT_SUBJECT_PATTERN = /^you['’]re in\b/i;
const UPDATE_SUBJECT_PATTERN = /^updated\b/i;
const HOURLY_SUBJECT_PATTERN = /^your booking is confirmed\b/i;

function classifyBySubject(subject: string): EmailKind | null {
  const trimmed = subject.trim();
  if (EVENT_SUBJECT_PATTERN.test(trimmed)) {
    return "event";
  }
  if (UPDATE_SUBJECT_PATTERN.test(trimmed)) {
    return "update";
  }
  if (HOURLY_SUBJECT_PATTERN.test(trimmed)) {
    return "hourly";
  }
  return null;
}

function toText(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

/** Every `<p>`'s text, in document order — the details box is a run of these. */
function paragraphLines(html: string): string[] {
  return [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => toText(match[1]));
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** "Wednesday, September 23, 2026" → "2026-09-23". The weekday is optional and never checked. */
function parseLongDate(text: string): string | null {
  const match = /^(?:[a-z]+,\s*)?([a-z]+)\s+(\d{1,2}),\s*(\d{4})$/i.exec(text);
  if (!match) {
    return null;
  }

  const month = MONTHS.indexOf(match[1].toLowerCase()) + 1;
  const day = Number(match[2]);
  if (month === 0 || day < 1 || day > 31) {
    return null;
  }

  return `${match[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "Court 5" or "Courts 6, 7, 8, 9" — kept whole; `stripCourtLabelPrefix` drops the leading word downstream. */
const COURT_LINE_PATTERN = /^courts?\s+\S/i;

/** The event's name, from the intro's `<strong>` — skipping an hourly booking's own bolded "Court 5". */
function extractEventName(html: string): string | null {
  for (const match of html.matchAll(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi)) {
    const text = toText(match[1]);
    if (text && !COURT_LINE_PATTERN.test(text)) {
      return text;
    }
  }
  return null;
}

/**
 * Never throws, same contract as `parseCourtReserveEmail`: a body that won't
 * parse under a recognised subject is `unparseable`, so one odd email can't
 * take down a whole sync.
 */
export function parseBackyardClubEmail(email: {
  subject: string;
  html: string;
}): CourtReserveEmailParseResult {
  try {
    const kind = classifyBySubject(email.subject);
    if (!kind) {
      return { kind: "not_a_booking" };
    }

    const lines = paragraphLines(email.html);
    const dateIndex = lines.findIndex((line) => parseLongDate(line) !== null);
    const date = dateIndex >= 0 ? parseLongDate(lines[dateIndex]) : null;
    // The line after the date, never the first range in the body: the
    // footer's opening hours parse as a time range too.
    const timeRange = dateIndex >= 0 && lines[dateIndex + 1] ? parseTimeRange(lines[dateIndex + 1]) : null;
    const courtLabel = lines.find((line) => COURT_LINE_PATTERN.test(line)) ?? null;
    const name = kind === "hourly" ? HOURLY_BOOKING_NAME : extractEventName(email.html);

    if (!date || !timeRange || !name) {
      return { kind: "unparseable" };
    }

    const parsed = {
      facilityName: BACKYARD_CLUB_FACILITY_NAME,
      date,
      startTime: timeRange.start,
      endTime: timeRange.end,
      courtLabel,
      // None of the three templates says singles or doubles.
      format: DEFAULT_BOOKING_FORMAT,
      name,
      // None of them lists players either. An update with no players keeps
      // the Booking's own (see `ReviewItem`'s update `matchedPlayers`).
      playerNames: [],
    };

    return kind === "update" ? { kind: "update", update: parsed } : { kind: "confirmation", confirmation: parsed };
  } catch {
    return { kind: "unparseable" };
  }
}

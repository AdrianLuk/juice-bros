/**
 * The shaping primitives an Import Candidate review composition applies to a
 * single parsed reservation, whatever source that reservation came from.
 *
 * `email-sync-review.ts` was the first composition — raw CourtReserve emails →
 * `ReviewItem[]`. #288's Calendar Feed adds a second, `reviewCalendarFeed`,
 * shaping the same union from a per-Org iCal feed. Both need the identical
 * court-label handling, the identical "already on file" duplicate check, and
 * the identical past-date drop, so those live here — the one "one source →
 * `ReviewItem` boundary" both compositions sit on — rather than in the
 * email-sync modules where a feed-sourced candidate would have to reimplement
 * them (#288, developer story 36).
 *
 * Free of Next.js and Supabase imports, and of any import from the email-sync
 * modules (`courtreserve-email.ts` / `email-sync-matching.ts` /
 * `email-sync-review.ts`), on purpose: a second source reuses these without
 * taking any of that on. The `COURT_LABEL_MAX_LENGTH` / `NOTES_MAX_LENGTH`
 * schema-mirror constants still live with the rest of the Booking schema
 * mirror in `bookings.ts`; this module reads them from there.
 */

import { COURT_LABEL_MAX_LENGTH, NOTES_MAX_LENGTH } from "./bookings.ts";
import { isPastDate } from "./datetime.ts";

/**
 * A facility's own Court(s) text sometimes lists every court on one line
 * (a "Partner Play" session's confirmation can run past 40 characters),
 * which the `booking_court_length` check constraint refuses outright.
 * Rather than truncating it and losing courts a User might care about, the
 * overlong text is kept whole in Notes instead and the court label is left
 * blank — recoverable by hand from Edit Booking, same "don't block the
 * import over a parsing quirk" posture already applied to an overlong
 * player name on the review screen.
 */
export function splitOverlongCourtLabel(
  courtLabel: string | null,
): { courtLabel: string | null; notes: string | null } {
  if (!courtLabel || courtLabel.length <= COURT_LABEL_MAX_LENGTH) {
    return { courtLabel, notes: null };
  }
  return { courtLabel: null, notes: courtLabel.slice(0, NOTES_MAX_LENGTH) };
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

export type BookingIdentity = {
  orgId: string;
  courtLabel: string | null;
  date: string;
  startTime: string;
};

/**
 * A parsed confirmation that already matches an existing Booking on Org +
 * court + date/time — the exact fields a real second reservation for the
 * same slot would also share, and the ones #59 names for this check.
 */
export function isDuplicateBooking(
  candidate: BookingIdentity,
  existingBookings: readonly BookingIdentity[],
): boolean {
  return existingBookings.some(
    (booking) =>
      booking.orgId === candidate.orgId &&
      booking.courtLabel === candidate.courtLabel &&
      booking.date === candidate.date &&
      booking.startTime === candidate.startTime,
  );
}

/**
 * A confirmation for a date/time that's already passed, filtered out
 * automatically (#59) so a first sync doesn't dump irrelevant history into
 * the review queue. Reuses `isPastDate`'s existing coarse, calendar-day-only
 * check rather than a second notion of "past" — same reasoning `datetime.ts`
 * already documents there.
 */
export function isPastConfirmation(
  confirmation: { date: string },
  zone: string,
  now: Date,
): boolean {
  return isPastDate(confirmation.date, zone, now);
}

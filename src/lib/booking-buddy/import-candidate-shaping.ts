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
 * The court *number* a label names — `"#9 - Hard"` → `"9"`, `"Court 10"` →
 * `"10"`, `"#09"` → `"9"` — or `null` when there's no number in it at all.
 *
 * This exists because the two import sources write the same court differently
 * (issue #432). A CourtReserve confirmation email's Court(s) section carries
 * the surface too (`"Court #9 - Hard"`); the calendar feed's DESCRIPTION
 * carries only `"Court #9"`. Compared as text they never agree, so the
 * four-field identity below could never recognise one source's reservation in
 * the other's — the feed re-offered every email-imported Booking, stripped of
 * its Players, and the email re-offered every feed-imported one.
 *
 * Only the first run of digits is read. A multi-court label (a Partner Play
 * session's `"#4, Court #5, Court #6"`) reduces to its first court, but those
 * run past `COURT_LABEL_MAX_LENGTH` and `splitOverlongCourtLabel` has already
 * folded them into notes with a null label by the time anything compares them.
 */
export function courtNumber(courtLabel: string | null): string | null {
  if (!courtLabel) {
    return null;
  }
  const digits = /\d+/.exec(courtLabel);
  // Through `Number` so `"#09"` and `"#9"` are the same court.
  return digits ? String(Number(digits[0])) : null;
}

/**
 * Whether two records name the same real reservation: same Org, same calendar
 * day, same start time, and — when both sides name a court at all — the same
 * court number.
 *
 * A side with no readable court number matches any court in that slot. That is
 * the deliberate half: a Booking typed in by hand with no court noted, and a
 * feed event on Court #9 at the same Org and time, are one reservation, and
 * treating them as two is the failure this is here to stop. Court is kept in
 * the key at all (rather than dropped, which would be simpler) because same
 * Org, same time, different court is a real distinction — `mergeImportCandidates`
 * documents refusing to guess in exactly that case.
 */
export function isSameReservation(a: BookingIdentity, b: BookingIdentity): boolean {
  if (a.orgId !== b.orgId || a.date !== b.date || a.startTime !== b.startTime) {
    return false;
  }
  const aCourt = courtNumber(a.courtLabel);
  const bCourt = courtNumber(b.courtLabel);
  return aCourt === null || bCourt === null || aCourt === bCourt;
}

/**
 * The existing Booking a parsed confirmation refers to, or `undefined` when
 * none does — the fields a real second reservation for the same slot would
 * also share (#59), compared across sources by `isSameReservation`.
 *
 * Returns the Booking rather than a boolean because the feed review needs its
 * `id` for the auto-link; `isDuplicateBooking` is the yes/no wrapper the email
 * review reads.
 */
export function findSameReservation<T extends BookingIdentity>(
  candidate: BookingIdentity,
  existingBookings: readonly T[],
): T | undefined {
  return existingBookings.find((booking) => isSameReservation(candidate, booking));
}

/** `findSameReservation` as a yes/no — a candidate that's already on file. */
export function isDuplicateBooking(
  candidate: BookingIdentity,
  existingBookings: readonly BookingIdentity[],
): boolean {
  return findSameReservation(candidate, existingBookings) !== undefined;
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

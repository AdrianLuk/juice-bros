/**
 * Matches a parsed CourtReserve email (`courtreserve-email.ts`) against a
 * User's own Orgs, Bookings and Connections (issue #63, second half of #59's
 * first slice). Kept free of Next.js/Supabase imports, same as its sibling —
 * callers resolve the real rows and hand in plain data, ready to be wired
 * into the live sync/review flow by a later ticket (#64).
 */

import { isPastDate } from "./datetime.ts";

export type OrgCandidate = { orgId: string; displayName: string };

/**
 * Case-folded and separator-insensitive, since CourtReserve's own template
 * and a User's hand-typed Org display name are two independent sources for
 * what's nominally the same facility name — e.g. a confirmation email's
 * "HISPORTS - Stouffville" should still resolve to an Org named "HISPORTS
 * Stouffville". Collapses anything that isn't a letter or digit (spaces,
 * hyphens, dashes, punctuation) down to a single space before comparing, so
 * only the underlying words have to line up. Anything short of that still
 * leaves the Org picker for the User to resolve by hand, the documented
 * fallback (#59).
 */
function normalizeFacilityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchOrgByName(
  facilityName: string,
  orgs: readonly OrgCandidate[],
): string | null {
  const normalized = normalizeFacilityName(facilityName);
  if (!normalized) {
    return null;
  }
  const match = orgs.find((org) => normalizeFacilityName(org.displayName) === normalized);
  return match?.orgId ?? null;
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

export type CancellationIdentity = { orgId: string; date: string; startTime: string };

/**
 * The existing Booking a parsed cancellation refers to, or `null` if none —
 * or more than one — matches (issue #65). The review screen surfaces `null`
 * as a distinct "no match found" notice rather than silently dropping the
 * cancellation, or, for the ambiguous case, rather than guessing which
 * Booking to remove.
 *
 * Deliberately Org + date/time only, *not* + court like `isDuplicateBooking`:
 * courtreserve-email.ts's own header documents that a real cancellation email
 * carries no Court(s) section at all, so `CourtReserveCancellation.courtLabel`
 * is always null. Matching on it too would mean a cancellation could never
 * match a Booking that has a real court label logged — Org + date + start
 * time is what the data actually supports. The cost is that two Bookings at
 * the same Org, date and start time (e.g. two courts reserved for one group
 * session) are indistinguishable from this cancellation's own fields — this
 * function refuses to guess between them rather than risk deleting the
 * wrong, still-valid one; the "no match found" notice leaves it for the User
 * to resolve by hand.
 */
export function matchCancellationToBooking(
  cancellation: CancellationIdentity,
  existingBookings: readonly (CancellationIdentity & { id: string })[],
): string | null {
  const matches = existingBookings.filter(
    (booking) =>
      booking.orgId === cancellation.orgId &&
      booking.date === cancellation.date &&
      booking.startTime === cancellation.startTime,
  );
  return matches.length === 1 ? matches[0].id : null;
}

export type ConnectionCandidate = { userId: string; displayName: string };

export type PlayerMatch = {
  /** The raw name as the email listed it. */
  name: string;
  /** The Connection it matched, or null if none did. */
  userId: string | null;
};

/**
 * Matches parsed player names against a User's Connections, for reference
 * only (#59: never invites anyone, never creates anything from this match).
 * Display names aren't unique — two seeded local accounts deliberately share
 * one (docs/local-test-accounts.md) — so a name matching more than one
 * Connection resolves to the first, the same "best-effort, informational"
 * posture the rest of this match already carries; nothing downstream acts on
 * it authoritatively enough for the ambiguity to matter.
 */
export function matchPlayerNamesToConnections(
  playerNames: readonly string[],
  connections: readonly ConnectionCandidate[],
): PlayerMatch[] {
  return playerNames.map((name) => {
    const normalized = name.trim().toLowerCase();
    const match = connections.find(
      (connection) => connection.displayName.trim().toLowerCase() === normalized,
    );
    return { name, userId: match?.userId ?? null };
  });
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

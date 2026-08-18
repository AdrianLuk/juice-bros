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
 * Exact match only, per the ticket's own acceptance criterion — not
 * case-folded or fuzzy, unlike Username's lower(username) uniqueness.
 * Anything short of the email's facility name matching an Org's own
 * resolved display name (`orgDisplayName`) exactly leaves the Org picker for
 * the User to resolve by hand, which is the documented fallback (#59).
 */
export function matchOrgByExactName(
  facilityName: string,
  orgs: readonly OrgCandidate[],
): string | null {
  const trimmed = facilityName.trim();
  const match = orgs.find((org) => org.displayName.trim() === trimmed);
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

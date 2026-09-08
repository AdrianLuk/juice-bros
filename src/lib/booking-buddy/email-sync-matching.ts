/**
 * Matches a parsed CourtReserve email (`courtreserve-email.ts`) against a
 * User's own Orgs, Bookings and Connections (issue #63, second half of #59's
 * first slice). Kept free of Next.js/Supabase imports, same as its sibling —
 * callers resolve the real rows and hand in plain data, ready to be wired
 * into the live sync/review flow by a later ticket (#64).
 *
 * The source-agnostic Import Candidate shaping — the Org + court + date/time
 * duplicate check, the calendar-day past-date drop, the court-label handling —
 * lives in `import-candidate-shaping.ts`, shared with the Calendar Feed's own
 * review composition (#288).
 */

import { courtNumber } from "./import-candidate-shaping.ts";

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

/**
 * The existing Booking a parsed Reservation Update refers to, or `null` if
 * none — or more than one — matches. Deliberately Org + date/time only, same
 * shape and same "refuse to guess" reasoning as `matchCancellationToBooking`
 * above, even though an update *does* carry a real court label (unlike a
 * cancellation): requiring court equality here would mean a genuine court
 * change could never be matched at all, and the whole point of surfacing an
 * update candidate is to let the User apply exactly that kind of change to
 * the Booking already on file.
 *
 * An update that moved its *start time* can't be matched here at all, since
 * the start time is the key — `suggestUpdateBookingMatches` below is the
 * fallback for that, and it hands the choice to the User rather than making
 * one here (issue #458).
 */
export function matchUpdateToBooking(
  update: CancellationIdentity,
  existingBookings: readonly (CancellationIdentity & { id: string })[],
): string | null {
  const matches = existingBookings.filter(
    (booking) =>
      booking.orgId === update.orgId && booking.date === update.date && booking.startTime === update.startTime,
  );
  return matches.length === 1 ? matches[0].id : null;
}

/** A reservation's whole span, not just the instant it starts — what a suggested match is scored on. */
export type UpdateSlot = {
  orgId: string;
  date: string;
  startTime: string;
  endTime: string;
  courtLabel: string | null;
};

/** How many Bookings a single unmatched update offers at once — a facility-day with more plausible bookings than this is past the point where a picker helps. */
const MAX_SUGGESTED_MATCHES = 3;

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Minutes from midnight for a range's end, bumped a day when the range runs past midnight — the same "an End at or before the Start is tomorrow" rule the write path applies (`bookingInstants`). */
function endMinutes(slot: { startTime: string; endTime: string }): number {
  const start = toMinutes(slot.startTime);
  const end = toMinutes(slot.endTime);
  return end <= start ? end + 24 * 60 : end;
}

function overlaps(a: UpdateSlot, b: UpdateSlot): boolean {
  return toMinutes(a.startTime) < endMinutes(b) && toMinutes(b.startTime) < endMinutes(a);
}

/**
 * How strongly a Booking looks like the one an update refers to: the same
 * court counts for more than an overlapping time, since a facility moving a
 * reservation usually keeps one of the two, and the court is the harder of
 * them to coincide by accident.
 */
function suggestionScore(update: UpdateSlot, booking: UpdateSlot): number {
  const updateCourt = courtNumber(update.courtLabel);
  const bookingCourt = courtNumber(booking.courtLabel);
  const sameCourt = updateCourt !== null && updateCourt === bookingCourt;
  return (sameCourt ? 2 : 0) + (overlaps(update, booking) ? 1 : 0);
}

/**
 * The Bookings an unmatched Reservation Update might be about, best first
 * (issue #458) — offered to the User to confirm, never applied on their
 * behalf.
 *
 * `matchUpdateToBooking` above keys on Org + date + exact start time, which
 * is what makes its "refuse to guess" rule cheap: either exactly one Booking
 * is on that slot or nothing is applied. The gap it leaves is the update that
 * *moved the time* — a reservation logged 12:00–14:00 and updated to
 * 13:00–15:00 has no Booking at 13:00 to find, so the review screen could
 * only say "no matching booking found" about the very Booking sitting right
 * there on the same day and court.
 *
 * So: same Org and same calendar day is the whole filter, and the ordering
 * carries the judgement — same court and an overlapping time first, then one
 * or the other, then merely the same day, with the nearest start time
 * breaking ties. Everything on that day is offered rather than only what
 * scores, because a facility can move a reservation's court *and* its time at
 * once, and the User reads the before/after on the card before confirming.
 * The guess is theirs to make, which is exactly what the exact-match rule
 * refuses to do on its own.
 *
 * `takenBookingIds` are Bookings another candidate in the same batch already
 * resolved to exactly; offering one of those as a maybe would be inviting the
 * User to point two emails at one Booking.
 */
export function suggestUpdateBookingMatches<T extends UpdateSlot & { id: string }>(
  update: UpdateSlot,
  existingBookings: readonly T[],
  takenBookingIds: readonly string[] = [],
): T[] {
  const taken = new Set(takenBookingIds);

  return existingBookings
    .filter(
      (booking) =>
        booking.orgId === update.orgId && booking.date === update.date && !taken.has(booking.id),
    )
    .map((booking) => ({
      booking,
      score: suggestionScore(update, booking),
      distance: Math.abs(toMinutes(booking.startTime) - toMinutes(update.startTime)),
    }))
    .sort((a, b) => b.score - a.score || a.distance - b.distance)
    .slice(0, MAX_SUGGESTED_MATCHES)
    .map((scored) => scored.booking);
}

/**
 * One parsed CourtReserve email, reduced to what reconciliation needs to
 * group and order it — issue #88. `facilityName`/`date`/`startTime` are the
 * same identity fields `matchCancellationToBooking` already keys a
 * cancellation on (no court label, since a real cancellation email never
 * carries one); `receivedAt` is the Gmail message's own `internalDate`, not
 * fetch/search order, since Gmail doesn't promise either is chronological.
 * `confirmation` rides along opaquely so this stays generic over whatever
 * shape a caller's own confirmation payload is.
 */
export type ReconciliationEvent<TConfirmation> =
  | {
      kind: "confirmation";
      gmailMessageId: string;
      receivedAt: number;
      facilityName: string;
      date: string;
      startTime: string;
      confirmation: TConfirmation;
    }
  | {
      kind: "cancellation";
      gmailMessageId: string;
      receivedAt: number;
      facilityName: string;
      date: string;
      startTime: string;
      /** Carried through for display only — not part of the identity a cancellation groups/nets on (see the module header comment). */
      courtLabel: string | null;
    }
  | {
      kind: "update";
      gmailMessageId: string;
      receivedAt: number;
      facilityName: string;
      date: string;
      startTime: string;
      /** Same shape as `confirmation` above — a real "Reservation Update Notice" carries the complete current state, not a diff (courtreserve-email.ts's own `CourtReserveUpdate` header comment). */
      update: TConfirmation;
    };

export type ReconciliationResult<TConfirmation> = {
  confirmations: Extract<ReconciliationEvent<TConfirmation>, { kind: "confirmation" }>[];
  cancellations: Extract<ReconciliationEvent<TConfirmation>, { kind: "cancellation" }>[];
  /** An update with no single in-batch confirmation to net against — left for the caller's own matching against real Bookings, same posture an unresolved cancellation already has. */
  updates: Extract<ReconciliationEvent<TConfirmation>, { kind: "update" }>[];
};

function reconciliationKey(event: { facilityName: string; date: string; startTime: string }): string {
  return `${normalizeFacilityName(event.facilityName)}|${event.date}|${event.startTime}`;
}

/**
 * Nets a confirm/cancel/update/... chain for the same real-world slot down
 * to its actual end state (issue #88, extended for updates) — editing a
 * CourtReserve reservation (e.g. adding a player) resends both a
 * cancellation and a fresh confirmation for the same Org/date/start-time,
 * and a Reservation Update Notice resends a revised confirmation-shaped
 * email in place of that pair for some kinds of edits, so a slot edited
 * more than once can show up as several raw emails even though nothing
 * about it needs a User's review except the final state.
 *
 * Replays each identity group in received-time order: a cancellation with
 * exactly one still-active confirmation ahead of it nets both away; an
 * update with exactly one still-active confirmation ahead of it *replaces*
 * that confirmation's own fields with the update's (the update's own
 * `gmailMessageId` becomes the survivor's, same "only the surviving id gets
 * recorded" posture #88 already established for a netted cancel/confirm
 * pair); either one with zero or more-than-one active confirmation is left
 * in `cancellations`/`updates` untouched, for the caller's own existing
 * per-email logic to resolve — zero because there's nothing in this batch
 * for it to refer to (it might still match a *real* Booking from a previous
 * sync), and more than one for the same reason `matchCancellationToBooking`
 * itself refuses to guess between two simultaneous Bookings.
 */
export function reconcileCourtReserveEvents<TConfirmation>(
  events: readonly ReconciliationEvent<TConfirmation>[],
): ReconciliationResult<TConfirmation> {
  const groups = new Map<string, ReconciliationEvent<TConfirmation>[]>();
  for (const event of events) {
    const key = reconciliationKey(event);
    const group = groups.get(key);
    if (group) {
      group.push(event);
    } else {
      groups.set(key, [event]);
    }
  }

  const confirmations: Extract<ReconciliationEvent<TConfirmation>, { kind: "confirmation" }>[] = [];
  const cancellations: Extract<ReconciliationEvent<TConfirmation>, { kind: "cancellation" }>[] = [];
  const updates: Extract<ReconciliationEvent<TConfirmation>, { kind: "update" }>[] = [];

  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.receivedAt - b.receivedAt);
    const active: Extract<ReconciliationEvent<TConfirmation>, { kind: "confirmation" }>[] = [];

    for (const event of sorted) {
      if (event.kind === "confirmation") {
        active.push(event);
        continue;
      }

      if (event.kind === "update") {
        if (active.length === 1) {
          const { gmailMessageId, receivedAt, facilityName, date, startTime, update } = event;
          active[0] = { kind: "confirmation", gmailMessageId, receivedAt, facilityName, date, startTime, confirmation: update };
        } else {
          updates.push(event);
        }
        continue;
      }

      if (active.length === 1) {
        active.pop();
      } else {
        cancellations.push(event);
      }
    }

    confirmations.push(...active);
  }

  return { confirmations, cancellations, updates };
}

export type ConnectionCandidate = { userId: string; displayName: string };

/**
 * `listConnections()`'s `friends` list, narrowed to what matching needs —
 * shared by `actions/bookings.ts` and `actions/email-sync.ts` so the two
 * don't drift apart. A friend with no display name (never set one) can't
 * match anything by name, so it's dropped rather than matched against an
 * empty string.
 */
export function connectionCandidatesFromFriends(
  friends: readonly { userId: string; displayName: string | null }[],
): ConnectionCandidate[] {
  return friends
    .filter((friend): friend is typeof friend & { displayName: string } => friend.displayName !== null)
    .map((friend) => ({ userId: friend.userId, displayName: friend.displayName }));
}

export type PlayerMatch = {
  /** The raw name as the email listed it. */
  name: string;
  /** The Connection it matched, or null if none did. */
  userId: string | null;
};

/**
 * Matches parsed player names against a User's Connections — originally for
 * reference only on the email-review screen (#59), now also the write-time
 * match a persisted Player's `connection_user_id` is resolved from and stored
 * against for good (issue #99, ADR 0011).
 *
 * Display names aren't unique — two seeded local accounts deliberately share
 * one (docs/local-test-accounts.md) — so a name matching more than one
 * Connection resolves unlinked (`userId: null`) rather than guessed at.
 * Disposable on a review screen, a guess here would be a standing, permanent
 * misattribution nobody reviews again (ADR 0011); under-linking is
 * recoverable by hand, over-linking is not.
 */
export function matchPlayerNamesToConnections(
  playerNames: readonly string[],
  connections: readonly ConnectionCandidate[],
): PlayerMatch[] {
  return playerNames.map((name) => {
    const normalized = name.trim().toLowerCase();
    const matches = connections.filter(
      (connection) => connection.displayName.trim().toLowerCase() === normalized,
    );
    return { name, userId: matches.length === 1 ? matches[0].userId : null };
  });
}

export type ExistingBookingPlayer = { id: string; name: string; userId: string | null };

/**
 * Splits a Booking edit's submitted player names against its existing
 * `booking_players` rows (matched one-for-one by name, not id — a repeated
 * name pairs off in whatever order the rows are given, so a caller ordering
 * by `created_at` gets a deterministic "earliest-added duplicate keeps its
 * link" rule rather than an arbitrary one) into a row-level diff:
 * `keepIds`, existing rows an unchanged submitted name pairs with — left
 * completely untouched, never even rewritten, so ADR 0011's "resolved once"
 * link can't be lost to an unrelated failure; `toMatch`, names with no
 * existing row left to pair with — newly added, or a Player's name edited —
 * that still need running through `matchPlayerNamesToConnections` and then
 * inserting; and `removeIds`, existing rows no submitted name claimed
 * (dropped by the User, or an extra duplicate beyond what's kept), the only
 * rows this edit deletes (issue #101).
 */
export function diffBookingPlayers(
  submittedNames: readonly string[],
  existing: readonly ExistingBookingPlayer[],
): { keepIds: string[]; toMatch: string[]; removeIds: string[] } {
  const remainingByName = new Map<string, ExistingBookingPlayer[]>();
  for (const player of existing) {
    const bucket = remainingByName.get(player.name);
    if (bucket) {
      bucket.push(player);
    } else {
      remainingByName.set(player.name, [player]);
    }
  }

  const keepIds: string[] = [];
  const toMatch: string[] = [];

  for (const name of submittedNames) {
    const bucket = remainingByName.get(name);
    const paired = bucket?.shift();
    if (paired) {
      keepIds.push(paired.id);
    } else {
      toMatch.push(name);
    }
  }

  const removeIds = [...remainingByName.values()].flat().map((player) => player.id);

  return { keepIds, toMatch, removeIds };
}

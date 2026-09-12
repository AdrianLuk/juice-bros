import type {
  Entrant,
  EntrantId,
  PrizeId,
  PrizeStanding,
  RaffleEvent,
  RaffleState,
} from "./types.ts";

/** The night before anything has happened. */
export const EMPTY: RaffleState = {
  entrants: [],
  prizes: [],
  onePrizePerPerson: true,
};

/**
 * The whole screen, folded out of the log. Pure: no clock, no `Math.random`,
 * no reading anything but its arguments, which is what makes Undo "drop the
 * last event and fold again" rather than a second set of inverse operations.
 */
export function reduceRaffle(events: readonly RaffleEvent[]): RaffleState {
  return events.reduce(applyEvent, EMPTY);
}

function applyEvent(state: RaffleState, event: RaffleEvent): RaffleState {
  switch (event.type) {
    case "ENTRANT_ADDED":
      return {
        ...state,
        entrants: [
          ...state.entrants,
          { id: event.id, name: event.name, tickets: clampTickets(event.tickets) },
        ],
      };

    case "TICKETS_SET":
      return {
        ...state,
        entrants: state.entrants.map((entrant) =>
          entrant.id === event.id
            ? { ...entrant, tickets: clampTickets(event.tickets) }
            : entrant,
        ),
      };

    /**
     * Removing an Entrant does not rewrite the Prizes they already hold. A
     * draw that happened, happened, and a log that quietly un-draws it is a log
     * nobody can check. The screen shows such a Prize as held by a name no
     * longer in the list, which is the truth and is visibly odd enough to fix.
     */
    case "ENTRANT_REMOVED":
      return {
        ...state,
        entrants: state.entrants.filter((entrant) => entrant.id !== event.id),
      };

    case "PRIZE_ADDED":
      return {
        ...state,
        prizes: [
          ...state.prizes,
          { id: event.id, name: event.name, winnerId: null, seed: null, skipped: [] },
        ],
      };

    case "PRIZE_REMOVED":
      return {
        ...state,
        prizes: state.prizes.filter((prize) => prize.id !== event.id),
      };

    case "DRAWN":
      return mapPrize(state, event.prizeId, (prize) => ({
        ...prize,
        winnerId: event.entrantId,
        seed: event.seed,
      }));

    /**
     * A redraw clears the standing winner and adds them to `skipped`, which is
     * both the audit trail and the thing that keeps them out of the next
     * bucket for this Prize. It never removes them from the night: they are
     * still in for every other Prize.
     */
    case "REDRAWN":
      return mapPrize(state, event.prizeId, (prize) =>
        prize.winnerId === event.entrantId
          ? {
              ...prize,
              winnerId: null,
              seed: null,
              skipped: [...prize.skipped, event.entrantId],
            }
          : prize,
      );

    case "ONE_PRIZE_PER_PERSON_SET":
      return { ...state, onePrizePerPerson: event.value };
  }
}

function mapPrize(
  state: RaffleState,
  prizeId: PrizeId,
  change: (prize: PrizeStanding) => PrizeStanding,
): RaffleState {
  return {
    ...state,
    prizes: state.prizes.map((prize) => (prize.id === prizeId ? change(prize) : prize)),
  };
}

/** Tickets are whole and never negative; a bad number means none, not a crash. */
function clampTickets(tickets: number): number {
  return Number.isFinite(tickets) ? Math.max(0, Math.floor(tickets)) : 0;
}

/**
 * Who is in the bucket for one Prize, in Roster order so a given seed always
 * picks the same name. Three things take someone out: no tickets, already sent
 * back from this Prize, and — while one-prize-per-person is on — already
 * holding another.
 */
export function eligibleFor(state: RaffleState, prizeId: PrizeId): Entrant[] {
  const prize = state.prizes.find((candidate) => candidate.id === prizeId);
  if (!prize) return [];

  const skipped = new Set<EntrantId>(prize.skipped);
  const holders = new Set<EntrantId>(
    state.onePrizePerPerson
      ? state.prizes
          .filter((other) => other.id !== prizeId && other.winnerId !== null)
          .map((other) => other.winnerId as EntrantId)
      : [],
  );

  return state.entrants.filter(
    (entrant) =>
      entrant.tickets > 0 && !skipped.has(entrant.id) && !holders.has(entrant.id),
  );
}

/** Tickets in a bucket, which is what the room wants to hear before a draw. */
export function ticketsIn(entrants: readonly Entrant[]): number {
  return entrants.reduce((total, entrant) => total + entrant.tickets, 0);
}

/** The first Prize with nobody holding it, which is the one to draw next. */
export function nextPrize(state: RaffleState): PrizeStanding | null {
  return state.prizes.find((prize) => prize.winnerId === null) ?? null;
}

export function entrantById(
  state: RaffleState,
  id: EntrantId | null,
): Entrant | null {
  if (id === null) return null;
  return state.entrants.find((entrant) => entrant.id === id) ?? null;
}

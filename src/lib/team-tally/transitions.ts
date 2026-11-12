/**
 * The two transitions a night makes by itself (team-tally/CONTEXT.md,
 * "Matchup done" and "Seeding"), ported from the database so a Team Event
 * can run with no database at all (the demo night, issue #631):
 *
 * - the last opening Matchup done places the Flights
 *   (`team_tally_finish_matchup` calling `team_tally_seed_flights`);
 * - the last Flight Matchup done ends the night;
 *
 * and the Organizer's two moves on it, End the night and Resume the night.
 *
 * The database stays the authority for a real night. `transitions.db-test.ts`
 * plays the same night through both and checks they agree, so a change to
 * either side that the other doesn't follow fails there. Pure, relative
 * imports only, for `node --test`.
 */

import {
  flightMatchups,
  openingMatchups,
  type DocGame,
  type DocMatchup,
  type GameKind,
  type Round,
  type TeamEventDoc,
} from "./event-doc.ts";
import type { WriteResult } from "./live-seam.ts";
import { doneProblem } from "./matchup-done.ts";
import { computeStandings } from "./standings.ts";

export type Transition = { ok: true; event: TeamEventDoc } | Extract<WriteResult, { ok: false }>;

const FINISHED = "This Team Event has finished, so its scores are final.";

const ROUND_GAMES: [Round, GameKind][] = [
  [1, "captains"],
  [1, "teammates"],
  [2, "captains"],
  [2, "teammates"],
  [3, "captains"],
  [3, "teammates"],
];

/** Six unscored Games, Round order, captains' game first. */
function freshGames(matchupId: string): DocGame[] {
  return ROUND_GAMES.map(([round, kind]) => ({
    id: `${matchupId}-r${round}-${kind}`,
    round,
    kind,
    redScore: null,
    blueScore: null,
    lastEditedByKind: null,
    lastEditedByTeamId: null,
  }));
}

/**
 * Places the Flights from the opening standings as they stand: seeds 1 and 2
 * are Flight A on Match 1's court pair, 3 and 4 Flight B on Match 2's, and so
 * on, the higher seed red. The caller has checked the night is still in its
 * opening round (`team_tally_seed_flights` is internal for the same reason).
 */
export function placeFlights(event: TeamEventDoc, at: string): TeamEventDoc {
  const order = computeStandings(event).map((row) => row.teamId);
  const flights: DocMatchup[] = openingMatchups(event)
    .slice()
    .sort((a, b) => a.number - b.number)
    .map((match) => {
      const id = `${event.id}-flight-${match.number}`;
      return {
        id,
        stage: "flight",
        number: match.number,
        flightLetter: String.fromCharCode(64 + match.number),
        courtPair: [match.courtPair[0], match.courtPair[1]],
        redTeamId: order[2 * match.number - 2],
        blueTeamId: order[2 * match.number - 1],
        games: freshGames(id),
        doneAt: null,
        doneByTeamId: null,
        dreambreakerWinnerId: null,
      };
    });

  return {
    ...event,
    status: "flights",
    seededAt: at,
    matchups: [...event.matchups, ...flights],
  };
}

/**
 * Marks a Matchup done as `byTeamId` (a Team, by its Score Link) or, when
 * null, the Organizer. Refused, in the database's words, while it can't be
 * done. The last opening Matchup done places the Flights; the last Flight
 * Matchup done ends the night.
 */
export function finishMatchup(
  event: TeamEventDoc,
  matchupId: string,
  byTeamId: string | null,
  at: string,
): Transition {
  const matchup = event.matchups.find((candidate) => candidate.id === matchupId);
  if (!matchup) return { ok: false, problem: "Matchup not found" };
  if (event.status === "finished") return { ok: false, problem: FINISHED };

  const problem = doneProblem(matchup);
  if (problem) return { ok: false, problem };

  const marked: TeamEventDoc = {
    ...event,
    matchups: event.matchups.map((candidate) =>
      candidate.id === matchupId ? { ...candidate, doneAt: at, doneByTeamId: byTeamId } : candidate,
    ),
  };

  if (matchup.stage === "opening") {
    const lastOpening = event.status === "opening" && openingMatchups(marked).every((m) => m.doneAt !== null);
    return { ok: true, event: lastOpening ? placeFlights(marked, at) : marked };
  }

  const lastFlight = flightMatchups(marked).every((m) => m.doneAt !== null);
  return { ok: true, event: lastFlight ? { ...marked, status: "finished" } : marked };
}

/**
 * The Organizer ends a night that is in its Flights (issue #684), whether or
 * not every Flight was played out. Each open Flight that could be marked done
 * is (all six Games in, a Dreambreaker winner if tied), by the Organizer;
 * every other open Flight stays open with its scores as they were, and its
 * places stay blank in Final places. Mirrors `team_tally_organizer_end_event`.
 */
export function endNight(event: TeamEventDoc, at: string): Transition {
  if (event.status === "opening") return { ok: false, problem: "The Flights aren't placed yet." };
  if (event.status === "finished") return { ok: false, problem: "This Team Event has already finished." };

  return {
    ok: true,
    event: {
      ...event,
      status: "finished",
      matchups: event.matchups.map((matchup) =>
        matchup.stage === "flight" && matchup.doneAt === null && doneProblem(matchup) === null
          ? { ...matchup, doneAt: at, doneByTeamId: null }
          : matchup,
      ),
    },
  };
}

/**
 * The Organizer puts an ended night back in its Flights (issue #684). Only
 * while a Flight is still open: a night that finished on its own has every
 * Flight done, and reopening one of those already brings it back. Flights that
 * End the night marked done stay done. Mirrors `team_tally_organizer_resume_event`.
 */
export function resumeNight(event: TeamEventDoc): Transition {
  if (event.status !== "finished") return { ok: false, problem: "This Team Event is still running." };
  if (flightMatchups(event).every((flight) => flight.doneAt !== null)) {
    return { ok: false, problem: "Every Flight is done. Reopen a Flight to play it again." };
  }
  return { ok: true, event: { ...event, status: "flights" } };
}

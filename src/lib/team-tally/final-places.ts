/**
 * Flight results and Final places (team-tally/CONTEXT.md, "Final places"):
 * every Team's finishing position once the Flights are played. Flight A's
 * champion is first, its runner-up second, Flight B's champion third, and
 * down. Read off the Flight Matchups as they stand, so a Flight still in play
 * leaves its two places open instead of letting later Flights slide up.
 *
 * Relative imports only, for `node --test`.
 */

import type { DocMatchup, TeamEventDoc } from "./event-doc.ts";
import { matchupTotals, matchupWinnerId, needsDreambreaker } from "./matchup-done.ts";

/** A done Flight Matchup: who took the Flight, and the score they took it by. */
export type FlightResult = {
  flightLetter: string;
  matchupId: string;
  championId: string;
  runnerUpId: string;
  /** The champion's Team score in the Flight Matchup. */
  championScore: number;
  /** The runner-up's Team score. Equal to the champion's when a Dreambreaker decided it. */
  runnerUpScore: number;
  decidedByDreambreaker: boolean;
};

export type FinalPlace = {
  /** 1 and up. */
  place: number;
  teamId: string;
  flightLetter: string;
  role: "champion" | "runner-up";
};

type Flights = Pick<TeamEventDoc, "matchups">;

function resultOf(matchup: DocMatchup): FlightResult | null {
  if (matchup.stage !== "flight" || !matchup.doneAt || !matchup.flightLetter) return null;
  const championId = matchupWinnerId(matchup);
  if (!championId) return null;

  const totals = matchupTotals(matchup);
  const championIsRed = championId === matchup.redTeamId;
  return {
    flightLetter: matchup.flightLetter,
    matchupId: matchup.id,
    championId,
    runnerUpId: championIsRed ? matchup.blueTeamId : matchup.redTeamId,
    championScore: championIsRed ? totals.red : totals.blue,
    runnerUpScore: championIsRed ? totals.blue : totals.red,
    decidedByDreambreaker: needsDreambreaker(matchup),
  };
}

/** Every done Flight Matchup's result, Flight A first. */
export function flightResults(event: Flights): FlightResult[] {
  return event.matchups
    .map(resultOf)
    .filter((result): result is FlightResult => result !== null)
    .sort((a, b) => a.flightLetter.localeCompare(b.flightLetter));
}

/** Final places for every Team in a done Flight: Flight N's champion is 2N-1th, its runner-up 2N-th. */
export function finalPlaces(event: Flights): FinalPlace[] {
  return flightResults(event).flatMap((result) => {
    const first = (result.flightLetter.charCodeAt(0) - 65) * 2 + 1;
    return [
      { place: first, teamId: result.championId, flightLetter: result.flightLetter, role: "champion" as const },
      { place: first + 1, teamId: result.runnerUpId, flightLetter: result.flightLetter, role: "runner-up" as const },
    ];
  });
}

/** "1st", "2nd", "3rd", "11th": for a place read aloud. */
export function ordinal(place: number): string {
  const tens = place % 100;
  if (tens >= 11 && tens <= 13) return `${place}th`;
  switch (place % 10) {
    case 1:
      return `${place}st`;
    case 2:
      return `${place}nd`;
    case 3:
      return `${place}rd`;
    default:
      return `${place}th`;
  }
}

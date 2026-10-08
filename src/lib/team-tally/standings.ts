/**
 * The standings, computed on read from the Game rows (team-tally ADR 0001):
 * each Team's Team score (every point across its Matchup's six Games), Games
 * won and point differential, ranked by Seeding's own rules (seeding.ts), so
 * the tower the room watches is the order Flights will be placed in.
 *
 * Once Flights are placed they stay placed. A corrected opening score still
 * re-sorts these standings, and `standingsMoved` says they no longer match
 * the Flights. Relative imports only, for `node --test`.
 */

import {
  flightMatchups,
  isScored,
  openingMatchups,
  roundPoints,
  sideOf,
  teamName,
  type DocMatchup,
  type Side,
  type TeamEventDoc,
} from "./event-doc.ts";
import { matchupWinnerId } from "./matchup-done.ts";
import { seedTeams, type SeedEntry, type TieRule } from "./seeding.ts";

export type StandingRow = {
  position: number;
  teamId: string;
  name: string;
  /** The Team's side in its Matchup, as the brief colours it. */
  side: Side;
  rounds: [number | null, number | null, number | null];
  teamScore: number;
  gamesWon: number;
  pointDiff: number;
  /** The Flight this position seeds into. */
  flightLetter: string;
  /** What separated this Team from the one above it; null for the top row. */
  decidedBy: TieRule | null;
};

/** The opening round's standings: one row per Team that has an opening Matchup. */
export function computeStandings(event: TeamEventDoc): StandingRow[] {
  const opening = openingMatchups(event);

  const rows = new Map<string, Omit<StandingRow, "position" | "flightLetter" | "decidedBy">>();
  const entries: SeedEntry[] = [];

  event.teams.forEach((team, setupIndex) => {
    const matchup = opening.find((candidate) => sideOf(candidate, team.id));
    if (!matchup) return;
    const side = sideOf(matchup, team.id)!;
    const row = rowFor(matchup, side, team.id, teamName(team));
    rows.set(team.id, row);

    const winner = matchupWinnerId(matchup);
    entries.push({
      teamId: team.id,
      setupIndex,
      matchupId: matchup.id,
      teamScore: row.teamScore,
      pointDiff: row.pointDiff,
      gamesWon: row.gamesWon,
      wonMatchup: winner === null ? null : winner === team.id,
    });
  });

  return seedTeams(entries, event.tieOrder ?? []).map((seed) => ({
    ...rows.get(seed.teamId)!,
    position: seed.position,
    flightLetter: seed.flightLetter,
    decidedBy: seed.decidedBy,
  }));
}

/**
 * The order the Flights were placed in: Flight A's red Team (the higher seed)
 * then its blue, then Flight B's. Empty before Seeding.
 */
export function placedOrder(event: Pick<TeamEventDoc, "matchups">): string[] {
  return flightMatchups(event)
    .sort((a, b) => a.number - b.number)
    .flatMap((matchup) => [matchup.redTeamId, matchup.blueTeamId]);
}

/** True once Flights are placed and the opening standings no longer read in their order. */
export function standingsMoved(event: TeamEventDoc): boolean {
  const placed = placedOrder(event);
  if (placed.length === 0) return false;
  const now = computeStandings(event).map((row) => row.teamId);
  return now.some((teamId, index) => placed[index] !== teamId);
}

/**
 * A tie on every count across a Flight line, which only the Organizer can
 * settle: put the lower Team (`behind`) ahead of the one above it (`ahead`).
 */
export type TieCall = {
  aheadTeamId: string;
  aheadName: string;
  behindTeamId: string;
  behindName: string;
  aheadFlight: string;
  behindFlight: string;
};

/**
 * The ties the Organizer can still call. Before Seeding, any tie on every
 * count across a Flight line in the standings. After, the night has placed
 * such a tie in setup order by itself, so the call stays open while the two
 * Teams still sit either side of the line and neither Flight has a score.
 * None once the night is over. `team_tally_organizer_put_ahead` checks the
 * same in the database.
 */
export function tieCalls(event: TeamEventDoc): TieCall[] {
  if (event.status === "finished") return [];
  const standings = computeStandings(event);
  const calls: TieCall[] = [];

  standings.forEach((row, index) => {
    if (row.decidedBy !== "organizer") return;
    const above = standings[index - 1];
    calls.push({
      aheadTeamId: above.teamId,
      aheadName: above.name,
      behindTeamId: row.teamId,
      behindName: row.name,
      aheadFlight: above.flightLetter,
      behindFlight: row.flightLetter,
    });
  });

  if (event.status === "opening") return calls;

  const flights = flightMatchups(event);
  return calls.filter((call) => {
    const upper = flights.find((flight) => flight.blueTeamId === call.aheadTeamId);
    const lower = flights.find((flight) => flight.redTeamId === call.behindTeamId);
    return (
      upper !== undefined &&
      lower !== undefined &&
      lower.number === upper.number + 1 &&
      ![upper, lower].some((flight) => flight.games.some(isScored))
    );
  });
}

function rowFor(
  matchup: DocMatchup,
  side: Side,
  teamId: string,
  name: string,
): Omit<StandingRow, "position" | "flightLetter" | "decidedBy"> {
  let teamScore = 0;
  let against = 0;
  let gamesWon = 0;

  for (const game of matchup.games) {
    if (!isScored(game)) continue;
    const mine = (side === "red" ? game.redScore : game.blueScore)!;
    const theirs = (side === "red" ? game.blueScore : game.redScore)!;
    teamScore += mine;
    against += theirs;
    if (mine > theirs) gamesWon += 1;
  }

  return {
    teamId,
    name,
    side,
    rounds: roundPoints(matchup, side),
    teamScore,
    gamesWon,
    pointDiff: teamScore - against,
  };
}

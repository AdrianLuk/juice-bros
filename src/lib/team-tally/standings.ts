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
  isScored,
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
  const opening = event.matchups.filter((matchup) => matchup.stage === "opening");

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
  return event.matchups
    .filter((matchup) => matchup.stage === "flight")
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

/**
 * The standings, computed on read from the Game rows (team-tally ADR 0001):
 * each Team's Team score (every point across its Matchup's six Games), Games
 * won and point differential, sorted by Team score.
 *
 * A tie on Team score falls to point differential, then Games won, then the
 * Organizer's setup order, so the tower never flickers between equal Teams.
 * Seeding's own tie-breaks (the Matchup winner first) belong to the Flight
 * hand-off, not this live view. Relative imports only, for `node --test`.
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
};

/** The opening round's standings: one row per Team that has an opening Matchup. */
export function computeStandings(event: TeamEventDoc): StandingRow[] {
  const opening = event.matchups.filter((matchup) => matchup.stage === "opening");

  const rows = event.teams.flatMap((team, setupIndex) => {
    const matchup = opening.find((candidate) => sideOf(candidate, team.id));
    if (!matchup) return [];
    const side = sideOf(matchup, team.id)!;
    return [{ setupIndex, row: rowFor(matchup, side, team.id, teamName(team)) }];
  });

  rows.sort(
    (a, b) =>
      b.row.teamScore - a.row.teamScore ||
      b.row.pointDiff - a.row.pointDiff ||
      b.row.gamesWon - a.row.gamesWon ||
      a.setupIndex - b.setupIndex,
  );

  return rows.map(({ row }, index) => ({ ...row, position: index + 1 }));
}

function rowFor(matchup: DocMatchup, side: Side, teamId: string, name: string): Omit<StandingRow, "position"> {
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

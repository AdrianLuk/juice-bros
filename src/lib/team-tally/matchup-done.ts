/**
 * Matchup done (team-tally/CONTEXT.md, "Matchup done"): either captain's tap
 * that says a Matchup is over. It needs all six scores, and a Dreambreaker
 * winner if the Team scores are level, and it locks the Matchup until the
 * Organizer reopens it.
 *
 * Shared by the Score Link's Done control and mirrored by
 * `team_tally_done_problem` in the database, which refuses with the same
 * message. Relative imports only, for `node --test`.
 */

import { isScored, type DocMatchup } from "./event-doc.ts";

type MatchupScores = Pick<DocMatchup, "games">;

/** Each side's Team score: every point across the Matchup's Games. */
export function matchupTotals(matchup: MatchupScores): { red: number; blue: number } {
  let red = 0;
  let blue = 0;
  for (const game of matchup.games) {
    red += game.redScore ?? 0;
    blue += game.blueScore ?? 0;
  }
  return { red, blue };
}

function allScored(matchup: MatchupScores): boolean {
  return matchup.games.length === 6 && matchup.games.every(isScored);
}

/** All six Games in and the Team scores level: a Dreambreaker decides it. */
export function needsDreambreaker(matchup: MatchupScores): boolean {
  const { red, blue } = matchupTotals(matchup);
  return allScored(matchup) && red === blue;
}

/**
 * The Team that won: more points across the six Games, or on a tie the
 * Dreambreaker winner. Null while nobody has (a tie with no Dreambreaker
 * recorded). Read off the scores as they stand, done or not.
 */
export function matchupWinnerId(
  matchup: Pick<DocMatchup, "games" | "redTeamId" | "blueTeamId" | "dreambreakerWinnerId">,
): string | null {
  const { red, blue } = matchupTotals(matchup);
  if (red > blue) return matchup.redTeamId;
  if (blue > red) return matchup.blueTeamId;
  return matchup.dreambreakerWinnerId;
}

/** Why this Matchup can't be marked done yet, or null when it can. */
export function doneProblem(
  matchup: Pick<DocMatchup, "games" | "redTeamId" | "blueTeamId" | "dreambreakerWinnerId" | "doneAt">,
): string | null {
  if (matchup.doneAt) return "This Matchup is already done.";

  for (const round of [1, 2, 3] as const) {
    for (const kind of ["captains", "teammates"] as const) {
      const game = matchup.games.find((candidate) => candidate.round === round && candidate.kind === kind);
      if (!game || !isScored(game)) {
        return `Round ${round}'s ${kind === "captains" ? "captains'" : "teammates'"} game has no score yet.`;
      }
    }
  }

  const { red, blue } = matchupTotals(matchup);
  if (red === blue && !matchup.dreambreakerWinnerId) {
    return `Tied ${red}-${blue}. Record who won the Dreambreaker first.`;
  }
  return null;
}

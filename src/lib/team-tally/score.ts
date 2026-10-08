/**
 * The one rule a Game's score has to pass (team-tally/CONTEXT.md, "Game"):
 * first to 11, win by 2, or a 15-minute cap. So a score saves unless a side
 * past 11 leads by more than 2, which no Game can end on: 13-9 means the game
 * was over at 11-9. Ties and time-capped scores (12-11, 9-9, 0-0) save.
 *
 * Shared by the score form and mirrored by `team_tally_score_problem` in the
 * database, which gives the same message. Relative imports only, for
 * `node --test`.
 */

export type ScoreCheck = { ok: true } | { ok: false; problem: string };

const MAX_POINTS = 99;

function isPoints(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_POINTS;
}

/** Checks a Game's two scores, red side first, as typed. */
export function checkGameScore(red: number, blue: number): ScoreCheck {
  if (!isPoints(red) || !isPoints(blue)) {
    return { ok: false, problem: `A score is a whole number from 0 to ${MAX_POINTS}.` };
  }

  const high = Math.max(red, blue);
  const low = Math.min(red, blue);
  if (high <= 11 || high - low <= 2) {
    return { ok: true };
  }

  // Where it really ended: 11 against a loser on 9 or fewer, else two clear.
  const endHigh = low <= 9 ? 11 : low + 2;
  const ended = red > blue ? `${endHigh}-${low}` : `${low}-${endHigh}`;
  return { ok: false, problem: `${red}-${blue} can't happen: the game ends at ${ended}` };
}

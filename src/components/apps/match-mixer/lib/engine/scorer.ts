import type { Config, PlayerIndex, Round, Schedule, ScorerResult, Tally } from "./types.ts";

/**
 * The Scorer: this context's definition of "fair". Partner repeats first, Bye
 * imbalance second, opponent repeats third. Nothing else in the app may claim
 * a Schedule is balanced — the summary line and the repeat marks in the grid
 * both read what this returns for the Schedule that was actually produced.
 *
 * A change to the weights below changes what an existing Config generates —
 * the generator's search picks its winner by them — so it requires bumping
 * `GENERATOR_VERSION` in `persistence/share-link.ts`: a Share Link only
 * reproduces the board it named if the Scorer it drew from has not moved
 * under it (#494).
 */

/** A pair partnering more than once is the most visible failure, so it dominates. */
export const PARTNER_REPEAT_WEIGHT = 100;
/** Sitting out more often than everyone else is the second complaint. */
export const BYE_IMBALANCE_WEIGHT = 40;
/** Facing the same person a third time is noticeable but tolerable. */
export const OPPONENT_REPEAT_WEIGHT = 5;

/** A whist tournament has everyone opposing everyone exactly twice, so 2 is free. */
export const FREE_OPPONENT_MEETINGS = 2;

function matrix(n: number): number[][] {
  return Array.from({ length: n }, () => new Array<number>(n).fill(0));
}

export function emptyTally(n: number): Tally {
  return {
    partnerMatrix: matrix(n),
    opponentMatrix: matrix(n),
    gamesPlayed: new Array<number>(n).fill(0),
    byes: new Array<number>(n).fill(0),
  };
}

/**
 * Add one Round to a Tally, in place. This is the only place in the app that
 * counts who played with and against whom, so the generator guessing its next
 * move and the Scorer judging the finished Schedule cannot come to different
 * arithmetic.
 */
export function recordRound(tally: Tally, round: Round): void {
  const bump = (grid: number[][], a: PlayerIndex, b: PlayerIndex) => {
    grid[a][b] += 1;
    grid[b][a] += 1;
  };

  for (const game of round.games) {
    const [teamA, teamB] = game.teams;
    bump(tally.partnerMatrix, teamA[0], teamA[1]);
    bump(tally.partnerMatrix, teamB[0], teamB[1]);
    for (const x of teamA) {
      for (const y of teamB) bump(tally.opponentMatrix, x, y);
    }
    for (const p of [...teamA, ...teamB]) tally.gamesPlayed[p] += 1;
  }
  for (const p of round.byes) tally.byes[p] += 1;
}

export function tallyRounds(rounds: readonly Round[], n: number): Tally {
  const tally = emptyTally(n);
  for (const round of rounds) recordRound(tally, round);
  return tally;
}

export function scoreSchedule(schedule: Schedule, config: Config): ScorerResult {
  return scoreRounds(schedule.rounds, config.roster.length);
}

/**
 * The same reading, taken over bare Rounds. The generator scores its own
 * half-built attempts before there is a Roster or a Config to hand over, and
 * it has to be judged by exactly the function that judges the finished
 * Schedule rather than by a second opinion that might disagree.
 */
export function scoreRounds(rounds: readonly Round[], n: number): ScorerResult {
  const { partnerMatrix, opponentMatrix, gamesPlayed, byes } = tallyRounds(rounds, n);

  let cost = 0;
  let repeatedPartnerPairs = 0;
  let maxPartnerCount = 0;
  let maxOpponentCount = 0;
  let pairingsPlayed = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const partnered = partnerMatrix[i][j];
      const opposed = opponentMatrix[i][j];
      maxPartnerCount = Math.max(maxPartnerCount, partnered);
      maxOpponentCount = Math.max(maxOpponentCount, opposed);
      // Counted per pair rather than per partnership, so a repeat adds to the
      // failure above without also inflating how much of the room has met.
      if (partnered > 0) pairingsPlayed += 1;
      if (partnered > 1) {
        repeatedPartnerPairs += 1;
        cost += (partnered - 1) * PARTNER_REPEAT_WEIGHT;
      }
      if (opposed > FREE_OPPONENT_MEETINGS) {
        cost += (opposed - FREE_OPPONENT_MEETINGS) * OPPONENT_REPEAT_WEIGHT;
      }
    }
  }

  // Bye imbalance is measured off games played rather than Byes counted, so a
  // Schedule that seats someone twice in one Round can't hide behind a tidy
  // Bye list.
  const byeSpread = n === 0 ? 0 : Math.max(...gamesPlayed) - Math.min(...gamesPlayed);
  cost += byeSpread * BYE_IMBALANCE_WEIGHT;

  // Byes divide among the Roster like anything else: when the total does not
  // go round exactly, somebody has to take one more than somebody else. That
  // is arithmetic rather than a flaw, so it still counts as rotating evenly,
  // and this is the only place allowed to decide that.
  const totalByes = byes.reduce((sum, count) => sum + count, 0);
  const byesRotateEvenly =
    n === 0 || totalByes % n === 0 ? byeSpread === 0 : byeSpread <= 1;

  return {
    cost,
    partnerMatrix,
    opponentMatrix,
    gamesPlayed,
    byes,
    repeatedPartnerPairs,
    maxPartnerCount,
    maxOpponentCount,
    pairingsPlayed,
    // Floored at zero because an empty Roster works out at -0, which prints as
    // "-0" the moment the summary line interpolates it.
    pairingsPossible: Math.max(0, (n * (n - 1)) / 2),
    byeSpread,
    byesRotateEvenly,
  };
}

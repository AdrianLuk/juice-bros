import type { Config, PlayerIndex, Round, Schedule, ScorerResult } from "./types.ts";

/**
 * The Scorer: this context's definition of "fair". Partner repeats first, Bye
 * imbalance second, opponent repeats third. Nothing else in the app may claim
 * a Schedule is balanced — the summary line and the Partner Matrix both read
 * what this returns for the Schedule that was actually produced.
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
  const partnerMatrix = matrix(n);
  const opponentMatrix = matrix(n);
  const gamesPlayed = new Array<number>(n).fill(0);
  const byes = new Array<number>(n).fill(0);

  const bump = (grid: number[][], a: PlayerIndex, b: PlayerIndex) => {
    grid[a][b] += 1;
    grid[b][a] += 1;
  };

  for (const round of rounds) {
    for (const game of round.games) {
      const [teamA, teamB] = game.teams;
      bump(partnerMatrix, teamA[0], teamA[1]);
      bump(partnerMatrix, teamB[0], teamB[1]);
      for (const x of teamA) {
        for (const y of teamB) bump(opponentMatrix, x, y);
      }
      for (const p of [...teamA, ...teamB]) gamesPlayed[p] += 1;
    }
    for (const p of round.byes) byes[p] += 1;
  }

  let cost = 0;
  let repeatedPartnerPairs = 0;
  let maxPartnerCount = 0;
  let maxOpponentCount = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const partnered = partnerMatrix[i][j];
      const opposed = opponentMatrix[i][j];
      maxPartnerCount = Math.max(maxPartnerCount, partnered);
      maxOpponentCount = Math.max(maxOpponentCount, opposed);
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

  return {
    cost,
    partnerMatrix,
    opponentMatrix,
    gamesPlayed,
    byes,
    repeatedPartnerPairs,
    maxPartnerCount,
    maxOpponentCount,
    byeSpread,
  };
}

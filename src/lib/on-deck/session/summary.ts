/**
 * The Session Summary projection (issue #255).
 *
 * When the Organizer closes a Session, the event log is projected once into a
 * permanent anonymous record — attendance, Games played, court utilization,
 * wait-time distribution, longest wait, skill mix — and then the log and the
 * Player roster are purged (ADR 0001). A closed Session leaves numbers, not
 * people.
 *
 * Pure and relative-import-only, like the rest of `session/` — `node --test`
 * cannot resolve the `@/` alias. `projectSummary` folds the same event array
 * `reduceSession` does; it never reads the wall clock.
 */

import { reduceSession } from "./reduce.ts";
import { SKILL_LEVELS } from "./types.ts";
import type { SessionConfig, SessionEvent, SkillLevel } from "./types.ts";

/**
 * Wait-time buckets, in minutes: `[0, 5)`, `[5, 10)`, `[10, 20)`, `[20, 30)`,
 * `[30, ∞)`. One completed wait — a Player seated onto a Court — falls in
 * exactly one bucket.
 */
export const WAIT_BUCKETS_MIN: readonly number[] = [0, 5, 10, 20, 30];

export interface WaitBucket {
  /** Inclusive lower edge, minutes. */
  fromMin: number;
  /** Exclusive upper edge, minutes, or null for the open-ended last bucket. */
  toMin: number | null;
  count: number;
}

export interface SessionSummary {
  /** Distinct Players who joined the Session (walk-ups included). */
  attendance: number;
  /** Games played — `COURT_FINISHED` events whose Court was occupied. An empty
   * Court tapped "send next four" carries no Game and is not counted. */
  gamesPlayed: number;
  courtUtilization: {
    /** Courts the Session was configured with. */
    courtCount: number;
    /** Games played per Court, `courtCount` long, index 0 = Court 1. */
    perCourt: number[];
    /** Games played across all Courts divided by Court count — a rough
     * "how hard did the Courts work" number. */
    gamesPerCourt: number;
  };
  waitTime: {
    /** Every completed wait bucketed by `WAIT_BUCKETS_MIN`. */
    distribution: WaitBucket[];
    /** The longest single wait anyone served, in whole minutes. 0 when nobody
     * was ever seated. */
    longestWaitMin: number;
    /** The mean completed wait, in whole minutes. 0 when nobody was seated. */
    averageWaitMin: number;
    /** How many completed waits fed the distribution. */
    sampleSize: number;
  };
  /** Roster head-count by self-declared Skill Level. */
  skillMix: Record<SkillLevel, number>;
}

const MS_PER_MIN = 60_000;

/** Which `WAIT_BUCKETS_MIN` bucket a wait (ms) lands in. */
function bucketIndex(waitMs: number): number {
  const minutes = waitMs / MS_PER_MIN;
  let index = 0;
  for (let i = 0; i < WAIT_BUCKETS_MIN.length; i++) {
    if (minutes >= WAIT_BUCKETS_MIN[i]) index = i;
  }
  return index;
}

/**
 * Project the permanent Session Summary from a Session's config and its full
 * event log. Called once at close, before the log is purged. Deterministic —
 * the same events always yield the same Summary.
 */
export function projectSummary(
  config: SessionConfig,
  events: SessionEvent[],
): SessionSummary {
  const state = reduceSession(config, events);

  const attendance = state.roster.length;

  // Games played: an occupied Court finishing. `reduceSession` pushes one
  // `completedGames` entry per such event, so this is exact.
  const gamesPlayed = state.completedGames.length;

  const courtCount = Math.max(0, config.courtCount);
  const perCourt = Array.from({ length: courtCount }, () => 0);
  for (const game of state.completedGames) {
    const court = game.court ?? 0;
    if (court >= 1 && court <= courtCount) perCourt[court - 1] += 1;
  }

  const distribution: WaitBucket[] = WAIT_BUCKETS_MIN.map((fromMin, i) => ({
    fromMin,
    toMin: i + 1 < WAIT_BUCKETS_MIN.length ? WAIT_BUCKETS_MIN[i + 1] : null,
    count: 0,
  }));
  for (const waitMs of state.completedWaits) {
    distribution[bucketIndex(waitMs)].count += 1;
  }

  const longestWaitMs = state.completedWaits.reduce((max, w) => Math.max(max, w), 0);
  const totalWaitMs = state.completedWaits.reduce((sum, w) => sum + w, 0);
  const sampleSize = state.completedWaits.length;

  const skillMix = Object.fromEntries(
    SKILL_LEVELS.map((level) => [level, 0]),
  ) as Record<SkillLevel, number>;
  for (const player of state.roster) skillMix[player.skillLevel] += 1;

  return {
    attendance,
    gamesPlayed,
    courtUtilization: {
      courtCount,
      perCourt,
      gamesPerCourt: courtCount > 0 ? gamesPlayed / courtCount : 0,
    },
    waitTime: {
      distribution,
      longestWaitMin: Math.round(longestWaitMs / MS_PER_MIN),
      averageWaitMin: sampleSize > 0 ? Math.round(totalWaitMs / sampleSize / MS_PER_MIN) : 0,
      sampleSize,
    },
    skillMix,
  };
}

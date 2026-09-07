import { MAX_ROSTER_SIZE, MIN_ROSTER_SIZE, type Config } from "./types.ts";

/**
 * The Config's arithmetic: what a Roster of this size can support, and what to
 * offer before the organizer has said anything.
 *
 * These live apart from `generateSchedule` because the UI needs them before it
 * has a Schedule — the courts field's ceiling has to move as names are pasted,
 * and the rounds field needs a default to show. `generateSchedule` runs the
 * same clamps itself, so a Config that skipped this module still can't produce
 * a broken Schedule.
 */

/** Nobody plays without a court, and four players fill exactly one. */
export function maxCourts(n: number): number {
  return Math.max(1, Math.floor(n / 4));
}

export function clampCourts(n: number, courts: number): number {
  if (!Number.isFinite(courts)) return maxCourts(n);
  return Math.min(maxCourts(n), Math.max(1, Math.floor(courts)));
}

/**
 * The length of the full rotation: how many Rounds it takes to use up every
 * possible partnership, after which a repeat is forced no matter how good the
 * generator is. Each Round spends `2 x courts` of the `n(n-1)/2` pairs.
 *
 * For a Roster with a Table this is exactly the whist length (`n - 1`), which
 * is why the two never disagree about how long a Schedule naturally runs.
 */
export function naturalLength(n: number, courts: number): number {
  const pairs = (n * (n - 1)) / 2;
  return Math.max(1, Math.floor(pairs / (2 * clampCourts(n, courts))));
}

/**
 * A full rotation is longer than a club night: sixteen players is fifteen
 * Rounds, and nobody plays fifteen. Eight is an evening.
 */
export const DEFAULT_ROUND_TARGET = 8;

/**
 * Where the generator's search stops being instant in a browser, not a
 * fairness limit — past the natural length the Scorer simply starts reporting
 * repeats, which is the honest answer rather than a refusal.
 */
export const MAX_ROUNDS = 40;

export function defaultRounds(n: number, courts: number): number {
  return Math.min(naturalLength(n, courts), DEFAULT_ROUND_TARGET);
}

export function clampRounds(rounds: number): number {
  if (!Number.isFinite(rounds)) return DEFAULT_ROUND_TARGET;
  return Math.min(MAX_ROUNDS, Math.max(1, Math.floor(rounds)));
}

/** True when a Roster of this size can be scheduled at all. */
export function isSupportedRosterSize(n: number): boolean {
  return n >= MIN_ROSTER_SIZE && n <= MAX_ROSTER_SIZE;
}

/**
 * A Config with the fields the organizer edits brought inside what the Roster
 * supports, and an absent Round count resolved to the default. Roster size is
 * left alone: outside 4 to 32 the answer is a message, not a quiet clamp.
 */
export function clampConfig(config: Config): Config {
  const n = config.roster.length;
  const courts = clampCourts(n, config.courts);
  return {
    ...config,
    courts,
    rounds: clampRounds(config.rounds ?? defaultRounds(n, courts)),
  };
}

import { resolveFormat, seatsPerCourt } from "./format.ts";
import {
  MAX_ROSTER_SIZE,
  MIN_ROSTER_SIZE,
  type Config,
  type Format,
} from "./types.ts";

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

/**
 * Nobody plays without a court, and a court seats what the Format puts on it.
 *
 * Four in both doubles Formats: fixed partners is `n / 2` Pairings two to a
 * court, which is the same `n / 4`, and that Format only ever asks this about
 * an even Roster. Singles is where the ceiling first follows the Format,
 * because a side there is one Player and a court takes two of them.
 *
 * The Format is defaulted rather than required, on the same terms as
 * `naturalLength` below: a caller that names no Format is a caller in the one
 * every Config predating Formats is in.
 */
export function maxCourts(n: number, format: Format = "rotating"): number {
  return Math.max(1, Math.floor(n / seatsPerCourt(format)));
}

export function clampCourts(
  n: number,
  courts: number,
  format: Format = "rotating",
): number {
  const ceiling = maxCourts(n, format);
  if (!Number.isFinite(courts)) return ceiling;
  return Math.min(ceiling, Math.max(1, Math.floor(courts)));
}

/**
 * The length of the full rotation: how many Rounds it takes to use up what the
 * Format has to spend, after which a repeat is forced no matter how good the
 * generator is.
 *
 * What is being spent differs by Format, so this does too. Rotating spends
 * partnerships — `2 x courts` of the `n(n-1)/2` pairs per Round — and for a
 * Roster with a Table the answer is exactly the whist length (`n - 1`), which
 * is why the two never disagree about how long a Schedule naturally runs.
 * Fixed partners has no partnerships to spend, because they are all spent in
 * Round 1 and deliberately; what runs out there is meetings between the `n / 2`
 * Pairings, and a Round spends `courts` of them rather than `2 x courts`.
 * Singles has no partnerships at all: what it spends is meetings between
 * Players, out of the Roster's own `n(n-1)/2`, one per court per Round — so an
 * even Roster on `n / 2` courts comes out at exactly the `n - 1` rounds it
 * takes for everybody to have played everybody.
 */
export function naturalLength(
  n: number,
  courts: number,
  format: Format = "rotating",
): number {
  const seated = clampCourts(n, courts, format);
  if (format === "fixed") {
    const teams = Math.floor(n / 2);
    return Math.max(1, Math.floor((teams * (teams - 1)) / 2 / seated));
  }
  const pairs = (n * (n - 1)) / 2;
  if (format === "singles") return Math.max(1, Math.floor(pairs / seated));
  return Math.max(1, Math.floor(pairs / (2 * seated)));
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

export function defaultRounds(
  n: number,
  courts: number,
  format: Format = "rotating",
): number {
  return Math.min(naturalLength(n, courts, format), DEFAULT_ROUND_TARGET);
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
 * A Config with nothing left to decide: both numbers settled and in range, and
 * the Format said out loud rather than left to a default a reader has to know
 * about. Intersecting an optional field with a required one makes it required,
 * so every place that builds one of these has to answer the Format question —
 * which is the point, since each of them answers it from a different source.
 */
export type ResolvedConfig = Config &
  ResolvedNumbers & { readonly format: Format };

export interface ResolvedNumbers {
  readonly courts: number;
  readonly rounds: number;
}

/**
 * The two numbers, settled, for a Roster of this size. Courts are decided
 * first, because the Round count depends on how many there turn out to be.
 *
 * Split out from `clampConfig` because the fields need these before there is
 * anything to generate, and a Seed is no part of the question they are asking.
 */
export function resolveNumbers(
  n: number,
  courts?: number,
  rounds?: number,
  format: Format = "rotating",
): ResolvedNumbers {
  const settled = clampCourts(n, courts ?? maxCourts(n, format), format);
  return {
    courts: settled,
    rounds: clampRounds(rounds ?? defaultRounds(n, settled, format)),
  };
}

/**
 * The Config the engine will actually use: the fields the organizer edits
 * brought inside what the Roster supports, and anything left unset resolved to
 * its default.
 *
 * Roster size is left alone. Outside 4 to 32 the answer is a message, not a
 * quiet trim of somebody off the end.
 */
export function clampConfig(config: Config): ResolvedConfig {
  const format = resolveFormat(config.format);
  return {
    ...config,
    format,
    ...resolveNumbers(
      config.roster.length,
      config.courts,
      config.rounds,
      format,
    ),
  };
}

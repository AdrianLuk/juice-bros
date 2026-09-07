/**
 * Domain types for the Match Mixer engine.
 *
 * Nothing under `lib/engine` may import React or use an `@/` alias — the
 * module has to resolve under plain `node --test` (see the same constraint on
 * Pickle Point Pal's `lib/scoring/`).
 *
 * A Schedule is always derived from a Config and never stored or patched
 * (ADR 0001), so these types describe one direction of flow: Config in,
 * Schedule out, ScorerResult read off the Schedule that was actually produced.
 */

/** One entry in the Roster. Identity is the `id`; the name is free to change. */
export interface Player {
  readonly id: string;
  readonly name: string;
}

export type Roster = readonly Player[];

/**
 * A position in the Roster. The engine works in indices throughout — the `id`
 * layer exists so a future Lock can point at an entry rather than a position,
 * and is resolved back to a Player at the edge, in the UI.
 */
export type PlayerIndex = number;

/** Two Players partnering in one Game. */
export type Team = readonly [PlayerIndex, PlayerIndex];

/** Four Players on one court within one Round. */
export interface Game {
  /** Zero-based column of the grid; not a venue and has no name. */
  readonly court: number;
  readonly teams: readonly [Team, Team];
}

/** One slice of the Schedule: every court plays at once, the rest take a Bye. */
export interface Round {
  readonly games: readonly Game[];
  readonly byes: readonly PlayerIndex[];
}

/**
 * Where a Schedule came from. Nothing may infer balance from this — the Scorer
 * reads the Schedule itself (ADR 0002). A Schedule that starts with a Table
 * and is then extended past it reads as `generated`, because what matters here
 * is whether anything was searched for rather than looked up.
 */
export type ScheduleSource = "table" | "generated";

export interface Schedule {
  readonly source: ScheduleSource;
  readonly rounds: readonly Round[];
}

/**
 * Everything the organizer has chosen. The only thing edited, and the only
 * thing remembered between visits.
 */
export interface Config {
  readonly roster: Roster;
  /**
   * How many courts are free. Omitted means as many as this Roster can fill,
   * which is also what an emptied field asks for.
   */
  readonly courts?: number;
  /**
   * How many Rounds to produce. Omitted means `defaultRounds` for this Roster
   * and court count — an evening, not the whole rotation.
   */
  readonly rounds?: number;
  /**
   * Makes generation reproducible: the same Config and Seed always give the
   * same Schedule, which is why a Schedule never has to be stored. A Config
   * served entirely from a Table ignores it, having nothing to randomize.
   */
  readonly seed: number;
}

/** A Roster below this can't fill a single court. */
export const MIN_ROSTER_SIZE = 4;
/** Above this the Partner Matrix stops being readable and the search stops being quick. */
export const MAX_ROSTER_SIZE = 32;

/**
 * Who has played with and against whom so far. The generator keeps one of
 * these as it builds and the Scorer takes one over a finished Schedule, so
 * both are reading the same counts.
 */
export interface Tally {
  /** `[i][j]` — how many times i and j partnered. The diagonal stays zero. */
  readonly partnerMatrix: number[][];
  /** `[i][j]` — how many times i and j faced each other. */
  readonly opponentMatrix: number[][];
  readonly gamesPlayed: number[];
  readonly byes: number[];
}

/**
 * The Scorer's reading of one Schedule. `cost` is the number the generator
 * minimizes; everything else is what the summary line and the Partner Matrix
 * render. A perfectly balanced Schedule scores `cost === 0`.
 */
export interface ScorerResult extends Tally {
  readonly cost: number;
  /** Pairs who partnered more than once — the headline failure. */
  readonly repeatedPartnerPairs: number;
  readonly maxPartnerCount: number;
  readonly maxOpponentCount: number;
  /** Most games played by anyone minus fewest — 0 means Byes fell evenly. */
  readonly byeSpread: number;
  /**
   * Whether the Byes fell as evenly as they could have, which is not the same
   * as `byeSpread === 0`: a total that does not divide by the Roster size
   * leaves somebody sitting one more time, and no Schedule can do better. The
   * summary line says "rotating evenly" off this and nothing else.
   */
  readonly byesRotateEvenly: boolean;
}

/**
 * A published, precomputed Schedule for a Roster size the maths solves
 * perfectly. Stored in the compact form the whist construction produces —
 * `rounds[round][game] = [[a, b], [c, d]]` over Roster indices — rather than
 * as `Round` objects, because a Table has no Byes and its court index is just
 * the position in the Round.
 */
export interface Table {
  readonly n: number;
  readonly courts: number;
  readonly rounds: readonly (readonly (readonly [Team, Team])[])[];
}

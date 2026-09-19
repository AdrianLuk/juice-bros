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

/**
 * How a Round is put together, and therefore which generator builds it.
 *
 * A Format is a generator and not a cost term (ADR 0003). Rotating is the
 * default and the only Format the Tables cover — every stored Table is a whist
 * tournament, and ADR 0002's guarantee is a statement about rotating doubles
 * and nothing else — so a Config in any other Format goes to its own generator
 * and never reaches `findTable`.
 *
 * Absent means rotating wherever a Config is read from somewhere written
 * before Formats existed: a saved visit, or a Share Link already sitting in a
 * group chat.
 */
export type Format = "rotating" | "fixed";

export const DEFAULT_FORMAT: Format = "rotating";

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
  /**
   * Which Format to draw in. Optional, and absent reads as rotating — which is
   * what keeps every Config written before Formats existed meaning exactly
   * what it meant, whether it comes from storage or off a link.
   */
  readonly format?: Format;
}

/**
 * A Config whose Format is settled at the type level, so that the Scorer's
 * reading can narrow with it. A caller holding one of these already knows
 * which board it is about to draw; a caller holding a plain `Config` does not,
 * and has to ask before reading a verdict off it.
 */
export type RotatingConfig = Config & { readonly format?: "rotating" };
export type FixedConfig = Config & { readonly format: "fixed" };

/** A Roster below this can't fill a single court. */
export const MIN_ROSTER_SIZE = 4;
/** Above this the grid stops fitting a sheet and the search stops being quick. */
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
 * What every Format's reading shares: the raw counts, the price, and the Bye
 * verdict. The counts are format-independent — who partnered whom and who
 * faced whom are facts about the Schedule, whatever question is being asked of
 * them. What differs is which of them is a failure.
 *
 * `cost` is the number the generator minimizes. A perfectly balanced Schedule
 * scores `cost === 0` in every Format, which is the one thing that stays true
 * across the union.
 */
export interface ScoreBase extends Tally {
  readonly cost: number;
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
 * Rotating doubles, where the failure is partnering the same person twice.
 */
export interface RotatingScore extends ScoreBase {
  readonly format: "rotating";
  /** Pairs who partnered more than once — the headline failure. */
  readonly repeatedPartnerPairs: number;
  readonly maxPartnerCount: number;
  readonly maxOpponentCount: number;
  /**
   * How many distinct pairs have partnered at least once. Distinct is the
   * whole point: a pair that played together twice is one pairing covered and
   * one repeat, so this counts pairs rather than partnerships.
   */
  readonly pairingsPlayed: number;
  /** Every pair the Roster contains, `n × (n − 1) / 2`. */
  readonly pairingsPossible: number;
}

/**
 * Fixed partners, where every partner repeat is deliberate and there is
 * nothing to report about them. The failure this Format has is the *rematch* —
 * two Pairings meeting again before everyone has met — so that is what is
 * counted, and the Byes are counted across Pairings rather than across Players
 * because both members of a sitting team sit.
 *
 * This exists as a separate shape rather than as rotating's with the partner
 * fields ignored, because those fields would be read: a fixed-partner board
 * has `repeatedPartnerPairs` equal to every pair on it and a cost in the
 * thousands, which is a true count of a thing that is not a failure. Nothing
 * in the app may claim a Schedule is balanced except the Scorer, so the Scorer
 * has to be able to say what balance means here.
 */
export interface FixedScore extends ScoreBase {
  readonly format: "fixed";
  /** The Pairings this board was drawn over, in Roster order. */
  readonly teams: readonly Team[];
  /** `[i][j]` — how many times Pairing i and Pairing j have faced each other. */
  readonly meetingMatrix: number[][];
  /** Pairings who have met more than once — the headline failure here. */
  readonly repeatedMeetings: number;
  readonly maxMeetingCount: number;
  /** How many distinct Pairing-against-Pairing meetings have happened. */
  readonly meetingsPlayed: number;
  /** Every meeting the Pairings allow, `t × (t − 1) / 2` for `t` teams. */
  readonly meetingsPossible: number;
}

/**
 * The Scorer's reading of one Schedule, in whichever Format drew it. A union
 * rather than one shape, so that a reader has to say which board it is looking
 * at before it can read a verdict off it — which is what stops a fixed-partner
 * board being reported as a rotating one that went badly wrong.
 */
export type ScorerResult = RotatingScore | FixedScore;

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

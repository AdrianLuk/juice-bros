import { generateCircleRounds } from "./circle.ts";
import type { PlayerIndex, Round, Side } from "./types.ts";

/**
 * The singles generator: the circle method again, over Players rather than
 * over Pairings.
 *
 * It is the same construction fixed partners uses and deliberately the same
 * code (`circle.ts`), because the only thing that differs between the two
 * Formats is what a side is. There a side is two consecutive lines of the
 * Roster; here it is one line, and a Roster of `n` circles as `n` units
 * instead of `n / 2`.
 *
 * What follows from that: for an even Roster on `n / 2` courts the circle runs
 * `n - 1` rounds with nobody sitting out and everybody playing everybody
 * exactly once. An odd Roster draws the ghost and one Player sits each Round;
 * fewer courts than `n / 2` leaves more of them sitting. Either way the Byes
 * rotate on the construction's own spread rather than on a rule of their own.
 *
 * Like fixed partners, no Config in this Format reaches `findTable` — ADR
 * 0002's guarantee is about whist tournaments in rotating doubles, which is
 * not what this is. And like fixed partners, a change to the construction
 * requires bumping `GENERATOR_VERSION` in `persistence/share-link.ts`.
 */

/** What the construction needs: a Config with the names taken off. */
export interface SinglesSpec {
  readonly n: number;
  readonly courts: number;
  readonly rounds: number;
  readonly seed: number;
}

/**
 * The sides a Roster of this size makes in singles: every Player, alone.
 *
 * Written out rather than inlined so it can be read beside `pairsOf` — the two
 * are the same question answered by the two Formats that circle, and a reader
 * comparing them sees the whole of the difference between those Formats in
 * two functions.
 */
export function soloOf(n: number): Side[] {
  const sides: Side[] = [];
  for (let i = 0; i < n; i++) sides.push([i as PlayerIndex]);
  return sides;
}

export function generateSinglesRounds(spec: SinglesSpec): Round[] {
  return generateCircleRounds({ ...spec, units: soloOf(spec.n) });
}

import { generateCircleRounds } from "./circle.ts";
import { pairsOf } from "./format.ts";
import type { Round } from "./types.ts";

/**
 * The fixed-partner generator: the circle method over Pairings.
 *
 * This is a separate generator rather than a cost term on the rotating one,
 * and ADR 0003 is where that is argued. The short of it: the rotating
 * generator's entire search minimizes partner repeats, and in this Format
 * every partner repeat is deliberate. There is nothing left to search for —
 * the pairs are locked and rotate as units, which is a solved construction
 * rather than a cost landscape. Pointing the existing search at it would be
 * asking a function to find the one thing it was built to avoid.
 *
 * It follows that no Config in this Format reaches `findTable`. Every stored
 * Table is a whist tournament, and ADR 0002's guarantee — that any leading run
 * of one is still balanced — is a statement about rotating doubles and about
 * nothing else.
 *
 * What is left here after RR-4.2 is only what makes this Format *this* Format:
 * the units it circles are the Roster's own consecutive pairs. The
 * construction itself moved to `circle.ts` when singles turned out to be the
 * same one over Players, and the "bump `GENERATOR_VERSION`" rule moved with
 * it — a change to that module changes what an existing Config in either
 * Format generates.
 */

/** What the construction needs: a Config with the names taken off. */
export interface FixedSpec {
  readonly n: number;
  readonly courts: number;
  readonly rounds: number;
  readonly seed: number;
}

export function generateFixedRounds(spec: FixedSpec): Round[] {
  return generateCircleRounds({ ...spec, units: pairsOf(spec.n) });
}

import { randomFrom } from "./random.ts";
import type { Entrant } from "./types.ts";

/**
 * Pull one name out of the bucket.
 *
 * A cumulative walk over ticket counts rather than an expanded array of one
 * entry per ticket: same distribution, but it does not care whether someone
 * bought three tickets or three hundred, and it cannot quietly run out of
 * memory on a generous donor.
 *
 * The result is a pure function of the pool, its order, and the seed — which
 * is the whole basis for the seed being shown on screen *before* the draw.
 * Anyone who doubts the result can recompute it from what they watched.
 */
export function pickWinner(pool: readonly Entrant[], seed: number): Entrant | null {
  const total = pool.reduce((sum, entrant) => sum + entrant.tickets, 0);
  if (total <= 0) return null;

  const roll = randomFrom(seed)() * total;

  let seen = 0;
  for (const entrant of pool) {
    seen += entrant.tickets;
    if (roll < seen) return entrant;
  }

  // Unreachable while `roll < total`, but floating point owes nobody a
  // promise. Falling back to the last ticket-holding entrant beats returning
  // null and telling a full room the bucket was empty.
  return pool[pool.length - 1] ?? null;
}

/**
 * The names to flick past on the way to the winner, ending on them.
 *
 * Purely for the reveal, and unweighted on purpose: the reel is showing who is
 * in the bucket, not modelling the odds, and a five-ticket donor filling the
 * reel would read as the machine leaning toward them.
 */
export function reelNames(
  pool: readonly Entrant[],
  winner: Entrant,
  seed: number,
  length = 24,
): string[] {
  if (pool.length === 0) return [winner.name];

  const random = randomFrom(seed ^ 0x5f3759df);
  const names: string[] = [];

  for (let i = 0; i < Math.max(0, length - 1); i++) {
    names.push(pool[Math.floor(random() * pool.length)]!.name);
  }
  names.push(winner.name);

  return names;
}

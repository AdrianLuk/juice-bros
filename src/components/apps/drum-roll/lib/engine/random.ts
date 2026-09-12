/**
 * The one source of randomness, so "the same bucket and seed give the same
 * winner" is a property of the engine rather than of whichever module rolled
 * its own generator.
 *
 * Lifted from Match Mixer's engine unchanged. It stays a copy rather than a
 * shared import because both live under `lib/engine/` with relative imports
 * only, so `node --test` can reach them without the `@/` alias.
 */

/** mulberry32: small, fast, and the same sequence in every browser. */
export function randomFrom(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A fresh seed to commit to before a draw. This is the one place a wall-clock
 * reading and `Math.random` are allowed, and it sits outside the fold on
 * purpose: the seed is an input to a draw, never a product of one.
 */
export function freshSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
}

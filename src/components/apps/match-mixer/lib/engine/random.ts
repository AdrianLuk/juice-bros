/**
 * The engine's one source of randomness, so that "the same Config and Seed
 * give the same Schedule" is a property of the whole engine rather than of
 * whichever module happened to roll its own generator.
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

export function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * A seeded relabeling of `0..n-1`: which Roster position takes each seat.
 * Read it as `map[seat] = player`.
 */
export function seating(n: number, seed: number): number[] {
  return shuffle(
    Array.from({ length: n }, (_, i) => i),
    randomFrom(seed),
  );
}

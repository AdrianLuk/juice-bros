import type { Table } from "./types.ts";

/**
 * The stored Tables: whist tournaments for the Roster sizes the maths solves
 * perfectly. Each is n-1 Rounds of n/4 Games in which every Player partners
 * every other exactly once, opposes every other exactly twice, and nobody sits
 * out. That is what makes any leading run of Rounds still balanced, so Tables
 * are stored whole and served as prefixes (ADR 0002).
 *
 * Tables are keyed on `(n, courts)` and exist only where `courts === n / 4`.
 * An n=8 Table handed to a club with one court would seat eight Players in
 * four seats, so roster size alone is not enough of a key.
 *
 * Provenance: these are Z-cyclic constructions — the Players are Z(n-1) plus
 * one fixed point (index n-1), and the whole tournament is one initial Round
 * developed by +1. `scripts/build-match-mixer-tables.mts` re-derives exactly
 * what is below, and is where a new size (n = 20, 24) comes from.
 *
 * Do not hand-edit a Table, and do not paste one in from elsewhere without
 * running it past the Scorer: `schedule.test.ts` scores the committed data at
 * full length and at every prefix, and it is not ceremony. The published n=8
 * table in `briefs/juice-bros-round-robin-brief.md` partners correctly but has
 * Players 0 and 1 facing each other six times.
 *
 * Numbers are Roster indices; `[[a, b], [c, d]]` is a and b against c and d.
 *
 * Adding or amending a Table changes what an existing Config generates, so it
 * requires bumping `GENERATOR_VERSION` in `persistence/share-link.ts`: a Share
 * Link only reproduces the board it named if the Table it drew from has not
 * moved under it (#494).
 */
export const TABLES: readonly Table[] = [
  {
    n: 8,
    courts: 2,
    // Initial round [[[0,1],[2,4]],[[3,6],[5,7]]], developed by +1 mod 7 with 7 fixed.
    rounds: [
      // Round 1
      [[[0, 1], [2, 4]], [[3, 6], [5, 7]]],
      // Round 2
      [[[0, 4], [6, 7]], [[1, 2], [3, 5]]],
      // Round 3
      [[[0, 7], [1, 5]], [[2, 3], [4, 6]]],
      // Round 4
      [[[0, 5], [3, 4]], [[1, 7], [2, 6]]],
      // Round 5
      [[[0, 3], [2, 7]], [[1, 6], [4, 5]]],
      // Round 6
      [[[0, 2], [5, 6]], [[1, 4], [3, 7]]],
      // Round 7
      [[[0, 6], [1, 3]], [[2, 5], [4, 7]]],
    ],
  },
  {
    n: 12,
    courts: 3,
    // Initial round [[[0,1],[2,5]],[[3,7],[8,10]],[[4,9],[6,11]]], developed by +1 mod 11 with 11 fixed.
    rounds: [
      // Round 1
      [[[0, 1], [2, 5]], [[3, 7], [8, 10]], [[4, 9], [6, 11]]],
      // Round 2
      [[[0, 9], [4, 8]], [[1, 2], [3, 6]], [[5, 10], [7, 11]]],
      // Round 3
      [[[0, 6], [8, 11]], [[1, 10], [5, 9]], [[2, 3], [4, 7]]],
      // Round 4
      [[[0, 2], [6, 10]], [[1, 7], [9, 11]], [[3, 4], [5, 8]]],
      // Round 5
      [[[0, 7], [1, 3]], [[2, 8], [10, 11]], [[4, 5], [6, 9]]],
      // Round 6
      [[[0, 11], [3, 9]], [[1, 8], [2, 4]], [[5, 6], [7, 10]]],
      // Round 7
      [[[0, 8], [6, 7]], [[1, 11], [4, 10]], [[2, 9], [3, 5]]],
      // Round 8
      [[[0, 5], [2, 11]], [[1, 9], [7, 8]], [[3, 10], [4, 6]]],
      // Round 9
      [[[0, 4], [5, 7]], [[1, 6], [3, 11]], [[2, 10], [8, 9]]],
      // Round 10
      [[[0, 3], [9, 10]], [[1, 5], [6, 8]], [[2, 7], [4, 11]]],
      // Round 11
      [[[0, 10], [1, 4]], [[2, 6], [7, 9]], [[3, 8], [5, 11]]],
    ],
  },
  {
    n: 16,
    courts: 4,
    // Initial round [[[0,1],[2,6]],[[3,9],[7,15]],[[4,14],[8,11]],[[5,13],[10,12]]], developed by +1 mod 15 with 15 fixed.
    rounds: [
      // Round 1
      [[[0, 1], [2, 6]], [[3, 9], [7, 15]], [[4, 14], [8, 11]], [[5, 13], [10, 12]]],
      // Round 2
      [[[0, 5], [9, 12]], [[1, 2], [3, 7]], [[4, 10], [8, 15]], [[6, 14], [11, 13]]],
      // Round 3
      [[[0, 7], [12, 14]], [[1, 6], [10, 13]], [[2, 3], [4, 8]], [[5, 11], [9, 15]]],
      // Round 4
      [[[0, 13], [1, 8]], [[2, 7], [11, 14]], [[3, 4], [5, 9]], [[6, 12], [10, 15]]],
      // Round 5
      [[[0, 12], [3, 8]], [[1, 14], [2, 9]], [[4, 5], [6, 10]], [[7, 13], [11, 15]]],
      // Round 6
      [[[0, 2], [3, 10]], [[1, 13], [4, 9]], [[5, 6], [7, 11]], [[8, 14], [12, 15]]],
      // Round 7
      [[[0, 9], [13, 15]], [[1, 3], [4, 11]], [[2, 14], [5, 10]], [[6, 7], [8, 12]]],
      // Round 8
      [[[0, 3], [6, 11]], [[1, 10], [14, 15]], [[2, 4], [5, 12]], [[7, 8], [9, 13]]],
      // Round 9
      [[[0, 15], [2, 11]], [[1, 4], [7, 12]], [[3, 5], [6, 13]], [[8, 9], [10, 14]]],
      // Round 10
      [[[0, 11], [9, 10]], [[1, 15], [3, 12]], [[2, 5], [8, 13]], [[4, 6], [7, 14]]],
      // Round 11
      [[[0, 8], [5, 7]], [[1, 12], [10, 11]], [[2, 15], [4, 13]], [[3, 6], [9, 14]]],
      // Round 12
      [[[0, 10], [4, 7]], [[1, 9], [6, 8]], [[2, 13], [11, 12]], [[3, 15], [5, 14]]],
      // Round 13
      [[[0, 6], [4, 15]], [[1, 11], [5, 8]], [[2, 10], [7, 9]], [[3, 14], [12, 13]]],
      // Round 14
      [[[0, 4], [13, 14]], [[1, 7], [5, 15]], [[2, 12], [6, 9]], [[3, 11], [8, 10]]],
      // Round 15
      [[[0, 14], [1, 5]], [[2, 8], [6, 15]], [[3, 13], [7, 10]], [[4, 12], [9, 11]]],
    ],
  },
];

/** The stored Table for this Roster size and court count, if there is one. */
export function findTable(n: number, courts: number): Table | null {
  return TABLES.find((table) => table.n === n && table.courts === courts) ?? null;
}

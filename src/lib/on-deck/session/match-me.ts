/**
 * Match Me — On Deck's Court selection algorithm (issue #244, ADR 0004).
 *
 * When a Court frees, `selectFoursome` picks the four who walk on:
 *
 *   1. the single longest-waiting Player is a **hard anchor** — always in;
 *   2. the other three come from a **window** of the next `SELECTION_WINDOW`
 *      longest-waiting;
 *   3. within that window every 3-combination is scored on **Skill Level fit**
 *      (a per-Player penalty, summed) and **Variety** (avoid recent
 *      courtmates), and the lowest total wins;
 *   4. every preference is soft — the Court is filled even when the only
 *      options fit badly.
 *
 * A fit tie falls to Wait Time (the trio further up the Queue), then to a hash
 * of `config.seed` — never `Math.random()` — so identical config + events
 * always yield the identical Foursome. Pure and framework-free (relative
 * imports only), like the rest of this folder: `node --test` cannot resolve
 * the `@/` alias.
 */

import type { CompletedGame, SkillLevel } from "./types.ts";

export type { CompletedGame } from "./types.ts";

/**
 * How many Players past the anchor are considered. Roughly "the next 8-10
 * longest-waiting" (ADR 0004) — wide enough to find a good fit, narrow enough
 * that nobody near the front is passed over for the good of the average.
 */
export const SELECTION_WINDOW = 10;

/**
 * Skill-fit cost for one ordered Player→Player pair, indexed by the gap
 * between their levels (0..3 over newbie/beginner/intermediate/advanced).
 * Same level is free; ±1 is cheap ("common"); ±2 stings ("occasional and
 * tolerated"); ±3 is heavily discouraged. Quadratic so the scorer keeps the
 * spread tight unless forced wider.
 */
export const SKILL_PAIR_COST = [0, 1, 4, 9] as const;

/**
 * Weight on the Variety penalty relative to the skill cost. A brand-new repeat
 * of a Foursome pairing (recency weight 1.0) costs `VARIETY_WEIGHT`; kept below
 * `SKILL_PAIR_COST[2]` so the algorithm never widens the skill spread to ±2
 * purely to dodge one recent courtmate.
 */
export const VARIETY_WEIGHT = 3;

/**
 * How many of the most recent Games the Variety scan looks back over. A share
 * `VARIETY_LOOKBACK` Games ago already weighs only `1 / VARIETY_LOOKBACK`;
 * older ones are rounded away anyway, and bounding the scan keeps selection
 * O(1) in Games played rather than growing all evening.
 */
export const VARIETY_LOOKBACK = 20;

const SKILL_INDEX: Record<SkillLevel, number> = {
  newbie: 0,
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

export interface SelectionInput {
  /** The Queue, already ordered longest-wait-first (index 0 is the anchor). */
  queue: readonly string[];
  /** A Player's declared Skill Level, by device token. */
  skillOf: (playerId: string) => SkillLevel;
  /** Every finished Game, in finish order. */
  completedGames: readonly CompletedGame[];
  /** `config.seed` — the deterministic tie-break source. */
  seed: string;
}

/**
 * The four who walk onto the freed Court — the anchor first, then the chosen
 * three in Queue (wait) order — or `null` when fewer than four are waiting.
 */
export function selectFoursome(input: SelectionInput): string[] | null {
  const { queue, skillOf, completedGames, seed } = input;
  if (queue.length < 4) return null;

  const anchor = queue[0];
  const windowIds = queue.slice(1, 1 + SELECTION_WINDOW);

  let best:
    | { ids: string[]; idx: [number, number, number]; score: number; key: string }
    | null = null;

  for (let i = 0; i < windowIds.length; i++) {
    for (let j = i + 1; j < windowIds.length; j++) {
      for (let k = j + 1; k < windowIds.length; k++) {
        const trio = [windowIds[i], windowIds[j], windowIds[k]];
        const foursome = [anchor, ...trio];
        const score = roundScore(
          skillPenalty(foursome, skillOf) +
            VARIETY_WEIGHT * varietyPenalty(foursome, completedGames),
        );
        const idx: [number, number, number] = [i, j, k];
        const key = seededKey(seed, trio);

        if (best === null || betterThan(score, idx, key, best)) {
          best = { ids: trio, idx, score, key };
        }
      }
    }
  }

  // The nested loops build `trio` in ascending window order already, so it is
  // in Queue (wait) order behind the anchor. `queue.length >= 4` guarantees a
  // window of >= 3, so `best` is set.
  return [anchor, ...best!.ids];
}

/**
 * The tie-break chain, best-first:
 *
 *   1. lower total penalty (Skill + Variety);
 *   2. then the trio further up the Queue — the sorted window indices compared
 *      lexicographically, so a Foursome that keeps a longer-waiting Player
 *      always wins a fit tie (Wait Time is the fairness backbone, ADR 0004);
 *   3. then the seed hash — the last resort, so replay is reproducible without
 *      `Math.random()` even in the (rare) event steps 1-2 do not separate two
 *      candidates.
 */
function betterThan(
  score: number,
  idx: [number, number, number],
  key: string,
  best: { score: number; idx: [number, number, number]; key: string },
): boolean {
  if (score !== best.score) return score < best.score;
  for (let n = 0; n < 3; n++) {
    if (idx[n] !== best.idx[n]) return idx[n] < best.idx[n];
  }
  return key < best.key;
}

/**
 * Sum, over every Player in the Foursome, of that Player's skill-gap cost to
 * each of the other three. Deliberately per-Player (and so double-counting
 * each pair) rather than one court-wide number: Playing Style (v2) becomes a
 * coefficient on each Player's own term, not a rewrite (see #238 Out of Scope).
 */
export function skillPenalty(
  foursome: readonly string[],
  skillOf: (playerId: string) => SkillLevel,
): number {
  let total = 0;
  for (const p of foursome) {
    const pi = SKILL_INDEX[skillOf(p)];
    for (const q of foursome) {
      if (q === p) continue;
      total += SKILL_PAIR_COST[Math.abs(pi - SKILL_INDEX[skillOf(q)])];
    }
  }
  return total;
}

/**
 * How much this Foursome repeats recent courtmates. For each unordered pair,
 * find the most recent finished Game they shared and add a weight that decays
 * the further back it was (`1 / gamesSince`). Tracked at the Foursome level —
 * "shared a Court", never "was my partner" — since teams are never assigned.
 */
export function varietyPenalty(
  foursome: readonly string[],
  completedGames: readonly CompletedGame[],
): number {
  const total = completedGames.length;
  if (total === 0) return 0;
  const oldest = Math.max(0, total - VARIETY_LOOKBACK);

  let penalty = 0;
  for (let a = 0; a < foursome.length; a++) {
    for (let b = a + 1; b < foursome.length; b++) {
      const p = foursome[a];
      const q = foursome[b];
      for (let g = total - 1; g >= oldest; g--) {
        const played = completedGames[g].players;
        if (played.includes(p) && played.includes(q)) {
          penalty += 1 / (total - g);
          break;
        }
      }
    }
  }
  return penalty;
}

/** Collapse floating-point noise so genuine ties fall through to the seed. */
function roundScore(score: number): number {
  return Math.round(score * 1e6) / 1e6;
}

/**
 * A deterministic ordering key for a candidate trio: FNV-1a over the seed and
 * the sorted ids, as 8 hex chars so string comparison is stable. Not
 * `Math.random()` — replay must be reproducible.
 */
function seededKey(seed: string, ids: readonly string[]): string {
  const source = `${seed}|${ids.slice().sort().join(",")}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

import { randomFrom, shuffle } from "./random.ts";
import {
  FREE_OPPONENT_MEETINGS,
  OPPONENT_REPEAT_WEIGHT,
  PARTNER_REPEAT_WEIGHT,
  recordRound,
  scoreRounds,
  tallyRounds,
} from "./scorer.ts";
import { MARKERS } from "./types.ts";
import type {
  Game,
  Marker,
  PlayerIndex,
  Round,
  Tally,
  Team,
} from "./types.ts";

/**
 * The randomized greedy generator: everything a Table doesn't cover.
 *
 * Fewer courts than `n / 4`, a Roster that doesn't divide by four, or more
 * Rounds than a Table holds all land here. Where a Table does exist it is
 * served first and this picks up from its accumulated partner, opponent and
 * Bye counts rather than starting cold (ADR 0002) — the same mechanism a later
 * milestone will need to regenerate around a late arrival.
 *
 * The shape is: build a Round at a time by greedy choice with random
 * tie-breaks, improve it by swapping players between courts while that helps,
 * then throw the whole attempt away and do it again from a different random
 * order. The Scorer picks the winner. Nothing here decides what "fair" means;
 * it only searches for what the Scorer already rewards, in the Scorer's own
 * weights and off the Scorer's own Tally.
 *
 * A change to the search changes what an existing Config generates, so it
 * requires bumping `GENERATOR_VERSION` in `persistence/share-link.ts`: a Share
 * Link only reproduces the board it named if the search it drew from has not
 * moved under it (#494).
 */

/** What the search needs: a Config with the names taken off. */
export interface GenerationSpec {
  readonly n: number;
  readonly courts: number;
  readonly rounds: number;
  readonly seed: number;
  /** Rounds to keep at the front and build on, usually a Table. */
  readonly prefix?: readonly Round[];
  /**
   * Mixed doubles: one marker per Roster position, and every team comes out
   * one `M` and one `F`.
   *
   * A hard constraint on the seating rather than a term in the cost, which is
   * the difference between this and everything else the search weighs. A cost
   * term is something the search may pay when the alternative is worse, and a
   * Round with two `M` on a side is not a worse mixed board — it is not a
   * mixed board. So it is never constructed: the seating draws from two pools,
   * the Byes come off two queues, and the swap pass will not trade a player
   * for one of the other marker.
   *
   * Absent is every board that is not mixed, and it takes exactly the path it
   * took before this existed.
   */
  readonly markers?: readonly Marker[] | null;
}

/** How wide the search goes. Trimmed for long Schedules so a paste stays quick. */
function attemptsFor(roundsToBuild: number): number {
  return Math.max(4, Math.min(24, Math.ceil(400 / Math.max(1, roundsToBuild))));
}

/** Bounded, because the swap pass usually settles after one or two sweeps. */
const IMPROVEMENT_PASSES = 4;

/**
 * What it would cost to put these two together, in the Scorer's weights.
 * Repeats past the first keep getting dearer, so the search prefers spreading
 * an unavoidable repeat around rather than piling it onto one pair.
 */
function partnerCost(tally: Tally, a: PlayerIndex, b: PlayerIndex): number {
  return tally.partnerMatrix[a][b] * PARTNER_REPEAT_WEIGHT;
}

function opponentCost(tally: Tally, a: PlayerIndex, b: PlayerIndex): number {
  const met = tally.opponentMatrix[a][b];
  return Math.max(0, met - FREE_OPPONENT_MEETINGS + 1) * OPPONENT_REPEAT_WEIGHT;
}

function gameCost(tally: Tally, teams: readonly [Team, Team]): number {
  const [teamA, teamB] = teams;
  let cost = partnerCost(tally, teamA[0], teamA[1]);
  cost += partnerCost(tally, teamB[0], teamB[1]);
  for (const x of teamA) for (const y of teamB) cost += opponentCost(tally, x, y);
  return cost;
}

function roundCost(tally: Tally, games: readonly Game[]): number {
  let cost = 0;
  for (const game of games) cost += gameCost(tally, game.teams);
  return cost;
}

/**
 * Who sits out. Byes go to whoever has had the fewest so far, which is the
 * whole of the rotation rule, with random tie-breaks so that the same people
 * are not left sitting together every time the count comes out level.
 */
function chooseByes(
  n: number,
  sitting: number,
  tally: Tally,
  random: () => number,
): PlayerIndex[] {
  if (sitting <= 0) return [];
  // Shuffle first and sort after: the sort is stable, so equal Bye counts come
  // back in the random order rather than in roster order.
  const order = shuffle(
    Array.from({ length: n }, (_, i) => i),
    random,
  );
  order.sort((a, b) => tally.byes[a] - tally.byes[b]);
  return order.slice(0, sitting).sort((a, b) => a - b);
}

/**
 * The same rule, run once per marker.
 *
 * A mixed Round seats `2c` of each side, so the two sides sit out independent
 * numbers of people and one queue cannot be allowed to decide the other's
 * turn. With ten `M` and six `F` on three courts, four `M` sit every Round and
 * no `F` ever does; taking the four lowest counts off one shared queue would
 * sit an `F` down and leave a court short of somebody to fill the seat.
 */
function chooseMixedByes(
  n: number,
  courts: number,
  tally: Tally,
  random: () => number,
  markers: readonly Marker[],
): PlayerIndex[] {
  const everyone = Array.from({ length: n }, (_, i) => i);
  const byes: PlayerIndex[] = [];

  for (const marker of MARKERS) {
    const side = shuffle(
      everyone.filter((player) => markers[player] === marker),
      random,
    );
    side.sort((a, b) => tally.byes[a] - tally.byes[b]);
    byes.push(...side.slice(0, Math.max(0, side.length - courts * 2)));
  }

  return byes.sort((a, b) => a - b);
}

/** Greedy seating: a player, their cheapest partner, then the cheapest pair to face. */
function seatGreedily(
  seated: readonly PlayerIndex[],
  courts: number,
  tally: Tally,
  random: () => number,
): Game[] {
  const pool = shuffle([...seated], random);
  const games: Game[] = [];

  const take = (index: number): PlayerIndex => pool.splice(index, 1)[0];

  for (let court = 0; court < courts; court++) {
    const a = take(0);

    let bestPartner = 0;
    let bestPartnerCost = Infinity;
    for (let i = 0; i < pool.length; i++) {
      // The fractional term is the random tie-break: it can separate two equal
      // choices but never outweigh a whole repeat.
      const cost = partnerCost(tally, a, pool[i]) + random();
      if (cost < bestPartnerCost) {
        bestPartnerCost = cost;
        bestPartner = i;
      }
    }
    const b = take(bestPartner);

    let bestPair: [number, number] = [0, 1];
    let bestPairCost = Infinity;
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const teams: [Team, Team] = [
          [a, b],
          [pool[i], pool[j]],
        ];
        const cost = gameCost(tally, teams) + random();
        if (cost < bestPairCost) {
          bestPairCost = cost;
          bestPair = [i, j];
        }
      }
    }
    // Highest index first, so removing one does not shift the other.
    const d = take(bestPair[1]);
    const c = take(bestPair[0]);

    games.push({ court, teams: [[a, b], [c, d]] });
  }

  return games;
}

/**
 * The same greedy seating with the sides kept apart: an `M` off the front, the
 * cheapest `F` to partner them, then the cheapest `M`/`F` pair to face.
 *
 * Structurally it is `seatGreedily` over two pools rather than one, and that
 * is the whole of the difference. The costs are the Scorer's, the tie-break is
 * the same fractional random that can separate two equal choices but never
 * outweigh a repeat, and the search that wraps it is untouched. What the two
 * pools buy is that a same-marker side is never a candidate, so it is never
 * something the search has to be persuaded out of.
 *
 * Every team comes out `[M, F]` in that order. It is not a display decision —
 * the grid prints no markers — but it does mean the seat pattern down a Round
 * is `M F M F`, which is what the swap pass below relies on staying true.
 */
function seatMixed(
  seated: readonly PlayerIndex[],
  courts: number,
  tally: Tally,
  random: () => number,
  markers: readonly Marker[],
): Game[] {
  const pools: Record<Marker, PlayerIndex[]> = {
    M: shuffle(
      seated.filter((player) => markers[player] === "M"),
      random,
    ),
    F: shuffle(
      seated.filter((player) => markers[player] === "F"),
      random,
    ),
  };
  const games: Game[] = [];

  for (let court = 0; court < courts; court++) {
    const a = pools.M.splice(0, 1)[0];

    let bestPartner = 0;
    let bestPartnerCost = Infinity;
    for (let i = 0; i < pools.F.length; i++) {
      const cost = partnerCost(tally, a, pools.F[i]) + random();
      if (cost < bestPartnerCost) {
        bestPartnerCost = cost;
        bestPartner = i;
      }
    }
    const b = pools.F.splice(bestPartner, 1)[0];

    let bestPair: [number, number] = [0, 0];
    let bestPairCost = Infinity;
    for (let i = 0; i < pools.M.length; i++) {
      for (let j = 0; j < pools.F.length; j++) {
        const teams: [Team, Team] = [
          [a, b],
          [pools.M[i], pools.F[j]],
        ];
        const cost = gameCost(tally, teams) + random();
        if (cost < bestPairCost) {
          bestPairCost = cost;
          bestPair = [i, j];
        }
      }
    }
    // Two pools, so removing from one cannot shift an index into the other.
    const c = pools.M.splice(bestPair[0], 1)[0];
    const d = pools.F.splice(bestPair[1], 1)[0];

    games.push({ court, teams: [[a, b], [c, d]] });
  }

  return games;
}

/**
 * Greedy fills the last court with whoever is left over, which is where its
 * worst choices end up. Swapping two seats at a time undoes most of that, and
 * a swap is only ever kept if the Round got cheaper.
 */
function improveBySwapping(
  games: readonly Game[],
  tally: Tally,
  markers: readonly Marker[] | null = null,
): Game[] {
  const seats: PlayerIndex[] = [];
  for (const game of games) seats.push(...game.teams[0], ...game.teams[1]);

  const rebuild = (from: readonly PlayerIndex[]): Game[] =>
    games.map((_, court) => ({
      court,
      teams: [
        [from[court * 4], from[court * 4 + 1]],
        [from[court * 4 + 2], from[court * 4 + 3]],
      ] as [Team, Team],
    }));

  let best = roundCost(tally, games);

  for (let pass = 0; pass < IMPROVEMENT_PASSES; pass++) {
    let improved = false;
    for (let i = 0; i < seats.length; i++) {
      for (let j = i + 1; j < seats.length; j++) {
        // Under mixed doubles a seat belongs to a marker, so only a player of
        // the same one may take it. Skipped rather than scored and rejected:
        // the swap the cost would like best is often the one that puts two
        // `M` on a side, and a constraint that can be outbid is a weight.
        if (markers && markers[seats[i]] !== markers[seats[j]]) continue;
        [seats[i], seats[j]] = [seats[j], seats[i]];
        const cost = roundCost(tally, rebuild(seats));
        if (cost < best) {
          best = cost;
          improved = true;
        } else {
          [seats[i], seats[j]] = [seats[j], seats[i]];
        }
      }
    }
    if (!improved) break;
  }

  return rebuild(seats);
}

function buildRound(
  n: number,
  courts: number,
  tally: Tally,
  random: () => number,
  markers: readonly Marker[] | null = null,
): Round {
  const byes = markers
    ? chooseMixedByes(n, courts, tally, random, markers)
    : chooseByes(n, n - courts * 4, tally, random);
  const sittingOut = new Set(byes);
  const seated = Array.from({ length: n }, (_, i) => i).filter(
    (p) => !sittingOut.has(p),
  );

  const games = markers
    ? seatMixed(seated, courts, tally, random, markers)
    : seatGreedily(seated, courts, tally, random);

  return { games: improveBySwapping(games, tally, markers), byes };
}

/**
 * Build out to `rounds` Rounds, keeping the prefix at the front untouched.
 * Deterministic in `seed`: the same spec always hands back the same Rounds,
 * which is what lets a Schedule be rebuilt from its Config rather than stored.
 */
export function generateRounds(spec: GenerationSpec): Round[] {
  const prefix = (spec.prefix ?? []).slice(0, spec.rounds);
  const toBuild = spec.rounds - prefix.length;
  if (toBuild <= 0) return [...prefix];

  const attempts = attemptsFor(toBuild);
  const markers = spec.markers ?? null;
  let best: Round[] = [];
  let bestCost = Infinity;

  for (let attempt = 0; attempt < attempts; attempt++) {
    // Each attempt is its own deterministic stream, so the search is
    // reproducible even though it is random.
    const random = randomFrom(spec.seed + attempt * 0x9e3779b9);
    const tally = tallyRounds(prefix, spec.n);
    const candidate = [...prefix];

    for (let r = 0; r < toBuild; r++) {
      const round = buildRound(spec.n, spec.courts, tally, random, markers);
      recordRound(tally, round);
      candidate.push(round);
    }

    // Scored with the markers too, because an even share of the night means
    // something different here: the two sides take their Byes off separate
    // queues, and the whole-Roster spread would price a rotation that is
    // already the best one those counts allow.
    const cost = scoreRounds(candidate, spec.n, "rotating", markers).cost;
    if (cost < bestCost) {
      bestCost = cost;
      best = candidate;
    }
    if (bestCost === 0) break;
  }

  return best;
}

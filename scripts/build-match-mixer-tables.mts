/**
 * Derives Match Mixer's stored Tables.
 *
 *   node scripts/build-match-mixer-tables.mts [n...]     (default: 8 12 16)
 *
 * Prints the `rounds` literal for each Roster size so it can be pasted into
 * `src/components/apps/match-mixer/lib/engine/tables.ts`. Nothing imports this
 * at runtime; it exists so the committed Tables can be re-derived rather than
 * taken on trust, and so adding a size (n = 20, 24) is a run rather than a
 * hunt through published schedules — several of which are wrong, including the
 * n=8 one in `briefs/juice-bros-round-robin-brief.md`.
 *
 * A whist tournament Wh(n) is n-1 Rounds of n/4 Games in which every Player
 * partners every other exactly once and opposes every other exactly twice.
 * The ones here are Z-cyclic: Players are Z(n-1) plus one fixed point, and the
 * whole tournament is a single initial Round developed by +1. That turns the
 * search into a small exhaustive one over initial Rounds, constrained on
 * differences — every non-zero difference has to appear exactly once among the
 * finite partner pairs and exactly twice among the finite opponent pairs,
 * because developing a pair of difference d produces one such pair per Round.
 *
 * The Scorer is not used here on purpose. `tables.test.ts` scores the
 * committed data, so the check that matters runs against what actually ships,
 * through code the app itself uses.
 */

type Pair = [number, number];
type Game = [Pair, Pair];
type Round = Game[];

function solveInitialRound(n: number): Round | null {
  const m = n - 1;
  const infinity = m;
  const half = (m - 1) / 2;

  const difference = (a: number, b: number): number => {
    const d = Math.abs(a - b) % m;
    return Math.min(d, m - d);
  };

  const partnerDiff = new Array<number>(half + 1).fill(0);
  const opponentDiff = new Array<number>(half + 1).fill(0);
  const games: Round = [];

  // The differences one Game contributes, ignoring anything touching the fixed
  // point: those pairings balance automatically as the Round is developed.
  const contributions = ([a, b]: Game): ["p" | "o", number][] => {
    const out: ["p" | "o", number][] = [];
    if (a[0] !== infinity && a[1] !== infinity) out.push(["p", difference(a[0], a[1])]);
    if (b[0] !== infinity && b[1] !== infinity) out.push(["p", difference(b[0], b[1])]);
    for (const x of a) {
      for (const y of b) {
        if (x !== infinity && y !== infinity) out.push(["o", difference(x, y)]);
      }
    }
    return out;
  };

  const apply = (game: Game, delta: number) => {
    for (const [kind, d] of contributions(game)) {
      if (kind === "p") partnerDiff[d] += delta;
      else opponentDiff[d] += delta;
    }
  };

  const legal = (game: Game): boolean => {
    apply(game, 1);
    const ok = partnerDiff.every((count, d) => d === 0 || count <= 1)
      && opponentDiff.every((count, d) => d === 0 || count <= 2);
    apply(game, -1);
    return ok;
  };

  // Canonical branching: the lowest unseated player always joins the Game
  // being built, so every partition is reached exactly once.
  const step = (free: number[]): boolean => {
    if (free.length === 0) {
      return partnerDiff.every((count, d) => d === 0 || count === 1)
        && opponentDiff.every((count, d) => d === 0 || count === 2);
    }
    const [first, ...rest] = free;
    for (const partner of rest) {
      const pool = rest.filter((p) => p !== partner);
      for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
          const game: Game = [[first, partner], [pool[i], pool[j]]];
          if (!legal(game)) continue;
          apply(game, 1);
          games.push(game);
          const seated = new Set(game.flat());
          if (step(free.filter((p) => !seated.has(p)))) return true;
          games.pop();
          apply(game, -1);
        }
      }
    }
    return false;
  };

  return step([...Array(m).keys(), infinity]) ? games : null;
}

function develop(n: number, initial: Round): Round[] {
  const m = n - 1;
  const shift = (p: number) => (p === m ? m : (p + 1) % m);
  const rounds: Round[] = [];
  let round = initial;
  for (let r = 0; r < m; r++) {
    rounds.push(round.map(([a, b]): Game => [[...a], [...b]]));
    round = round.map(([a, b]): Game => [
      [shift(a[0]), shift(a[1])],
      [shift(b[0]), shift(b[1])],
    ]);
  }
  return rounds;
}

/** Sorted within pair, Game and Round, so re-running produces the same file. */
function normalise(rounds: Round[]): Round[] {
  return rounds.map((round) =>
    round
      .map(([a, b]): Game => {
        const first: Pair = [...a].sort((x, y) => x - y) as Pair;
        const second: Pair = [...b].sort((x, y) => x - y) as Pair;
        return first[0] < second[0] ? [first, second] : [second, first];
      })
      .sort((g, h) => g[0][0] - h[0][0]),
  );
}

function check(n: number, rounds: Round[]): void {
  const partner = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const opponent = Array.from({ length: n }, () => new Array<number>(n).fill(0));

  if (rounds.length !== n - 1) throw new Error(`${rounds.length} rounds, want ${n - 1}`);
  for (const round of rounds) {
    if (round.length !== n / 4) throw new Error(`${round.length} games, want ${n / 4}`);
    const seated = new Set(round.flat(2));
    if (seated.size !== n) throw new Error(`a round seats ${seated.size} of ${n}`);
    for (const [a, b] of round) {
      partner[a[0]][a[1]]++;
      partner[a[1]][a[0]]++;
      partner[b[0]][b[1]]++;
      partner[b[1]][b[0]]++;
      for (const x of a) {
        for (const y of b) {
          opponent[x][y]++;
          opponent[y][x]++;
        }
      }
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (partner[i][j] !== 1) throw new Error(`${i} and ${j} partnered ${partner[i][j]}x`);
      if (opponent[i][j] !== 2) throw new Error(`${i} and ${j} opposed ${opponent[i][j]}x`);
    }
  }
}

const sizes = process.argv.slice(2).map(Number).filter(Boolean);
for (const n of sizes.length > 0 ? sizes : [8, 12, 16]) {
  if (n % 4 !== 0) throw new Error(`n=${n} is not divisible by 4`);

  const initial = solveInitialRound(n);
  if (!initial) {
    console.log(`// n=${n}: no Z-cyclic whist tournament found`);
    continue;
  }

  const rounds = normalise(develop(n, initial));
  check(n, rounds);

  const format = ([a, b]: Game) => `[[${a[0]}, ${a[1]}], [${b[0]}, ${b[1]}]]`;
  console.log(`  {
    n: ${n},
    courts: ${n / 4},
    // Initial round ${JSON.stringify(initial)}, developed by +1 mod ${n - 1} with ${n - 1} fixed.
    rounds: [`);
  rounds.forEach((round, index) => {
    console.log(`      // Round ${index + 1}`);
    console.log(`      [${round.map(format).join(", ")}],`);
  });
  console.log(`    ],
  },`);
}

import assert from "node:assert/strict";
import test from "node:test";

import { clampConfig, maxCourts } from "./config.ts";
import { itinerary } from "./itinerary.ts";
import {
  boardObjection,
  dealPools,
  drawPools,
  isSupportedBoardSize,
  locate,
  MAX_BOARD_SIZE,
  maxPools,
  planPools,
  pooledCourtDefault,
  resolveBoard,
  resolvePools,
  rosterCeiling,
  type BoardConfig,
  type Pool,
} from "./pools.ts";
import { parseRoster } from "./roster.ts";
import { generateSchedule, UnsupportedConfigError } from "./schedule.ts";
import { scoreSchedule } from "./scorer.ts";
import type { Format, Roster, Schedule } from "./types.ts";

/**
 * Pools: the layer above `generateSchedule` that deals a Roster into several
 * round robins and puts them side by side (ADR 0004).
 *
 * The first block here is the load-bearing one. Every Config that existed
 * before Pools is a one-Pool Config, and it has to draw exactly the board it
 * drew before, or every Share Link already in a group chat changes under the
 * people holding it. `GENERATOR_VERSION` was deliberately not bumped for
 * this, so these tests are what stands in for it.
 */

function names(n: number, markers?: readonly string[]): Roster {
  const text = Array.from(
    { length: n },
    (_, i) => `Player ${i + 1}${markers ? ` ${markers[i % markers.length]}` : ""}`,
  ).join("\n");
  return parseRoster(text, [], markers !== undefined);
}

function board(
  roster: Roster,
  overrides: Partial<Omit<BoardConfig, "roster">> = {},
): BoardConfig {
  const format: Format = overrides.format ?? "rotating";
  const mixed = overrides.mixed ?? false;
  const pools = overrides.pools ?? 1;
  const numbers = resolveBoard(
    roster,
    overrides.courts,
    overrides.rounds,
    format,
    mixed,
    pools,
  );
  return { roster, seed: overrides.seed ?? 1, format, mixed, ...numbers };
}

/** Every Game's court, across every Round of a Pool. */
function courtsOf(pool: Pool): Set<number> {
  const courts = new Set<number>();
  for (const round of pool.schedule.rounds) {
    for (const game of round.games) courts.add(game.court);
  }
  return courts;
}

/** Every Player a Round seats or sits, as Roster indices of the whole board. */
function everyoneIn(pools: readonly Pool[], round: number): number[] {
  const seen: number[] = [];
  for (const pool of pools) {
    const r = pool.schedule.rounds[round];
    for (const game of r.games) {
      for (const side of game.sides) {
        for (const player of side) seen.push(pool.members[player]);
      }
    }
    for (const player of r.byes) seen.push(pool.members[player]);
  }
  return seen.sort((a, b) => a - b);
}

// ---- One Pool is the board it always was ---------------------------------

const ONE_POOL_BOARDS: {
  label: string;
  roster: Roster;
  config: Partial<Omit<BoardConfig, "roster">>;
}[] = [
  { label: "rotating n=8, a Table", roster: names(8), config: { courts: 2, seed: 3 } },
  { label: "rotating n=13 on 3", roster: names(13), config: { courts: 3, seed: 7 } },
  { label: "rotating n=16 past the Table", roster: names(16), config: { rounds: 18, seed: 99 } },
  { label: "rotating n=32", roster: names(32), config: { seed: 2024 } },
  { label: "fixed n=12 on 2", roster: names(12), config: { format: "fixed", courts: 2, seed: 5 } },
  { label: "fixed n=18", roster: names(18), config: { format: "fixed", seed: 77 } },
  { label: "singles n=9", roster: names(9), config: { format: "singles", seed: 8 } },
  { label: "singles n=16 on 6", roster: names(16), config: { format: "singles", courts: 6, rounds: 10, seed: 31337 } },
  { label: "mixed 6M 6F", roster: names(12, ["M", "F"]), config: { mixed: true, seed: 11 } },
  { label: "mixed n=14 on 3", roster: names(14, ["M", "F"]), config: { mixed: true, courts: 3, seed: 1234 } },
];

for (const { label, roster, config } of ONE_POOL_BOARDS) {
  test(`one pool draws exactly what generateSchedule draws: ${label}`, () => {
    const drawn = board(roster, config);
    const pools = drawPools(drawn);
    assert.equal(pools.length, 1);
    assert.deepEqual(pools[0].schedule, generateSchedule(drawn));
    assert.deepEqual(pools[0].score, scoreSchedule(generateSchedule(drawn), drawn));
    // No deal at all: the Roster itself, in its own order.
    assert.equal(pools[0].roster, roster);
    assert.deepEqual(pools[0].members, roster.map((_, i) => i));
  });

  test(`an absent pool count is one pool: ${label}`, () => {
    // A Config read from somewhere that predates Pools carries no count.
    const before = { ...board(roster, config), pools: undefined as unknown as number };
    assert.deepEqual(drawPools(before)[0].schedule, generateSchedule(before));
  });

  test(`one pool resolves the numbers resolveNumbers always did: ${label}`, () => {
    const { format = "rotating", mixed = false } = config;
    const numbers = resolveBoard(roster, config.courts, config.rounds, format, mixed, 1);
    const clamped = clampConfig({ roster, seed: 1, ...config });
    assert.equal(numbers.courts, clamped.courts);
    assert.equal(numbers.rounds, clamped.rounds);
    assert.equal(numbers.pools, 1);
  });
}

// ---- The count -------------------------------------------------------------

test("a pool needs a court's worth of names, so the count follows the roster", () => {
  assert.equal(maxPools(0), 1);
  assert.equal(maxPools(7), 1);
  assert.equal(maxPools(8), 2);
  assert.equal(maxPools(13), 3);
  assert.equal(resolvePools(13, 5), 3);
  assert.equal(resolvePools(13, 0), 1);
  assert.equal(resolvePools(13, undefined), 1);
  assert.equal(resolvePools(13, Number.NaN), 1);
  assert.equal(resolvePools(13, 2.7), 2);
});

test("4 to 32 a pool, and 64 on one board", () => {
  assert.equal(rosterCeiling(1), 32);
  assert.equal(rosterCeiling(2), 64);
  assert.equal(rosterCeiling(3), MAX_BOARD_SIZE);
  assert.equal(isSupportedBoardSize(32, 1), true);
  assert.equal(isSupportedBoardSize(33, 1), false);
  assert.equal(isSupportedBoardSize(40, 2), true);
  assert.equal(isSupportedBoardSize(64, 2), true);
  assert.equal(isSupportedBoardSize(65, 3), false);
  assert.equal(isSupportedBoardSize(3, 1), false);
});

// ---- The deal ----------------------------------------------------------------

test("the deal puts everyone in exactly one pool, as evenly as the numbers allow", () => {
  for (let n = 8; n <= 40; n++) {
    for (let pools = 2; pools <= maxPools(n); pools++) {
      const dealt = dealPools(names(n), "rotating", false, pools, n * 31 + pools);
      const sizes = dealt.map((members) => members.length);
      assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `n=${n} pools=${pools}`);
      assert.deepEqual(
        dealt.flat().sort((a, b) => a - b),
        Array.from({ length: n }, (_, i) => i),
      );
      // Roster order inside a Pool.
      for (const members of dealt) {
        assert.deepEqual(members, [...members].sort((a, b) => a - b));
      }
    }
  }
});

test("the same config and seed always deal the same pools", () => {
  const roster = names(20);
  assert.deepEqual(
    dealPools(roster, "rotating", false, 3, 42),
    dealPools(roster, "rotating", false, 3, 42),
  );
  assert.deepEqual(
    drawPools(board(roster, { pools: 3, seed: 42 })),
    drawPools(board(roster, { pools: 3, seed: 42 })),
  );
});

test("a redraw deals the pools again", () => {
  const roster = names(20);
  const deals = new Set(
    [1, 2, 3, 4, 5].map((seed) =>
      JSON.stringify(dealPools(roster, "rotating", false, 2, seed)),
    ),
  );
  assert.ok(deals.size > 1);
});

test("fixed partners deals pairings and never splits a pair across pools", () => {
  for (let n = 8; n <= 64; n += 2) {
    for (let pools = 2; pools <= Math.min(maxPools(n), 6); pools++) {
      for (const seed of [1, 7, 1234]) {
        const dealt = dealPools(names(n), "fixed", false, pools, seed);
        for (const members of dealt) {
          assert.equal(members.length % 2, 0);
          // Consecutive lines, both in: a pair is `2k` and `2k + 1`.
          for (let i = 0; i < members.length; i += 2) {
            assert.equal(members[i] % 2, 0);
            assert.equal(members[i + 1], members[i] + 1);
          }
        }
        const pairs = dealt.map((members) => members.length / 2);
        assert.ok(Math.max(...pairs) - Math.min(...pairs) <= 1);
      }
    }
  }
});

test("mixed doubles deals M and F as separate queues", () => {
  // Ten M and six F: each side as even as it can be, and the sizes too.
  const roster = names(16, ["M", "M", "M", "M", "M", "F", "F", "F"]);
  const pools = drawPools(board(roster, { mixed: true, pools: 2, seed: 9 }));
  const counts = pools.map((pool) => ({
    M: pool.roster.filter((player) => player.marker === "M").length,
    F: pool.roster.filter((player) => player.marker === "F").length,
  }));
  assert.deepEqual(counts, [
    { M: 5, F: 3 },
    { M: 5, F: 3 },
  ]);
});

function marked(m: number, f: number): Roster {
  // Interleaved rather than all the M first, so the deal is dealing a list
  // that looks like one somebody typed.
  const markers: string[] = [];
  for (let i = 0; i < Math.max(m, f); i++) {
    if (i < m) markers.push("M");
    if (i < f) markers.push("F");
  }
  return parseRoster(
    markers.map((marker, i) => `Player ${i + 1} ${marker}`).join("\n"),
    [],
    true,
  );
}

test("a roster mixable as a whole is never refused because of the deal", () => {
  for (let m = 2; m <= 32; m++) {
    for (let f = 2; f <= 32; f++) {
      if (m + f > MAX_BOARD_SIZE) continue;
      const roster = marked(m, f);
      for (let pools = 2; pools <= maxPools(m + f); pools++) {
        // Mixable as pools: at least a court's worth of each side per Pool.
        if (m < pools * 2 || f < pools * 2) continue;
        if (!isSupportedBoardSize(m + f, pools)) continue;
        const { courts } = resolveBoard(roster, undefined, undefined, "rotating", true, pools);
        assert.equal(
          boardObjection(roster, "rotating", true, pools, courts),
          null,
          `${m}M ${f}F in ${pools} pools`,
        );
      }
    }
  }
});

test("every side on a dealt mixed board is one M and one F", () => {
  for (const [m, f, pools] of [
    [8, 8, 2],
    [10, 6, 2],
    [9, 7, 3],
    [20, 20, 4],
  ] as const) {
    const drawn = board(marked(m, f), { mixed: true, pools, seed: m * 100 + f });
    for (const pool of drawPools(drawn)) {
      for (const round of pool.schedule.rounds) {
        for (const game of round.games) {
          for (const side of game.sides) {
            const sideMarkers = side.map((p) => pool.roster[p].marker).sort();
            assert.deepEqual(sideMarkers, ["F", "M"]);
          }
        }
      }
    }
  }
});

// ---- Each Pool is a board of its own --------------------------------------

test("a pool of 8 on 2 courts in rotating comes off the n=8 Table", () => {
  const pools = drawPools(board(names(16), { pools: 2, courts: 4, seed: 5 }));
  assert.equal(pools.length, 2);
  for (const pool of pools) {
    assert.equal(pool.roster.length, 8);
    assert.equal(pool.courts, 2);
    assert.equal(pool.schedule.source, "table");
    assert.equal(pool.score.cost, 0);
  }
});

/** A Pool's Schedule with its courts put back to zero, for comparing shapes. */
function shapeOf(pool: Pool): Schedule["rounds"] {
  return pool.schedule.rounds.map((round) => ({
    games: round.games.map((game) => ({ ...game, court: game.court - pool.firstCourt })),
    byes: round.byes,
  }));
}

test("two pools of the same size do not come out as the same grid", () => {
  for (const [format, n] of [
    ["rotating", 16],
    ["fixed", 24],
    ["singles", 20],
  ] as const) {
    for (const seed of [1, 2, 3, 99, 123456]) {
      const pools = drawPools(board(names(n), { pools: 2, seed, format }));
      assert.notDeepEqual(shapeOf(pools[0]), shapeOf(pools[1]), `${format} seed ${seed}`);
    }
  }
});

test("pool A keeps the raw seed", () => {
  // Pool A of a dealt board is drawn exactly as its sub-roster would be alone.
  const drawn = board(names(20), { pools: 2, seed: 777 });
  const [a] = drawPools(drawn);
  const alone = generateSchedule({
    roster: a.roster,
    courts: a.courts,
    rounds: drawn.rounds,
    seed: 777,
  });
  assert.deepEqual(a.schedule, alone);
});

test("every pool generates through its own format", () => {
  for (const format of ["rotating", "fixed", "singles"] as const) {
    const pools = drawPools(board(names(24), { pools: 3, format, seed: 4 }));
    for (const pool of pools) assert.equal(pool.score.format, format);
  }
});

// ---- Courts --------------------------------------------------------------------

test("courts are allocated one each, then to whoever sits out the most", () => {
  // 21 names in 3 Pools: 7, 7, 7. Three spare courts beyond one each, and
  // each Pool of 7 can fill one court only.
  const plan = planPools(names(21), "rotating", false, 3, 5);
  assert.ok(plan);
  assert.deepEqual(plan.shapes.map((s) => s.courts), [1, 1, 1]);
  assert.equal(plan.used, 3);

  // 26 names in 2 Pools of 13: each could fill 3 courts. Five courts goes
  // 1 + 1, then A (9 out), then B (9 out), then A again (lowest on a tie).
  const five = planPools(names(26), "rotating", false, 2, 5);
  assert.ok(five);
  assert.deepEqual(five.shapes.map((s) => s.courts), [3, 2]);

  const uneven = planPools(names(19), "rotating", false, 2, 3);
  assert.ok(uneven);
  // 10 and 9: A sits 6 out and B sits 5, so the spare goes to A.
  assert.deepEqual(uneven.shapes.map((s) => s.size), [10, 9]);
  assert.deepEqual(uneven.shapes.map((s) => s.courts), [2, 1]);
});

test("the spare court goes to the pool sitting the most out, not the first", () => {
  // 9 and 8 in singles: Pool A seats 8 of 9 on 4 courts; on 3 courts it
  // sits 3 while B sits 2.
  const plan = planPools(names(17), "singles", false, 2, 3);
  assert.ok(plan);
  assert.deepEqual(plan.shapes.map((s) => s.courts), [2, 1]);
  const more = planPools(names(17), "singles", false, 2, 4);
  assert.ok(more);
  // A (9 on 2 courts, 5 out) vs B (8 on 1, 6 out): B.
  assert.deepEqual(more.shapes.map((s) => s.courts), [2, 2]);
});

test("courts never move between rounds, and no two pools share one", () => {
  for (const format of ["rotating", "fixed", "singles"] as const) {
    const drawn = board(names(30), { pools: 3, format, seed: 12 });
    const pools = drawPools(drawn);
    const taken = new Set<number>();
    let next = 0;
    for (const pool of pools) {
      const courts = courtsOf(pool);
      // Its own run of courts, in order across the night.
      assert.deepEqual(
        [...courts].sort((a, b) => a - b),
        Array.from({ length: pool.courts }, (_, i) => pool.firstCourt + i),
      );
      assert.equal(pool.firstCourt, next);
      next += pool.courts;
      for (const round of pool.schedule.rounds) {
        assert.deepEqual(
          round.games.map((game) => game.court).sort((a, b) => a - b),
          [...courts].sort((a, b) => a - b),
        );
      }
      for (const court of courts) {
        assert.ok(!taken.has(court), `${format}: court ${court} twice`);
        taken.add(court);
      }
    }
  }
});

test("the itinerary names the real court", () => {
  const pools = drawPools(board(names(16), { pools: 2, courts: 4, seed: 5 }));
  const b = pools[1];
  const evening = itinerary(b.schedule, 0);
  for (const entry of evening) {
    if (entry.kind === "game") assert.ok(entry.court >= 2);
  }
});

test("every round seats or sits every player on the board, once", () => {
  const pools = drawPools(board(names(27), { pools: 3, seed: 3 }));
  for (let round = 0; round < pools[0].schedule.rounds.length; round++) {
    assert.deepEqual(everyoneIn(pools, round), Array.from({ length: 27 }, (_, i) => i));
  }
});

test("fewer courts than pools is refused with the arithmetic and both ways out", () => {
  const roster = names(24);
  const message = boardObjection(roster, "rotating", false, 3, 2);
  assert.equal(
    message,
    "3 pools need a court each, and there are 2 courts. Add a court, or drop to 2 pools.",
  );
  assert.equal(
    boardObjection(roster, "rotating", false, 3, 1),
    "3 pools need a court each, and there is 1 court. Add 2 courts, or drop to one pool.",
  );
  assert.throws(
    () => drawPools(board(roster, { pools: 3, courts: 2 })),
    UnsupportedConfigError,
  );
});

test("more courts than the pools can fill is not refused, and leaves courts empty", () => {
  // Two Pools of six fill one court each; three courts booked.
  const roster = names(12);
  assert.equal(boardObjection(roster, "rotating", false, 2, 3), null);
  const plan = planPools(roster, "rotating", false, 2, 3);
  assert.ok(plan);
  assert.equal(plan.used, 2);
  assert.equal(plan.courts, 3);
  const pools = drawPools(board(roster, { pools: 2, courts: 3 }));
  assert.equal(pools.reduce((total, pool) => total + pool.courts, 0), 2);
});

test("the default courts are what the pools can fill", () => {
  assert.equal(pooledCourtDefault(names(12), "rotating", false, 2), 2);
  assert.equal(pooledCourtDefault(names(16), "rotating", false, 2), 4);
  assert.equal(pooledCourtDefault(names(17), "singles", false, 2), 8);
  assert.equal(resolveBoard(names(12), undefined, undefined, "rotating", false, 2).courts, 2);
  // Never past what the whole roster could seat.
  assert.ok(pooledCourtDefault(names(30), "rotating", false, 3) <= maxCourts(30));
});

// ---- Refusals -----------------------------------------------------------------

test("a pool's refusal refuses the whole board, and names the pool", () => {
  // Ten M and three F: two Pools get two F and one F.
  const markers = [...Array(10).fill("M"), ...Array(3).fill("F")];
  const roster = parseRoster(
    markers.map((marker, i) => `Player ${i + 1} ${marker}`).join("\n"),
    [],
    true,
  );
  const drawn = board(roster, { mixed: true, pools: 2 });
  const message = boardObjection(roster, "rotating", true, 2, drawn.courts);
  assert.equal(
    message,
    "Pool B gets 1 F in the deal, and a court of mixed doubles needs 2 of each. Add 1 more F, or go back to one pool.",
  );
  assert.throws(() => drawPools(drawn), (error: Error) => {
    assert.ok(error instanceof UnsupportedConfigError);
    assert.match(error.message, /Pool B/);
    return true;
  });
});

test("the whole roster's refusals still come first", () => {
  assert.match(
    boardObjection(names(13), "fixed", false, 2, 3) ?? "",
    /^Fixed partners pairs the list up/,
  );
  const half = parseRoster("Ann M\nBo F\nCy M\nDi\nEd M\nFi F\nGus M\nHal F", [], true);
  assert.match(
    boardObjection(half, "rotating", true, 2, 2) ?? "",
    /is missing one/,
  );
});

test("at one pool the objection is exactly the one it always was", () => {
  const roster = names(10, ["M", "M", "M", "F"]);
  assert.equal(
    boardObjection(roster, "rotating", true, 1, 2),
    "2 courts of mixed doubles seats 4 M and 4 F every round, and the list has 2 F. Drop to 1 court, or add 2 more F.",
  );
});

test("more than 32 at one pool does not draw", () => {
  assert.throws(() => drawPools(board(names(40), { pools: 1 })), UnsupportedConfigError);
  const pools = drawPools(board(names(40), { pools: 2, seed: 3 }));
  assert.deepEqual(pools.map((pool) => pool.roster.length), [20, 20]);
});

// ---- Rounds ---------------------------------------------------------------------

test("every pool plays the same round count", () => {
  const pools = drawPools(board(names(23), { pools: 3, seed: 8 }));
  const counts = new Set(pools.map((pool) => pool.schedule.rounds.length));
  assert.equal(counts.size, 1);
});

test("the default round count is the shortest pool's natural length, capped at 8", () => {
  // 20 in two Pools of 10 on 4 courts: each natural length is 45 / 4 = 11,
  // so the cap sets it.
  assert.equal(resolveBoard(names(20), 4, undefined, "rotating", false, 2).rounds, 8);
  // 13 in Pools of 7 and 6, one court each: 21 / 2 = 10 and 15 / 2 = 7. B sets it.
  const plan = planPools(names(13), "rotating", false, 2, 2);
  assert.ok(plan);
  assert.equal(plan.natural, 7);
  assert.deepEqual(plan.shortest, ["B"]);
  assert.equal(resolveBoard(names(13), 2, undefined, "rotating", false, 2).rounds, 7);
  // Two Pools of 8 on 2 courts each tie at 7.
  const tied = planPools(names(16), "rotating", false, 2, 4);
  assert.ok(tied);
  assert.deepEqual(tied.shortest, ["A", "B"]);
});

// ---- Finding a player ------------------------------------------------------------

test("locate maps a roster index to its pool and its place in it", () => {
  const pools = drawPools(board(names(20), { pools: 2, seed: 6 }));
  for (let player = 0; player < 20; player++) {
    const found = locate(pools, player);
    assert.ok(found);
    assert.equal(pools[found.pool].members[found.index], player);
  }
  assert.equal(locate(pools, 20), null);
});

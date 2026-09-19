import assert from "node:assert/strict";
import test from "node:test";

import { defaultRounds, MAX_ROUNDS, maxCourts } from "./config.ts";
import { parseRoster } from "./roster.ts";
import { scoreSchedule } from "./scorer.ts";
import { generateSchedule, UnsupportedConfigError } from "./schedule.ts";
import { TABLES } from "./tables.ts";
import {
  MAX_ROSTER_SIZE,
  MIN_ROSTER_SIZE,
  type RotatingConfig,
  type Schedule,
} from "./types.ts";

/**
 * A rotating Config. Typed as one rather than as a bare `Config` so the Scorer
 * hands back the rotating reading — the Format these tests are about, named by
 * leaving it out, which is also how every Config written before Formats
 * existed names it.
 */
function configFor(
  n: number,
  overrides: Partial<RotatingConfig> = {},
): RotatingConfig {
  const roster = parseRoster(
    Array.from({ length: n }, (_, i) => `Player ${i + 1}`).join("\n"),
  );
  return { roster, courts: maxCourts(n), seed: 1, ...overrides };
}

function seatedIn(schedule: Schedule): number[][] {
  return schedule.rounds.map((round) =>
    round.games
      .flatMap((game) => [...game.teams[0], ...game.teams[1]])
      .sort((a, b) => a - b),
  );
}

/**
 * A Schedule as plain arrays, for comparing one whole board against another.
 * `Team` is a readonly tuple and `assert.deepEqual` reads that difference, so
 * a pinned board written as a literal would never match without this.
 */
function asPlain(schedule: Schedule) {
  return schedule.rounds.map((round) => ({
    games: round.games.map((game) => [[...game.teams[0]], [...game.teams[1]]]),
    byes: [...round.byes],
  }));
}

/**
 * Every Round has to seat each of its players exactly once and account for
 * everyone else as a Bye. A Schedule that fails this is not a worse schedule,
 * it is not a schedule.
 */
function assertWellFormed(schedule: Schedule, n: number, courts: number): void {
  for (const [index, round] of schedule.rounds.entries()) {
    const where = `round ${index + 1}`;
    assert.equal(round.games.length, courts, `${where} court count`);
    assert.deepEqual(
      round.games.map((game) => game.court),
      Array.from({ length: courts }, (_, i) => i),
      `${where} court numbering`,
    );

    const seats = round.games.flatMap((game) => [...game.teams[0], ...game.teams[1]]);
    const everyone = [...seats, ...round.byes].sort((a, b) => a - b);
    assert.deepEqual(
      everyone,
      Array.from({ length: n }, (_, i) => i),
      `${where} seats everyone exactly once`,
    );
    assert.equal(round.byes.length, n - courts * 4, `${where} bye count`);
  }
}

test("every stored Table scores zero at full length", () => {
  for (const table of TABLES) {
    const config = configFor(table.n, { rounds: table.n - 1 });
    const schedule = generateSchedule(config);

    assert.equal(schedule.source, "table");
    assert.equal(schedule.rounds.length, table.n - 1, `n=${table.n} round count`);

    const score = scoreSchedule(schedule, config);
    assert.equal(score.cost, 0, `n=${table.n} cost`);
    assert.equal(score.repeatedPartnerPairs, 0, `n=${table.n} partner repeats`);
    assert.equal(score.maxPartnerCount, 1, `n=${table.n} max partner count`);
    assert.equal(score.maxOpponentCount, 2, `n=${table.n} max opponent count`);
    assert.equal(score.byeSpread, 0, `n=${table.n} bye spread`);
  }
});

test("every prefix of a stored Table also scores zero", () => {
  // ADR 0002's whole claim: a Table is stored whole and served truncated, so
  // every leading run has to stand on its own.
  for (const table of TABLES) {
    for (let rounds = 1; rounds < table.n - 1; rounds++) {
      const config = configFor(table.n, { rounds });
      const schedule = generateSchedule(config);

      assert.equal(schedule.source, "table", `n=${table.n} prefix source`);
      assert.equal(schedule.rounds.length, rounds, `n=${table.n} prefix length`);
      const score = scoreSchedule(schedule, config);
      assert.equal(score.cost, 0, `n=${table.n} prefix of ${rounds} cost`);
      assert.equal(score.maxPartnerCount, 1, `n=${table.n} prefix of ${rounds} partners`);
      assert.ok(score.maxOpponentCount <= 2, `n=${table.n} prefix of ${rounds} opponents`);
    }
  }
});

test("a Table seats every player exactly once per round and nobody sits out", () => {
  for (const table of TABLES) {
    const config = configFor(table.n, { rounds: table.n - 1 });
    const schedule = generateSchedule(config);
    const everyone = Array.from({ length: table.n }, (_, i) => i);

    assertWellFormed(schedule, table.n, table.courts);
    for (const [index, seats] of seatedIn(schedule).entries()) {
      assert.deepEqual(seats, everyone, `n=${table.n} round ${index + 1} seating`);
    }
  }
});

test("a Table is served for the default round count, without searching", () => {
  for (const table of TABLES) {
    assert.equal(generateSchedule(configFor(table.n)).source, "table");
    assert.equal(
      generateSchedule(configFor(table.n)).rounds.length,
      defaultRounds(table.n, table.courts),
    );
  }
  for (const table of TABLES) {
    assert.equal(table.courts, table.n / 4);
  }
});

test("every roster size from 4 to 32 schedules at its default court count", () => {
  for (let n = MIN_ROSTER_SIZE; n <= MAX_ROSTER_SIZE; n++) {
    const config = configFor(n);
    const schedule = generateSchedule(config);
    const courts = maxCourts(n);

    assert.equal(
      schedule.rounds.length,
      defaultRounds(n, courts),
      `n=${n} round count`,
    );
    assertWellFormed(schedule, n, courts);

    const score = scoreSchedule(schedule, config);
    assert.equal(score.repeatedPartnerPairs, 0, `n=${n} partner repeats`);
    // Byes rotate: over a default evening nobody sits out more than once more
    // than anyone else, whatever the remainder is.
    assert.ok(score.byeSpread <= 1, `n=${n} bye spread was ${score.byeSpread}`);
  }
});

test("a roster that does not divide by four rotates its byes", () => {
  for (const n of [9, 10, 11, 14, 22, 31]) {
    const courts = maxCourts(n);
    const config = configFor(n, { courts, rounds: 8 });
    const schedule = generateSchedule(config);

    assert.equal(schedule.source, "generated", `n=${n} source`);
    assertWellFormed(schedule, n, courts);

    const score = scoreSchedule(schedule, config);
    const sitting = n - courts * 4;
    assert.ok(sitting > 0, `n=${n} should have byes at ${courts} courts`);
    assert.equal(
      score.byes.reduce((total, count) => total + count, 0),
      sitting * 8,
      `n=${n} total byes`,
    );
    assert.ok(score.byeSpread <= 1, `n=${n} bye spread was ${score.byeSpread}`);
    assert.equal(score.repeatedPartnerPairs, 0, `n=${n} partner repeats`);
  }
});

test("fewer courts than the roster could fill still schedules, with byes", () => {
  // The n=8 Table assumes two courts; a club with one gets a generated
  // schedule where half the roster sits out each round, not the Table
  // squeezed into four seats (ADR 0002).
  for (const [n, courts] of [
    [8, 1],
    [16, 2],
    [12, 1],
    [20, 3],
  ] as const) {
    const config = configFor(n, { courts, rounds: 6 });
    const schedule = generateSchedule(config);

    assert.equal(schedule.source, "generated", `n=${n} c=${courts} source`);
    assertWellFormed(schedule, n, courts);

    const score = scoreSchedule(schedule, config);
    assert.equal(score.repeatedPartnerPairs, 0, `n=${n} c=${courts} partner repeats`);
    assert.ok(score.byeSpread <= 1, `n=${n} c=${courts} bye spread`);
  }
});

test("a roster size with no stored Table still gets a clean schedule", () => {
  for (const n of [10, 14, 20, 24]) {
    const courts = maxCourts(n);
    const config = configFor(n, { rounds: 6 });
    const schedule = generateSchedule(config);

    assert.equal(schedule.source, "generated", `n=${n} source`);
    assertWellFormed(schedule, n, courts);
    assert.equal(
      scoreSchedule(schedule, config).repeatedPartnerPairs,
      0,
      `n=${n} partner repeats`,
    );
  }
});

test("more rounds than the Table holds continues from it rather than restarting", () => {
  const table = TABLES[0];
  const full = generateSchedule(configFor(table.n, { rounds: table.n - 1 }));
  const extended = generateSchedule(configFor(table.n, { rounds: table.n + 4 }));

  assert.equal(extended.source, "generated");
  assert.equal(extended.rounds.length, table.n + 4);
  // The Table is the prefix, untouched, and the search only ran past it.
  assert.deepEqual(extended.rounds.slice(0, table.n - 1), full.rounds);
  assertWellFormed(extended, table.n, table.courts);
});

test("past the natural length repeats are reported, not hidden", () => {
  // Twelve rounds of eight players is 48 partnerships drawn from 28 possible
  // pairs, so at least 20 have to repeat. The Scorer says so plainly rather
  // than the engine refusing or quietly truncating.
  const config = configFor(8, { rounds: 12 });
  const schedule = generateSchedule(config);
  const score = scoreSchedule(schedule, config);

  assert.equal(schedule.rounds.length, 12);
  assert.equal(score.repeatedPartnerPairs, 20);
  assert.equal(score.maxPartnerCount, 2);
});

test("the same config and seed always give the same schedule", () => {
  const config = configFor(14, { rounds: 7, seed: 99 });
  assert.deepEqual(generateSchedule(config), generateSchedule(config));
});

test("a new seed gives a different schedule for the same roster", () => {
  const roster = configFor(14).roster;
  const one = generateSchedule({ roster, courts: 3, rounds: 7, seed: 1 });
  const two = generateSchedule({ roster, courts: 3, rounds: 7, seed: 2 });
  assert.notDeepEqual(one.rounds, two.rounds);
});

test("roster identity survives a regeneration with a new seed", () => {
  // The engine works in positions; the ids are what a later Lock will point
  // at, so re-seeding must not disturb them even though the seating moves.
  const text = ["Ben", "Anna", "Mike", "Mike", "Jorja", "Gabe", "Cat", "JW", "Fed", "Tyson"].join("\n");
  const roster = parseRoster(text);
  const before = generateSchedule({ roster, courts: 2, rounds: 6, seed: 1 });
  const reparsed = parseRoster(text, roster);
  const after = generateSchedule({ roster: reparsed, courts: 2, rounds: 6, seed: 2 });

  assert.deepEqual(
    reparsed.map((player) => player.id),
    roster.map((player) => player.id),
  );
  assert.equal(new Set(reparsed.map((player) => player.id)).size, 10);
  assert.notDeepEqual(after.rounds, before.rounds);
});

test("courts above what the roster seats are clamped, not obeyed", () => {
  const schedule = generateSchedule(configFor(8, { courts: 9, rounds: 3 }));
  assertWellFormed(schedule, 8, 2);
});

test("a round count past the search limit is clamped", () => {
  const schedule = generateSchedule(configFor(12, { rounds: MAX_ROUNDS + 10 }));
  assert.equal(schedule.rounds.length, MAX_ROUNDS);
});

test("roster sizes outside 4-32 are refused at the boundary", () => {
  for (const n of [0, 3, 33, 40]) {
    assert.throws(
      () => generateSchedule(configFor(n, { courts: 2 })),
      UnsupportedConfigError,
      `n=${n}`,
    );
  }
  for (const n of [MIN_ROSTER_SIZE, MAX_ROSTER_SIZE]) {
    assert.ok(generateSchedule(configFor(n)).rounds.length > 0, `n=${n}`);
  }
});

test("a new seed redraws a Table-served schedule, and it still scores zero", () => {
  // Without this, the three sizes with a stored Table are exactly the sizes
  // where "draw it again" does nothing. A Table's balance is a property of its
  // shape, not of which player sits in which slot, so the Seed relabels who
  // takes each seat and the guarantees come through untouched.
  for (const table of TABLES) {
    const { roster } = configFor(table.n);
    const base = { roster, courts: table.courts, rounds: table.n - 1 };
    const one = generateSchedule({ ...base, seed: 1 });
    const two = generateSchedule({ ...base, seed: 7 });

    assert.equal(one.source, "table", `n=${table.n} first source`);
    assert.equal(two.source, "table", `n=${table.n} second source`);
    assert.notDeepEqual(one.rounds, two.rounds, `n=${table.n} redraw`);

    const score = scoreSchedule(two, { ...base, seed: 7 });
    assert.equal(score.cost, 0, `n=${table.n} redrawn cost`);
    assert.equal(score.maxPartnerCount, 1, `n=${table.n} redrawn partners`);
    assertWellFormed(two, table.n, table.courts);
  }
});

test("a redrawn Table seats the same players, only in different places", () => {
  const table = TABLES[0];
  const { roster } = configFor(table.n);
  const base = { roster, courts: table.courts, rounds: 4 };
  const everyone = Array.from({ length: table.n }, (_, i) => i);

  for (const seats of seatedIn(generateSchedule({ ...base, seed: 12345 }))) {
    assert.deepEqual(seats, everyone);
  }
});

/**
 * The pinned boards. These two are the whole of RR-4.1's answer to "does this
 * milestone owe `GENERATOR_VERSION` a bump" (#543).
 *
 * The rule the code states is narrower than "a milestone that adds a Format
 * owes a bump": a bump is owed when a change alters what an *existing* Config
 * generates. Rotating is the only Format any existing Config or Share Link is
 * in, so the question is only ever whether rotating moved — and that is a
 * thing a test can decide rather than a thing to judge.
 *
 * One board from each path, because they can move independently: the Table
 * lookup with its Seed-driven relabelling, and the randomized greedy search.
 * If either of these has to be edited, the Seed no longer reproduces the board
 * it named, every link already in a group chat is drawing something else, and
 * `GENERATOR_VERSION` in `persistence/share-link.ts` is owed the bump that
 * puts #494's notice on them.
 *
 * Deliberately whole boards rather than scores. A Schedule that still costs
 * zero is not the same Schedule, and it is the seat every name sat in that a
 * reader is comparing against the organizer's screen.
 */
test("the Table path draws the board it drew before", () => {
  const config = { ...configFor(8), courts: 2, rounds: 4, seed: 3 };
  const schedule = generateSchedule(config);

  assert.equal(schedule.source, "table");
  assert.deepEqual(asPlain(schedule), [
    { games: [[[7, 4], [1, 6]], [[3, 0], [2, 5]]], byes: [] },
    { games: [[[7, 6], [0, 5]], [[4, 1], [3, 2]]], byes: [] },
    { games: [[[7, 5], [4, 2]], [[1, 3], [6, 0]]], byes: [] },
    { games: [[[7, 2], [3, 6]], [[4, 5], [1, 0]]], byes: [] },
  ]);
});

test("the search path draws the board it drew before", () => {
  // A Roster that divides by neither four nor the court count, so it reaches
  // the search cold and takes Byes: the path with the most moving parts.
  const config = { ...configFor(13), courts: 3, rounds: 5, seed: 7 };
  const schedule = generateSchedule(config);

  assert.equal(schedule.source, "generated");
  assert.deepEqual(asPlain(schedule), [
    { games: [[[11, 9], [1, 10]], [[7, 8], [4, 2]], [[0, 3], [12, 6]]], byes: [5] },
    { games: [[[0, 8], [4, 3]], [[11, 10], [7, 9]], [[1, 5], [2, 12]]], byes: [6] },
    { games: [[[2, 6], [12, 9]], [[3, 10], [0, 5]], [[11, 4], [7, 1]]], byes: [8] },
    { games: [[[2, 8], [3, 9]], [[7, 5], [0, 12]], [[1, 11], [4, 6]]], byes: [10] },
    { games: [[[3, 8], [10, 5]], [[2, 7], [1, 6]], [[11, 12], [4, 0]]], byes: [9] },
  ]);
});

/**
 * Mixed doubles (#545). A hard constraint inside rotating's seating rather
 * than a Format of its own, so what these check is that the constraint holds
 * in every Game of every Round — never that it usually does.
 */

/** A marked Roster: `m` lines ending in M, then `f` ending in F. */
function mixedConfig(
  m: number,
  f: number,
  overrides: Partial<RotatingConfig> = {},
): RotatingConfig {
  const roster = parseRoster(
    [
      ...Array.from({ length: m }, (_, i) => `Man ${i + 1} M`),
      ...Array.from({ length: f }, (_, i) => `Woman ${i + 1} F`),
    ].join("\n"),
    [],
    true,
  );
  return {
    roster,
    courts: maxCourts(m + f),
    seed: 1,
    mixed: true,
    ...overrides,
  };
}

/** Which marker each Roster position carries, for reading a board back. */
function markersIn(config: RotatingConfig): string[] {
  return config.roster.map((player) => player.marker ?? "-");
}

test("every team in every game is one M and one F", () => {
  for (const [m, f, courts, seed] of [
    [6, 6, 3, 1],
    [8, 4, 2, 2],
    [5, 7, 2, 3],
    [10, 6, 3, 4],
  ] as const) {
    const config = mixedConfig(m, f, { courts, rounds: 8, seed });
    const marker = markersIn(config);

    for (const round of generateSchedule(config).rounds) {
      for (const game of round.games) {
        for (const team of game.teams) {
          assert.deepEqual(
            [marker[team[0]], marker[team[1]]].sort(),
            ["F", "M"],
            `n=${m}+${f} courts=${courts} seed=${seed}`,
          );
        }
      }
    }
  }
});

test("a mixed board seats 2c of each marker and sits the rest down", () => {
  const config = mixedConfig(10, 6, { courts: 3, rounds: 6 });
  const marker = markersIn(config);

  for (const round of generateSchedule(config).rounds) {
    const seated = round.games.flatMap((game) => [
      ...game.teams[0],
      ...game.teams[1],
    ]);
    assert.equal(seated.filter((p) => marker[p] === "M").length, 6);
    assert.equal(seated.filter((p) => marker[p] === "F").length, 6);
    // Nobody is in two places at once, and everybody is somewhere.
    assert.equal(new Set([...seated, ...round.byes]).size, config.roster.length);
  }
});

test("byes rotate evenly on a mixed board whose counts allow the courts", () => {
  // Uneven sides on purpose: ten M and six F on three courts sits four M and
  // nothing else down every Round, so the two sides take their Byes off
  // separate queues and the verdict has to be asked once per side.
  const config = mixedConfig(10, 6, { courts: 3, rounds: 10 });
  const score = scoreSchedule(generateSchedule(config), config);
  assert.equal(score.byesRotateEvenly, true);
});

test("coverage on a mixed board counts out of M x F", () => {
  const config = mixedConfig(6, 6, { courts: 3, rounds: 8 });
  const score = scoreSchedule(generateSchedule(config), config);
  assert.equal(score.pairingsPossible, 36);
  // The same Roster drawn without the constraint has the whole triangle.
  const plain = scoreSchedule(
    generateSchedule({ ...config, mixed: false }),
    { ...config, mixed: false },
  );
  assert.equal(plain.pairingsPossible, 66);
});

test("a fully covered mixed board says every possible pairing has played", () => {
  // Four M and four F on two courts spends four partnerships a Round, so the
  // sixteen cross-marker pairs are gone in four Rounds and there is nothing
  // left to reach.
  const config = mixedConfig(4, 4, { courts: 2, rounds: 4 });
  const score = scoreSchedule(generateSchedule(config), config);
  assert.equal(score.pairingsPossible, 16);
  assert.equal(score.pairingsPlayed, 16);
  assert.equal(score.repeatedPartnerPairs, 0);
});

test("a half-marked roster refuses rather than drawing a board that may be mixed", () => {
  const roster = parseRoster("Sam M\nAnna F\nBen M\nJorja", [], true);
  assert.throws(
    () => generateSchedule({ roster, courts: 1, seed: 1, mixed: true }),
    UnsupportedConfigError,
  );
  // The same list draws perfectly well with the constraint off.
  assert.ok(generateSchedule({ roster, courts: 1, seed: 1 }));
});

test("counts that cannot fill the chosen courts refuse", () => {
  assert.throws(
    () => generateSchedule(mixedConfig(10, 4, { courts: 3, rounds: 4 })),
    UnsupportedConfigError,
  );
  // Two courts is the way out the message names, and it draws.
  assert.ok(generateSchedule(mixedConfig(10, 4, { courts: 2, rounds: 4 })));
});

test("a mixed board never comes off a Table, whatever the roster size", () => {
  // Eight players on two courts is the Table path for an unmixed board, and a
  // Table is a construction over bare positions that knows nothing about
  // markers.
  const config = mixedConfig(4, 4, { courts: 2, rounds: 4 });
  assert.equal(generateSchedule(config).source, "generated");
  assert.equal(
    generateSchedule({ ...config, mixed: false }).source,
    "table",
  );
});

test("the constraint is dropped in any format that cannot carry it", () => {
  const roster = parseRoster("Sam M\nAnna F\nBen M\nJorja F", [], true);
  // Fixed partners takes its pairs off the list two lines at a time, so a
  // marker has nothing left to decide — and an unmarked line there must not
  // start refusing because a stale flag came along for the ride.
  const drawn = generateSchedule({
    roster: parseRoster("Sam M\nAnna F\nBen\nJorja", [], true),
    courts: 1,
    seed: 1,
    format: "fixed",
    mixed: true,
  });
  assert.equal(drawn.rounds.length > 0, true);
  assert.ok(generateSchedule({ roster, courts: 1, seed: 1, format: "fixed" }));
});

test("the same config and seed draw the same mixed board twice", () => {
  const config = mixedConfig(7, 5, { courts: 2, rounds: 6, seed: 99 });
  assert.deepEqual(
    asPlain(generateSchedule(config)),
    asPlain(generateSchedule(config)),
  );
});

test("the default round count follows the smaller mixed supply", () => {
  // Six and six on three courts has 36 cross-marker partnerships and spends
  // six a Round, so the rotation runs six Rounds rather than the eleven the
  // whole triangle would suggest.
  assert.equal(defaultRounds(12, 3, "rotating", 36), 6);
  assert.equal(defaultRounds(12, 3, "rotating"), 8);
});

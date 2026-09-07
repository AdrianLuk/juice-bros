import assert from "node:assert/strict";
import test from "node:test";

import { defaultRounds, MAX_ROUNDS, maxCourts } from "./config.ts";
import { parseRoster } from "./roster.ts";
import { scoreSchedule } from "./scorer.ts";
import { generateSchedule, UnsupportedConfigError } from "./schedule.ts";
import { TABLES } from "./tables.ts";
import { MAX_ROSTER_SIZE, MIN_ROSTER_SIZE, type Config, type Schedule } from "./types.ts";

function configFor(n: number, overrides: Partial<Config> = {}): Config {
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

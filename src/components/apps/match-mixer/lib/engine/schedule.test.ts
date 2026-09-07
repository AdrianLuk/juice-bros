import assert from "node:assert/strict";
import test from "node:test";

import { parseRoster } from "./roster.ts";
import { scoreSchedule } from "./scorer.ts";
import { generateSchedule, UnsupportedConfigError } from "./schedule.ts";
import { TABLES } from "./tables.ts";
import { SUPPORTED_ROSTER_SIZES, type Config, type Schedule } from "./types.ts";

function configFor(n: number, overrides: Partial<Config> = {}): Config {
  const roster = parseRoster(
    Array.from({ length: n }, (_, i) => `Player ${i + 1}`).join("\n"),
  );
  return { roster, courts: n / 4, seed: 1, ...overrides };
}

function seatedIn(schedule: Schedule): number[][] {
  return schedule.rounds.map((round) =>
    round.games
      .flatMap((game) => [...game.teams[0], ...game.teams[1]])
      .sort((a, b) => a - b),
  );
}

test("every stored Table scores zero at full length", () => {
  for (const table of TABLES) {
    const config = configFor(table.n);
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
    const config = configFor(table.n);
    const schedule = generateSchedule(config);
    const everyone = Array.from({ length: table.n }, (_, i) => i);

    for (const [index, seats] of seatedIn(schedule).entries()) {
      assert.deepEqual(seats, everyone, `n=${table.n} round ${index + 1} seating`);
    }
    for (const round of schedule.rounds) {
      assert.equal(round.byes.length, 0);
      assert.equal(round.games.length, table.courts);
      assert.deepEqual(
        round.games.map((game) => game.court),
        Array.from({ length: table.courts }, (_, i) => i),
      );
    }
  }
});

test("Tables cover exactly the supported roster sizes at n / 4 courts", () => {
  assert.deepEqual(
    TABLES.map((table) => table.n),
    [...SUPPORTED_ROSTER_SIZES],
  );
  for (const table of TABLES) {
    assert.equal(table.courts, table.n / 4);
  }
});

test("more rounds than the Table holds is clamped, not padded", () => {
  const config = configFor(8, { rounds: 20 });
  assert.equal(generateSchedule(config).rounds.length, 7);
});

test("a roster size without a Table is refused rather than half-served", () => {
  for (const n of [10, 14, 20]) {
    assert.throws(
      () => generateSchedule(configFor(n, { courts: Math.floor(n / 4) })),
      UnsupportedConfigError,
      `n=${n}`,
    );
  }
});

test("a supported roster size at the wrong court count is refused", () => {
  // The n=8 Table assumes two courts; handing it to a club with one would
  // seat eight players in four seats (ADR 0002).
  assert.throws(
    () => generateSchedule(configFor(8, { courts: 1 })),
    UnsupportedConfigError,
  );
});

test("roster sizes outside 4-32 are refused at the boundary", () => {
  for (const n of [0, 3, 33]) {
    assert.throws(
      () => generateSchedule(configFor(n, { courts: 2 })),
      UnsupportedConfigError,
      `n=${n}`,
    );
  }
});

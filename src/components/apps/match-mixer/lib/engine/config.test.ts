import assert from "node:assert/strict";
import test from "node:test";

import {
  clampConfig,
  clampCourts,
  clampRounds,
  DEFAULT_ROUND_TARGET,
  defaultRounds,
  isSupportedRosterSize,
  MAX_ROUNDS,
  maxCourts,
  naturalLength,
} from "./config.ts";
import { parseRoster } from "./roster.ts";
import { TABLES } from "./tables.ts";
import { MAX_ROSTER_SIZE, MIN_ROSTER_SIZE, type Config } from "./types.ts";

function config(n: number, overrides: Partial<Config> = {}): Config {
  return {
    roster: parseRoster(
      Array.from({ length: n }, (_, i) => `Player ${i + 1}`).join("\n"),
    ),
    courts: maxCourts(n),
    seed: 1,
    ...overrides,
  };
}

test("the court ceiling is what the roster can actually seat", () => {
  assert.equal(maxCourts(4), 1);
  assert.equal(maxCourts(7), 1);
  assert.equal(maxCourts(8), 2);
  assert.equal(maxCourts(11), 2);
  assert.equal(maxCourts(32), 8);
});

test("courts clamp to the ceiling at the boundary rather than overflowing", () => {
  // Two courts is nine seats short of what four players can fill.
  assert.equal(clampCourts(4, 2), 1);
  assert.equal(clampCourts(8, 3), 2);
  assert.equal(clampCourts(8, 2), 2);
  assert.equal(clampCourts(32, 9), 8);
  assert.equal(clampCourts(32, 8), 8);
});

test("courts never clamp below one, however the field is emptied", () => {
  for (const asked of [0, -3, 0.4]) {
    assert.equal(clampCourts(16, asked), 1, `courts=${asked}`);
  }
  // A field with nothing in it is not a request for zero courts, it is a
  // request for the default.
  assert.equal(clampCourts(16, Number.NaN), maxCourts(16));
});

test("the natural length of a Table's roster is the whist length", () => {
  // The two definitions have to agree, or the rounds field would offer a
  // default the Table cannot serve.
  for (const table of TABLES) {
    assert.equal(
      naturalLength(table.n, table.courts),
      table.n - 1,
      `n=${table.n}`,
    );
    assert.equal(naturalLength(table.n, table.courts), table.rounds.length);
  }
});

test("fewer courts means the rotation takes longer to use up every pair", () => {
  assert.equal(naturalLength(8, 2), 7);
  assert.equal(naturalLength(8, 1), 14);
  // 10 players is 45 pairs, spent 4 at a time.
  assert.equal(naturalLength(10, 2), 11);
});

test("rounds default to an evening, not the whole rotation", () => {
  assert.equal(defaultRounds(16, 4), DEFAULT_ROUND_TARGET);
  assert.equal(defaultRounds(32, 8), DEFAULT_ROUND_TARGET);
  // Four players run out of new partnerships after three rounds, so that is
  // the whole schedule there is to offer.
  assert.equal(defaultRounds(4, 1), 3);
  assert.equal(defaultRounds(8, 2), 7);
});

test("rounds clamp between one and what the generator will search for", () => {
  assert.equal(clampRounds(0), 1);
  assert.equal(clampRounds(1), 1);
  assert.equal(clampRounds(MAX_ROUNDS), MAX_ROUNDS);
  assert.equal(clampRounds(MAX_ROUNDS + 1), MAX_ROUNDS);
  assert.equal(clampRounds(Number.NaN), DEFAULT_ROUND_TARGET);
});

test("roster bounds are 4 to 32 inclusive, and refused either side", () => {
  assert.equal(isSupportedRosterSize(MIN_ROSTER_SIZE), true);
  assert.equal(isSupportedRosterSize(MAX_ROSTER_SIZE), true);
  assert.equal(isSupportedRosterSize(MIN_ROSTER_SIZE - 1), false);
  assert.equal(isSupportedRosterSize(MAX_ROSTER_SIZE + 1), false);
  assert.equal(isSupportedRosterSize(0), false);
});

test("clampConfig brings both edited fields inside what the roster supports", () => {
  const clamped = clampConfig(config(8, { courts: 5, rounds: 99 }));
  assert.equal(clamped.courts, 2);
  assert.equal(clamped.rounds, MAX_ROUNDS);
});

test("clampConfig resolves an absent round count against the clamped courts", () => {
  // Courts are clamped first: at one court a roster of eight has fourteen
  // rounds of new partnerships available, so the default is the full target.
  const clamped = clampConfig(config(8, { courts: 1 }));
  assert.equal(clamped.courts, 1);
  assert.equal(clamped.rounds, DEFAULT_ROUND_TARGET);
});

test("clampConfig leaves the roster alone", () => {
  // Out of range is a message, not a silent trim of somebody off the end.
  const tooMany = config(40);
  assert.equal(clampConfig(tooMany).roster.length, 40);
});

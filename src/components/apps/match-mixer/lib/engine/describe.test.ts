import assert from "node:assert/strict";
import test from "node:test";

import { describeConfig, describeNumbers } from "./describe.ts";

test("names the roster size, court count and round count", () => {
  const line = describeConfig({ players: 8, courts: 2, rounds: 7 });
  assert.match(line, /^8 players on 2 courts, 7 rounds\./);
});

test("singular court and round read as singular", () => {
  const line = describeConfig({ players: 4, courts: 1, rounds: 1 });
  assert.match(line, /^4 players on 1 court, 1 round\./);
});

test("a roster that fills its courts says nobody sits out", () => {
  for (const [players, courts] of [
    [8, 2],
    [12, 3],
    [16, 4],
  ] as const) {
    const line = describeConfig({ players, courts, rounds: 6 });
    assert.match(line, /Everybody plays every round\./, `n=${players}`);
  }
});

test("a roster that does not fill its courts says how many sit out", () => {
  assert.match(
    describeConfig({ players: 13, courts: 3, rounds: 6 }),
    /1 player sits out each round, taking turns\./,
  );
  assert.match(
    describeConfig({ players: 14, courts: 3, rounds: 6 }),
    /2 players sit out each round, taking turns\./,
  );
});

test("within the natural length it says no partner has to repeat", () => {
  assert.match(
    describeConfig({ players: 8, courts: 2, rounds: 7 }),
    /No partner has to repeat\.$/,
  );
});

test("past the natural length it says where repeats begin", () => {
  // Eight players hold 28 pairs; two courts spend four a round, so round 8 is
  // the first that cannot be drawn from fresh pairs.
  assert.match(
    describeConfig({ players: 8, courts: 2, rounds: 12 }),
    /Partners start repeating after round 7\.$/,
  );
});

test("the line is one sentence per clause and never a promise about balance", () => {
  const line = describeConfig({ players: 13, courts: 3, rounds: 20 });
  assert.equal(line.split(". ").length, 3);
  assert.doesNotMatch(line, /nobody repeats|guaranteed|balanced/i);
});

test("the numbers alone are the head of the same sentence, without the stop", () => {
  const shape = { players: 13, courts: 3, rounds: 8 };
  assert.equal(describeNumbers(shape), "13 players on 3 courts, 8 rounds");
  assert.ok(describeConfig(shape).startsWith(`${describeNumbers(shape)}.`));
});

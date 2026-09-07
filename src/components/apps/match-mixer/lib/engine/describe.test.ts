import assert from "node:assert/strict";
import test from "node:test";

import {
  describeConfig,
  describeNumbers,
  describeUnsupportedRoster,
} from "./describe.ts";

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

test("within the natural length it says the partnerships go round", () => {
  // A count of unused pairs, which is what the arithmetic establishes. It is
  // deliberately not a promise that the draw uses them without collision:
  // that is the Scorer's to report, off the Schedule that came out.
  assert.match(
    describeConfig({ players: 8, courts: 2, rounds: 7 }),
    /There are enough partnerships to go round\.$/,
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
  assert.doesNotMatch(line, /nobody repeats|guaranteed|balanced|has to repeat/i);
});

test("the numbers alone are the head of the same sentence, without the stop", () => {
  const shape = { players: 13, courts: 3, rounds: 8 };
  assert.equal(describeNumbers(shape), "13 players on 3 courts, 8 rounds");
  assert.ok(describeConfig(shape).startsWith(`${describeNumbers(shape)}.`));
});

test("a roster too small to seat still gets a line, counting what is missing", () => {
  assert.equal(describeUnsupportedRoster(1), "1 player. 3 more and there is a court's worth.");
  assert.equal(describeUnsupportedRoster(3), "3 players. 1 more and there is a court's worth.");
});

test("a roster too big to seat says how far over it is", () => {
  assert.equal(describeUnsupportedRoster(33), "33 players. 1 more than one sheet holds.");
  assert.equal(describeUnsupportedRoster(40), "40 players. 8 more than one sheet holds.");
});

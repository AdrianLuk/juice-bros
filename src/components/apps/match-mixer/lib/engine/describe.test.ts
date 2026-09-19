import assert from "node:assert/strict";
import test from "node:test";

import {
  describeConfig,
  describeNumbers,
  describeUnsupportedRoster,
  type ConfigShape,
} from "./describe.ts";

/** A rotating shape, which is what most of these are asking about. */
function shape(
  players: number,
  courts: number,
  rounds: number,
  format: ConfigShape["format"] = "rotating",
): ConfigShape {
  return { players, courts, rounds, format };
}

test("names the format, roster size, court count and round count", () => {
  const line = describeConfig(shape(8, 2, 7));
  assert.match(line, /^rotating partners · 8 players on 2 courts, 7 rounds\./);
});

test("singular court and round read as singular", () => {
  const line = describeConfig(shape(4, 1, 1));
  assert.match(line, /^rotating partners · 4 players on 1 court, 1 round\./);
});

test("a roster that fills its courts says nobody sits out", () => {
  for (const [players, courts] of [
    [8, 2],
    [12, 3],
    [16, 4],
  ] as const) {
    const line = describeConfig(shape(players, courts, 6));
    assert.match(line, /Everybody plays every round\./, `n=${players}`);
  }
});

test("a roster that does not fill its courts says how many sit out", () => {
  assert.match(
    describeConfig(shape(13, 3, 6)),
    /1 player sits out each round, taking turns\./,
  );
  assert.match(
    describeConfig(shape(14, 3, 6)),
    /2 players sit out each round, taking turns\./,
  );
});

test("within the natural length it says the partnerships go round", () => {
  // A count of unused pairs, which is what the arithmetic establishes. It is
  // deliberately not a promise that the draw uses them without collision:
  // that is the Scorer's to report, off the Schedule that came out.
  assert.match(
    describeConfig(shape(8, 2, 7)),
    /There are enough partnerships to go round\.$/,
  );
});

test("past the natural length it says where repeats begin", () => {
  // Eight players hold 28 pairs; two courts spend four a round, so round 8 is
  // the first that cannot be drawn from fresh pairs.
  assert.match(
    describeConfig(shape(8, 2, 12)),
    /Partners start repeating after round 7\.$/,
  );
});

test("the line is one sentence per clause and never a promise about balance", () => {
  const line = describeConfig(shape(13, 3, 20));
  assert.equal(line.split(". ").length, 3);
  assert.doesNotMatch(line, /nobody repeats|guaranteed|balanced|has to repeat/i);
});

test("the particulars alone are the head of the same sentence, without the stop", () => {
  const board = shape(13, 3, 8);
  assert.equal(
    describeNumbers(board),
    "rotating partners · 13 players on 3 courts, 8 rounds",
  );
  assert.ok(describeConfig(board).startsWith(`${describeNumbers(board)}.`));
});

/**
 * The Format is named even when it is the default. Paper is the reason: the
 * board's particulars are the only line that survives printing, and a printed
 * fixed-partner sheet and a printed rotating sheet are otherwise the same
 * object.
 */
test("both formats are named in the particulars, not just the unusual one", () => {
  assert.match(describeNumbers(shape(8, 2, 4)), /^rotating partners · /);
  assert.match(describeNumbers(shape(8, 2, 4, "fixed")), /^fixed partners · /);
});

test("fixed partners counts what sits out in pairs, not in people", () => {
  // Ten names are five pairs; two courts seat four of them, so one pair sits —
  // and both of its members sit, which is why counting people here would have
  // the organizer looking for two names to shuffle instead of one pair.
  assert.match(
    describeConfig(shape(10, 2, 6, "fixed")),
    /1 pair sits out each round, taking turns\./,
  );
  assert.match(
    describeConfig(shape(16, 2, 6, "fixed")),
    /4 pairs sit out each round, taking turns\./,
  );
});

test("fixed partners talks about matchups, never about partnerships", () => {
  // Its partnerships are all spent in round one and on purpose, so the supply
  // that can run out is meetings between pairs.
  const line = describeConfig(shape(16, 4, 6, "fixed"));
  assert.match(line, /There are enough matchups to go round\.$/);
  assert.doesNotMatch(line, /partnership/i);
});

test("past the natural length fixed partners says where rematches begin", () => {
  // Sixteen names are eight pairs holding 28 matchups; four courts spend four
  // a round, so round 8 is the first that cannot be drawn from fresh ones.
  assert.match(
    describeConfig(shape(16, 4, 12, "fixed")),
    /Pairs start meeting again after round 7\.$/,
  );
});

test("an odd roster in fixed partners never produces half a pair", () => {
  // This line runs on every keystroke, so it passes through odd rosters on the
  // way to even ones. "1.5 pairs sit out" is the failure being guarded here.
  for (let players = 5; players <= 31; players += 2) {
    const line = describeConfig(shape(players, 1, 4, "fixed"));
    assert.doesNotMatch(line, /\d+\.\d/, `n=${players}`);
  }
});

test("a roster too small to seat still gets a line, counting what is missing", () => {
  assert.equal(describeUnsupportedRoster(1), "1 player. 3 more and there is a court's worth.");
  assert.equal(describeUnsupportedRoster(3), "3 players. 1 more and there is a court's worth.");
});

test("a roster too big to seat says how far over it is", () => {
  assert.equal(describeUnsupportedRoster(33), "33 players. 1 more than one sheet holds.");
  assert.equal(describeUnsupportedRoster(40), "40 players. 8 more than one sheet holds.");
});

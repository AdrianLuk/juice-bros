import assert from "node:assert/strict";
import test from "node:test";

import {
  describeConfig,
  describeNumbers,
  describePooledConfig,
  describeUnsupportedRoster,
  type ConfigShape,
} from "./describe.ts";
import { planPools, resolveBoard } from "./pools.ts";
import { parseRoster } from "./roster.ts";
import type { Format } from "./types.ts";

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
test("every format is named in the particulars, not just the unusual ones", () => {
  assert.match(describeNumbers(shape(8, 2, 4)), /^rotating partners · /);
  assert.match(describeNumbers(shape(8, 2, 4, "fixed")), /^fixed partners · /);
  assert.match(describeNumbers(shape(8, 4, 4, "singles")), /^singles · /);
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

test("singles counts two seats to a court, so a full board seats everybody", () => {
  assert.match(
    describeConfig(shape(8, 4, 7, "singles")),
    /Everybody plays every round\./,
  );
  // Seven names on three courts seat six, so the odd one out sits — a player,
  // not a pair.
  assert.match(
    describeConfig(shape(7, 3, 6, "singles")),
    /1 player sits out each round, taking turns\./,
  );
  assert.match(
    describeConfig(shape(12, 4, 6, "singles")),
    /4 players sit out each round, taking turns\./,
  );
});

test("singles talks about matchups, and never about partners at all", () => {
  const line = describeConfig(shape(8, 4, 7, "singles"));
  assert.match(line, /There are enough matchups to go round\.$/);
  assert.doesNotMatch(line, /partner/i);
});

test("past the natural length singles says where the rematches begin", () => {
  // Eight names hold 28 matchups; four courts spend four a round, so round 8
  // is the first that cannot be drawn from fresh ones.
  assert.match(
    describeConfig(shape(8, 4, 12, "singles")),
    /People start playing each other again after round 7\.$/,
  );
});

test("a roster too small to seat still gets a line, counting what is missing", () => {
  assert.equal(describeUnsupportedRoster(1), "1 player. 3 more and there is a court's worth.");
  assert.equal(describeUnsupportedRoster(3), "3 players. 1 more and there is a court's worth.");
});

test("a roster too big for one rotation points at the pool count", () => {
  assert.equal(
    describeUnsupportedRoster(40),
    "40 names is more than one rotation holds. Split into 2 pools or more.",
  );
  assert.equal(
    describeUnsupportedRoster(33),
    "33 names is more than one rotation holds. Split into 2 pools or more.",
  );
});

test("a roster too big for the board says how far over it is", () => {
  assert.equal(
    describeUnsupportedRoster(70),
    "70 players. 6 more than one board holds, even split into pools.",
  );
});

/** The same shape with mixed doubles on, and the supply that goes with it. */
function mixedShape(
  players: number,
  courts: number,
  rounds: number,
  partnerships: number,
): ConfigShape {
  return { players, courts, rounds, format: "rotating", mixed: true, partnerships };
}

test("the particulars name mixed doubles, which is the only thing on paper that can", () => {
  assert.equal(
    describeNumbers(mixedShape(12, 3, 6, 36)),
    "rotating partners, mixed doubles · 12 players on 3 courts, 6 rounds",
  );
});

test("the supply clause counts M x F while the constraint is on", () => {
  // Six and six on three courts is 36 cross-marker partnerships spent six a
  // round, so round seven is where they run out. The whole triangle would be
  // 66 and would promise there were plenty left.
  assert.match(describeConfig(mixedShape(12, 3, 6, 36)), /enough partnerships to go round\.$/);
  assert.match(
    describeConfig(mixedShape(12, 3, 8, 36)),
    /Partners start repeating after round 6\.$/,
  );
  assert.match(
    describeConfig(shape(12, 3, 8)),
    /enough partnerships to go round\.$/,
  );
});

/**
 * Pools (#552). One Pool's line is the line it always was; past one, the line
 * says where each Pool plays, which courts nobody is on, and which Pool runs
 * out first.
 */

function pooled(
  players: number,
  pools: number,
  courts: number,
  rounds?: number,
  format: Format = "rotating",
): string {
  const roster = parseRoster(
    Array.from({ length: players }, (_, i) => `Player ${i + 1}`).join("\n"),
  );
  const numbers = resolveBoard(roster, courts, rounds, format, false, pools);
  const plan = planPools(roster, format, false, numbers.pools, numbers.courts);
  assert.ok(plan);
  return describePooledConfig(
    { players, courts: numbers.courts, rounds: numbers.rounds, format, pools: numbers.pools },
    plan,
  );
}

test("one pool's particulars are the particulars they always were", () => {
  const shape: ConfigShape = { players: 13, courts: 3, rounds: 8, format: "rotating" };
  assert.equal(describeNumbers({ ...shape, pools: 1 }), describeNumbers(shape));
  assert.equal(describeNumbers(shape), "rotating partners · 13 players on 3 courts, 8 rounds");
});

test("a pooled board's particulars say how many pools", () => {
  assert.equal(
    describeNumbers({ players: 20, courts: 4, rounds: 8, format: "rotating", pools: 2 }),
    "rotating partners · 20 players in 2 pools on 4 courts, 8 rounds",
  );
});

test("each pool gets a sentence saying where it plays and who sits", () => {
  assert.equal(
    pooled(20, 2, 4),
    "rotating partners · 20 players in 2 pools on 4 courts, 8 rounds. Pool A: 10 players on courts 1 and 2, 2 players sit out each round, taking turns. Pool B: 10 players on courts 3 and 4, 2 players sit out each round, taking turns. Every pool runs out of new partners after round 11.",
  );
});

test("the line names the pool that sets the round count", () => {
  // 7 and 6 on a court each: B runs out after 7, A after 10.
  assert.equal(
    pooled(13, 2, 2),
    "rotating partners · 13 players in 2 pools on 2 courts, 7 rounds. Pool A: 7 players on court 1, 3 players sit out each round, taking turns. Pool B: 6 players on court 2, 2 players sit out each round, taking turns. Pool B runs out of new partners first, after round 7.",
  );
});

test("past the shortest pool's length the line says where repeats start", () => {
  assert.match(pooled(13, 2, 2, 9), /Partners start repeating in Pool B after round 7\.$/);
});

test("courts the pools cannot fill are named, not refused", () => {
  assert.match(
    pooled(12, 2, 3),
    /Court 3 stands empty, because no pool has the players to fill it\./,
  );
  // Six Pools of six, one court each, on the nine courts 36 names could fill.
  assert.match(
    pooled(36, 6, 9),
    /Courts 7 to 9 stand empty, because no pool has the players to fill them\./,
  );
});

test("fixed partners counts a pool's byes in pairs", () => {
  assert.match(pooled(20, 2, 2, undefined, "fixed"), /Pool A: 10 players on court 1, 3 pairs sit out each round/);
});

test("singles talks about matchups in a pooled board too", () => {
  assert.match(pooled(18, 2, 8, undefined, "singles"), /runs? out of new matchups/);
});

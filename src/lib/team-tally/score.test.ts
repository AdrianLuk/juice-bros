import assert from "node:assert/strict";
import { test } from "node:test";

import { checkGameScore } from "./score.ts";

test("a score a Game can end on saves, ties and time-capped scores included", () => {
  for (const [red, blue] of [
    [11, 9],
    [12, 10],
    [12, 11],
    [9, 9],
    [0, 0],
    [11, 0],
    [9, 11],
    [15, 13],
  ]) {
    assert.deepEqual(checkGameScore(red, blue), { ok: true }, `${red}-${blue}`);
  }
});

test("a side past 11 that leads by more than 2 is refused, saying where the Game ended", () => {
  assert.deepEqual(checkGameScore(13, 9), {
    ok: false,
    problem: "13-9 can't happen: the game ends at 11-9",
  });
  assert.deepEqual(checkGameScore(15, 7), {
    ok: false,
    problem: "15-7 can't happen: the game ends at 11-7",
  });
  assert.deepEqual(checkGameScore(14, 10), {
    ok: false,
    problem: "14-10 can't happen: the game ends at 12-10",
  });
});

test("the refusal keeps the sides in the order they were typed", () => {
  assert.deepEqual(checkGameScore(9, 13), {
    ok: false,
    problem: "9-13 can't happen: the game ends at 9-11",
  });
});

test("a score has to be two whole numbers from 0 to 99", () => {
  assert.equal(checkGameScore(-1, 5).ok, false);
  assert.equal(checkGameScore(100, 98).ok, false);
  assert.equal(checkGameScore(4.5, 11).ok, false);
  assert.equal(checkGameScore(Number.NaN, 11).ok, false);
});

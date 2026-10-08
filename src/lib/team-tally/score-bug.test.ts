import assert from "node:assert/strict";
import { test } from "node:test";

import type { DocGame } from "./event-doc.ts";
import { bugRows } from "./score-bug.ts";

/** Six Games in Round order, captains' first, each [red, blue] or null until scored. */
function games(scores: ([number, number] | null)[]): DocGame[] {
  return scores.map((score, index) => ({
    id: `g${index}`,
    round: (Math.floor(index / 2) + 1) as 1 | 2 | 3,
    kind: index % 2 === 0 ? "captains" : "teammates",
    redScore: score?.[0] ?? null,
    blueScore: score?.[1] ?? null,
    lastEditedByKind: score ? "team" : null,
    lastEditedByTeamId: null,
  }));
}

const points = (cells: { points: number | null }[]) => cells.map((cell) => cell.points);
const lost = (cells: { lost: boolean }[]) => cells.map((cell) => cell.lost);

// Mid Round 2: the captains' Game is in, the teammates' Game is still being played.
const midRound2 = games([[11, 7], [9, 11], [11, 8], null, null, null]);

test("every cell is one Game's score: the captains' row and the teammates' row are never added together", () => {
  const red = bugRows(midRound2, "red");
  assert.deepEqual(points(red.captains), [11, 11, null]);
  assert.deepEqual(points(red.teammates), [9, null, null]);

  const blue = bugRows(midRound2, "blue");
  assert.deepEqual(points(blue.captains), [7, 8, null]);
  assert.deepEqual(points(blue.teammates), [11, null, null]);
});

test("the losing score in each Game is marked lost, the winner's and an unscored Game's are not", () => {
  assert.deepEqual(lost(bugRows(midRound2, "red").captains), [false, false, false]);
  assert.deepEqual(lost(bugRows(midRound2, "red").teammates), [true, false, false]);
  assert.deepEqual(lost(bugRows(midRound2, "blue").captains), [true, true, false]);
  assert.deepEqual(lost(bugRows(midRound2, "blue").teammates), [false, false, false]);
});

test("a Game level at the cap has no loser", () => {
  const level = games([[11, 7], [10, 10], null, null, null, null]);
  assert.deepEqual(lost(bugRows(level, "red").teammates), [false, false, false]);
  assert.deepEqual(lost(bugRows(level, "blue").teammates), [false, false, false]);
});

test("TOT is the Team score: every point from the Games scored so far", () => {
  assert.equal(bugRows(midRound2, "red").total, 31);
  assert.equal(bugRows(midRound2, "blue").total, 26);
  assert.equal(bugRows(games([null, null, null, null, null, null]), "red").total, 0);
});

test("a Game with only one side's score typed is still unscored", () => {
  const half: DocGame[] = games([[11, 7], null, null, null, null, null]);
  half[1] = { ...half[1], redScore: 11 };
  const red = bugRows(half, "red");
  assert.deepEqual(points(red.teammates), [null, null, null]);
  assert.equal(red.total, 11);
});

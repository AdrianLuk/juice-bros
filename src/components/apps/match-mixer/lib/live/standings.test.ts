import assert from "node:assert/strict";
import test from "node:test";

import { parseRoster } from "../engine/roster.ts";
import type { Format, Round, Schedule, Side } from "../engine/types.ts";
import { gameKey } from "./events.ts";
import type { GameScore } from "./game-rule.ts";
import { standings, type StandingsBoard } from "./standings.ts";

const roster = (...names: string[]) => parseRoster(names.join("\n"));

/** Each argument is one Round: its Games in court order, starting at `firstCourt`. */
function schedule(firstCourt: number, ...rounds: [Side, Side][][]): Schedule {
  return {
    source: "generated",
    rounds: rounds.map(
      (games): Round => ({
        games: games.map((sides, position) => ({ court: firstCourt + position, sides })),
        byes: [],
      }),
    ),
  };
}

function board(format: Format, names: string[], built: Schedule): StandingsBoard {
  return { format, roster: roster(...names), schedule: built };
}

const scores = (...entries: [number, number, GameScore][]) =>
  new Map(entries.map(([round, court, score]) => [gameKey(round, court), score]));

/** The table as `name W-L +PD #rank`, top to bottom. */
const read = (rows: ReturnType<typeof standings>) =>
  rows.map((row) => `${row.name} ${row.wins}-${row.losses} ${row.pointDiff >= 0 ? "+" : ""}${row.pointDiff} #${row.rank}`);

// Four singles Players over two Rounds on two courts.
const singles = board(
  "singles",
  ["Ben Johns", "Anna Leigh Waters", "Federico Staksrud", "Catherine Parenteau"],
  schedule(0, [[[0], [1]], [[2], [3]]], [[[0], [2]], [[1], [3]]]),
);

test("with nothing scored, everyone is level at 0-0", () => {
  assert.deepEqual(read(standings(singles, new Map())), [
    "Ben Johns 0-0 +0 #1",
    "Anna Leigh Waters 0-0 +0 #1",
    "Federico Staksrud 0-0 +0 #1",
    "Catherine Parenteau 0-0 +0 #1",
  ]);
});

test("wins rank first, ahead of a bigger point differential", () => {
  const rows = standings(
    singles,
    scores(
      [0, 0, [11, 9]], // Ben beats Anna by 2
      [0, 1, [0, 11]], // Catherine beats Federico by 11
      [1, 0, [11, 9]], // Ben beats Federico by 2
    ),
  );
  assert.deepEqual(read(rows), [
    "Ben Johns 2-0 +4 #1",
    "Catherine Parenteau 1-0 +11 #2",
    "Anna Leigh Waters 0-1 -2 #3",
    "Federico Staksrud 0-2 -13 #4",
  ]);
});

test("level on wins, point differential decides", () => {
  const rows = standings(singles, scores([0, 0, [11, 9]], [0, 1, [11, 2]]));
  assert.deepEqual(read(rows).slice(0, 2), ["Federico Staksrud 1-0 +9 #1", "Ben Johns 1-0 +2 #2"]);
});

test("level on wins and point differential, head-to-head decides", () => {
  const rows = standings(
    singles,
    scores(
      [0, 0, [9, 11]], // Anna beats Ben by 2
      [0, 1, [11, 0]], // Federico beats Catherine
      [1, 0, [11, 9]], // Ben beats Federico by 2
      [1, 1, [9, 11]], // Catherine beats Anna by 2
    ),
  );
  // Ben and Anna: 1-1, +0. Anna beat Ben, so Anna is above him.
  assert.deepEqual(read(rows), [
    "Federico Staksrud 1-1 +9 #1",
    "Anna Leigh Waters 1-1 +0 #2",
    "Ben Johns 1-1 +0 #3",
    "Catherine Parenteau 1-1 -9 #4",
  ]);
});

test("level on everything, including head-to-head, they share a rank in Roster order", () => {
  const rows = standings(singles, scores([0, 0, [11, 5]], [0, 1, [11, 5]]));
  assert.deepEqual(read(rows), [
    "Ben Johns 1-0 +6 #1",
    "Federico Staksrud 1-0 +6 #1",
    "Anna Leigh Waters 0-1 -6 #3",
    "Catherine Parenteau 0-1 -6 #3",
  ]);
});

test("rotating doubles: a row per Player, and a win counts for both partners", () => {
  const doubles = board(
    "rotating",
    ["Ben Johns", "Anna Leigh Waters", "Federico Staksrud", "Catherine Parenteau"],
    schedule(0, [[[0, 1], [2, 3]]], [[[0, 2], [1, 3]]]),
  );
  const rows = standings(doubles, scores([0, 0, [11, 7]], [1, 0, [11, 8]]));
  assert.deepEqual(read(rows), [
    "Ben Johns 2-0 +7 #1",
    "Anna Leigh Waters 1-1 +1 #2",
    "Federico Staksrud 1-1 -1 #3",
    "Catherine Parenteau 0-2 -7 #4",
  ]);
});

test("fixed partners: a row per Pairing, named for both", () => {
  const fixed = board(
    "fixed",
    [
      "Ben Johns",
      "Collin Johns",
      "Anna Leigh Waters",
      "Catherine Parenteau",
      "Federico Staksrud",
      "Tyson McGuffin",
    ],
    schedule(2, [[[0, 1], [2, 3]]], [[[2, 3], [4, 5]]], [[[0, 1], [4, 5]]]),
  );
  // Pool on courts 3 onward: its Games sit at court 2.
  const rows = standings(fixed, scores([0, 2, [11, 9]], [1, 2, [11, 3]], [2, 2, [6, 11]]));
  assert.deepEqual(read(rows), [
    "Anna Leigh Waters / Catherine Parenteau 1-1 +6 #1",
    "Federico Staksrud / Tyson McGuffin 1-1 -3 #2",
    "Ben Johns / Collin Johns 1-1 -3 #3",
  ]);
  // Federico and Tyson beat the Johns brothers head to head.
  assert.deepEqual(rows[1].players, [4, 5]);
});

test("a score for a Game this Pool doesn't have counts for nobody in it", () => {
  const rows = standings(singles, scores([0, 5, [11, 0]], [9, 0, [11, 0]]));
  assert.ok(rows.every((row) => row.wins === 0 && row.losses === 0));
});

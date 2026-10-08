import assert from "node:assert/strict";
import { test } from "node:test";

import type { DocGame, DocMatchup } from "./event-doc.ts";
import { bugGridColumns, bugGridScale, handoffGridColumns, splitStandings, tvScreens } from "./tv-screens.ts";

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

const NONE = [null, null, null, null, null, null];

function flight(letter: string, scores: ([number, number] | null)[]): DocMatchup {
  return {
    id: `flight-${letter}`,
    stage: "flight",
    number: letter.charCodeAt(0) - 64,
    flightLetter: letter,
    courtPair: ["16", "19"],
    redTeamId: "a",
    blueTeamId: "b",
    games: games(scores),
    doneAt: null,
    doneByTeamId: null,
    dreambreakerWinnerId: null,
  };
}

const ids = (event: Parameters<typeof tvScreens>[0]) => tvScreens(event).map((screen) => screen.id);

test("the opening round cycles the standings and the Matchups", () => {
  assert.deepEqual(ids({ status: "opening", matchups: [] }), ["standings", "matchups"]);
});

test("right after Seeding the Flight hand-off holds the screen alone", () => {
  assert.deepEqual(ids({ status: "flights", matchups: [flight("A", NONE), flight("B", NONE)] }), ["handoff"]);
});

test("once a Flight has a score the hand-off cycles with the Flight scores and the opening standings", () => {
  const scored: ([number, number] | null)[] = [[11, 5], null, null, null, null, null];
  assert.deepEqual(ids({ status: "flights", matchups: [flight("A", scored), flight("B", NONE)] }), [
    "handoff",
    "flight-scores",
    "standings",
  ]);
});

test("the hand-off gets the longest dwell of the Flights stage", () => {
  const scored: ([number, number] | null)[] = [[11, 5], null, null, null, null, null];
  const [handoff, ...rest] = tvScreens({ status: "flights", matchups: [flight("A", scored)] });
  assert.ok(rest.every((screen) => handoff.dwellMs > screen.dwellMs));
});

test("a finished night leads with the results summary", () => {
  assert.deepEqual(ids({ status: "finished", matchups: [flight("A", NONE)] }), [
    "summary",
    "flight-scores",
    "standings",
  ]);
});

test("a Flights night with no Flight Matchups yet falls back to the opening round", () => {
  assert.deepEqual(ids({ status: "flights", matchups: [] }), ["standings", "matchups"]);
});

test("14 Teams split into Flights A to C on the left and D to G on the right", () => {
  const rows = Array.from({ length: 14 }, (_, index) => ({ position: index + 1 }));
  const page = splitStandings(rows);

  assert.deepEqual(
    page.left.map((row) => row.position),
    [1, 2, 3, 4, 5, 6],
  );
  assert.deepEqual(
    page.right.map((row) => row.position),
    [7, 8, 9, 10, 11, 12, 13, 14],
  );
});

test("12 Teams split into three Flights a side", () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({ position: index + 1 }));
  const page = splitStandings(rows);
  assert.equal(page.left.length, 6);
  assert.equal(page.right.length, 6);
});

test("a night with six Teams or fewer fills only the left column", () => {
  const rows = Array.from({ length: 4 }, (_, index) => ({ position: index + 1 }));
  const page = splitStandings(rows);
  assert.equal(page.left.length, 4);
  assert.equal(page.right.length, 0);
});

test("Matchup score bugs run up to three across, so a night of 14 Teams reads at a size a room can see", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(bugGridColumns), [1, 2, 3, 2, 3, 3, 3]);
});

test("Flight hand-off plates run in two rows of up to four, the loudest layout the stage has", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(handoffGridColumns), [1, 1, 2, 2, 3, 3, 4]);
});

test("score bugs grow into the screen's height: three rows of them at 1.25 times, fewer rows larger still", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7].map((count) => bugGridScale(count)),
    [1.5, 1.5, 1.5, 1.5, 1.4, 1.4, 1.25],
  );
});

test("done Matchups carry a FINAL bar, so a screen of them grows less: three rows stay at the stage's unit", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7].map((count) => bugGridScale(count, true)),
    [1.25, 1.25, 1.25, 1.25, 1.25, 1.25, 1],
  );
});

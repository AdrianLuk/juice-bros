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

function opening(number: number): DocMatchup {
  return { ...flight("A", NONE), id: `match-${number}`, stage: "opening", number, flightLetter: null };
}

const openingNight = (count: number) => ({
  status: "opening" as const,
  matchups: Array.from({ length: count }, (_, index) => opening(index + 1)),
});

const ids = (event: Parameters<typeof tvScreens>[0]) => tvScreens(event).map((screen) => screen.id);

test("the opening round cycles the standings and the Matchups", () => {
  assert.deepEqual(ids({ status: "opening", matchups: [] }), ["standings", "matchups"]);
});

test("four Matchups or fewer share one Matchups screen", () => {
  const screens = tvScreens(openingNight(4));
  assert.deepEqual(
    screens.map((screen) => [screen.id, screen.label, screen.bugs]),
    [
      ["standings", "Standings", undefined],
      ["matchups", "Matchups", [0, 4]],
    ],
  );
});

test("seven opening Matchups become two screens of four-row bugs: 1 to 4, then 5 to 7", () => {
  const screens = tvScreens(openingNight(7));
  assert.deepEqual(
    screens.map((screen) => [screen.id, screen.label, screen.bugs]),
    [
      ["standings", "Standings", undefined],
      ["matchups", "Matchups 1 to 4", [0, 4]],
      ["matchups-2", "Matchups 5 to 7", [4, 7]],
    ],
  );
});

test("five or six Matchups split evenly, so no screen holds a lone bug", () => {
  assert.deepEqual(
    tvScreens(openingNight(5)).flatMap((screen) => (screen.bugs ? [screen.label] : [])),
    ["Matchups 1 to 3", "Matchups 4 to 5"],
  );
  assert.deepEqual(
    tvScreens(openingNight(6)).flatMap((screen) => (screen.bugs ? [screen.label] : [])),
    ["Matchups 1 to 3", "Matchups 4 to 6"],
  );
});

test("seven Flights' scores split the same way, by Flight letter", () => {
  const flights = ["A", "B", "C", "D", "E", "F", "G"].map((letter) => flight(letter, NONE));
  const screens = tvScreens({ status: "finished", matchups: [...openingNight(7).matchups, ...flights] });
  assert.deepEqual(
    screens.map((screen) => [screen.id, screen.label, screen.bugs]),
    [
      ["summary", "Results", undefined],
      ["flight-scores", "Flight scores A to D", [0, 4]],
      ["flight-scores-2", "Flight scores E to G", [4, 7]],
      ["standings", "Opening standings", undefined],
    ],
  );
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

test("a screen of four-row score bugs runs two across, a lone bug on its own", () => {
  assert.deepEqual([1, 2, 3, 4].map(bugGridColumns), [1, 2, 2, 2]);
});

test("Flight hand-off plates run in two rows of up to four, the loudest layout the stage has", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(handoffGridColumns), [1, 1, 2, 2, 3, 3, 4]);
});

test("score bugs grow into the screen's height, less when a done Matchup's FINAL bar adds a row", () => {
  assert.equal(bugGridScale(), 1.5);
  assert.equal(bugGridScale(true), 1.3);
});

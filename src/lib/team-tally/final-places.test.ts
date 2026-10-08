import assert from "node:assert/strict";
import { test } from "node:test";

import type { DocGame, DocMatchup } from "./event-doc.ts";
import { finalPlaces, flightResults, ordinal } from "./final-places.ts";

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

/** A Flight Matchup: `red` is the higher seed. */
function flight(
  letter: string,
  red: string,
  blue: string,
  scores: ([number, number] | null)[],
  extra: Partial<DocMatchup> = {},
): DocMatchup {
  const number = letter.charCodeAt(0) - 64;
  return {
    id: `flight-${letter}`,
    stage: "flight",
    number,
    flightLetter: letter,
    courtPair: [String(number * 2 + 14), String(number * 2 + 15)],
    redTeamId: red,
    blueTeamId: blue,
    games: games(scores),
    doneAt: "2026-10-13T20:00:00Z",
    doneByTeamId: null,
    dreambreakerWinnerId: null,
    ...extra,
  };
}

const RED_WINS: [number, number][] = [
  [11, 8],
  [11, 9],
  [7, 11],
  [11, 6],
  [9, 11],
  [11, 4],
]; // 60-49

const BLUE_WINS: [number, number][] = [
  [8, 11],
  [9, 11],
  [11, 7],
  [6, 11],
  [11, 9],
  [4, 11],
]; // 49-60

const LEVEL: [number, number][] = [
  [11, 9],
  [9, 11],
  [11, 9],
  [9, 11],
  [11, 9],
  [9, 11],
]; // 60-60

test("a Flight's champion is the Matchup winner, scored champion first", () => {
  const [result] = flightResults({ matchups: [flight("A", "ben", "fed", BLUE_WINS)] });

  assert.deepEqual(result, {
    flightLetter: "A",
    matchupId: "flight-A",
    championId: "fed",
    runnerUpId: "ben",
    championScore: 60,
    runnerUpScore: 49,
    decidedByDreambreaker: false,
  });
});

test("a level Flight Matchup goes to the Dreambreaker winner, and says so", () => {
  const [result] = flightResults({
    matchups: [flight("B", "hay", "chr", LEVEL, { dreambreakerWinnerId: "chr" })],
  });

  assert.equal(result.championId, "chr");
  assert.equal(result.runnerUpId, "hay");
  assert.equal(result.championScore, 60);
  assert.equal(result.runnerUpScore, 60);
  assert.equal(result.decidedByDreambreaker, true);
});

test("Flights read in letter order whatever order the document lists them in", () => {
  const results = flightResults({
    matchups: [flight("B", "c", "d", RED_WINS), flight("A", "a", "b", RED_WINS)],
  });
  assert.deepEqual(
    results.map((result) => result.flightLetter),
    ["A", "B"],
  );
});

test("opening Matchups and Flights not yet done are not results", () => {
  const opening: DocMatchup = { ...flight("A", "a", "b", RED_WINS), stage: "opening", flightLetter: null };
  const open = flight("B", "c", "d", RED_WINS, { doneAt: null });
  const unplayed = flight("C", "e", "f", [null, null, null, null, null, null], { doneAt: null });

  assert.deepEqual(flightResults({ matchups: [opening, open, unplayed] }), []);
});

test("Final places: Flight A's champion first, its runner-up second, Flight B's champion third, and down", () => {
  const places = finalPlaces({
    matchups: [
      flight("A", "ben", "fed", RED_WINS),
      flight("B", "hay", "chr", BLUE_WINS),
      flight("C", "lea", "tyr", LEVEL, { dreambreakerWinnerId: "lea" }),
    ],
  });

  assert.deepEqual(
    places.map(({ place, teamId, flightLetter, role }) => [place, teamId, flightLetter, role]),
    [
      [1, "ben", "A", "champion"],
      [2, "fed", "A", "runner-up"],
      [3, "chr", "B", "champion"],
      [4, "hay", "B", "runner-up"],
      [5, "lea", "C", "champion"],
      [6, "tyr", "C", "runner-up"],
    ],
  );
});

test("a Flight still in play holds its places open rather than shifting later Flights up", () => {
  const places = finalPlaces({
    matchups: [flight("A", "ben", "fed", RED_WINS, { doneAt: null }), flight("B", "hay", "chr", RED_WINS)],
  });

  assert.deepEqual(
    places.map(({ place, teamId }) => [place, teamId]),
    [
      [3, "hay"],
      [4, "chr"],
    ],
  );
});

test("before any Flight is done there are no Final places", () => {
  assert.deepEqual(finalPlaces({ matchups: [] }), []);
});

test("places read aloud as ordinals, teens included", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 11, 12, 13, 14, 21].map(ordinal),
    ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "14th", "21st"],
  );
});

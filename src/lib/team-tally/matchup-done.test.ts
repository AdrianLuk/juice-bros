import assert from "node:assert/strict";
import { test } from "node:test";

import type { DocGame, DocMatchup } from "./event-doc.ts";
import { doneProblem, matchupWinnerId, needsDreambreaker } from "./matchup-done.ts";

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

function matchup(scores: ([number, number] | null)[], extra: Partial<DocMatchup> = {}): DocMatchup {
  return {
    id: "m1",
    stage: "opening",
    number: 1,
    flightLetter: null,
    courtPair: ["16", "19"],
    redTeamId: "ben",
    blueTeamId: "fed",
    games: games(scores),
    doneAt: null,
    doneByTeamId: null,
    dreambreakerWinnerId: null,
    ...extra,
  };
}

const PLAYED: [number, number][] = [
  [11, 8],
  [11, 9],
  [7, 11],
  [11, 6],
  [9, 11],
  [11, 4],
];

const TIED: [number, number][] = [
  [11, 9],
  [9, 11],
  [11, 9],
  [9, 11],
  [11, 9],
  [9, 11],
];

test("a Matchup with all six scores and a winner can be marked done", () => {
  assert.equal(doneProblem(matchup(PLAYED)), null);
  assert.equal(matchupWinnerId(matchup(PLAYED)), "ben");
});

test("a Matchup with a Game still unscored can't be marked done, and says which", () => {
  const scores = [...PLAYED.slice(0, 3), null, ...PLAYED.slice(4)];
  assert.equal(doneProblem(matchup(scores)), "Round 2's teammates' game has no score yet.");
});

test("a tied Matchup needs its Dreambreaker winner first", () => {
  const tied = matchup(TIED);
  assert.equal(needsDreambreaker(tied), true);
  assert.equal(matchupWinnerId(tied), null);
  assert.equal(doneProblem(tied), "Tied 60-60. Record who won the Dreambreaker first.");

  const settled = matchup(TIED, { dreambreakerWinnerId: "fed" });
  assert.equal(doneProblem(settled), null);
  assert.equal(matchupWinnerId(settled), "fed");
});

test("a Dreambreaker only matters on a tie: Team score names the winner otherwise", () => {
  const played = matchup(PLAYED, { dreambreakerWinnerId: "fed" });
  assert.equal(needsDreambreaker(played), false);
  assert.equal(matchupWinnerId(played), "ben");
});

test("a Matchup already done says so", () => {
  assert.equal(doneProblem(matchup(PLAYED, { doneAt: "2026-10-13T20:00:00Z" })), "This Matchup is already done.");
});

import assert from "node:assert/strict";
import { test } from "node:test";

import type { DocGame, DocMatchup, DocTeam, TeamEventDoc } from "./event-doc.ts";
import { computeStandings } from "./standings.ts";

function team(id: string, captain: string, nickname: string | null = null): DocTeam {
  return { id, nickname, homeCourt: id, captain, slotA: "A", slotB: "B", slotC: "C" };
}

/** Six Games in Round order, captains' then teammates', from `[red, blue]` pairs (null: unscored). */
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

function matchup(number: number, red: string, blue: string, scores: ([number, number] | null)[]): DocMatchup {
  return {
    id: `m${number}`,
    stage: "opening",
    number,
    flightLetter: null,
    courtPair: ["1", "2"],
    redTeamId: red,
    blueTeamId: blue,
    games: games(scores),
  };
}

function night(matchups: DocMatchup[]): TeamEventDoc {
  return {
    id: "e",
    name: "Tuesday Team Night",
    date: "2026-10-13",
    status: "opening",
    teams: [
      team("ben", "Ben Johns", "Golden Set"),
      team("fed", "Federico Staksrud"),
      team("hay", "Hayden Patriquin", "Kitchen Kings"),
      team("chr", "Christian Alshon"),
    ],
    matchups,
  };
}

test("Teams sort by Team score, every point across their Matchup's Games", () => {
  const standings = computeStandings(
    night([
      matchup(1, "ben", "fed", [[11, 8], [11, 9], [7, 11], null, null, null]),
      matchup(2, "hay", "chr", [[11, 2], [11, 3], [11, 4], [11, 5], null, null]),
    ]),
  );

  assert.deepEqual(
    standings.map(({ position, teamId, teamScore }) => ({ position, teamId, teamScore })),
    [
      { position: 1, teamId: "hay", teamScore: 44 },
      { position: 2, teamId: "ben", teamScore: 29 },
      { position: 3, teamId: "fed", teamScore: 28 },
      { position: 4, teamId: "chr", teamScore: 14 },
    ],
  );
});

test("each row counts Games won and point differential, and points per Round", () => {
  const [, ben] = computeStandings(
    night([
      matchup(1, "ben", "fed", [[11, 8], [11, 9], [7, 11], [10, 10], null, null]),
      matchup(2, "hay", "chr", [[11, 2], [11, 3], [11, 4], [11, 5], [11, 6], [11, 7]]),
    ]),
  );

  assert.equal(ben.teamId, "ben");
  assert.equal(ben.name, "Golden Set");
  assert.equal(ben.side, "red");
  assert.equal(ben.teamScore, 39);
  // 11-8 and 11-9 won; 7-11 lost; a 10-10 tie is no win.
  assert.equal(ben.gamesWon, 2);
  assert.equal(ben.pointDiff, 39 - 38);
  assert.deepEqual(ben.rounds, [22, 17, null]);
});

test("a Team with no nickname is named for its captain, and the blue side is the second Team", () => {
  const standings = computeStandings(night([matchup(1, "ben", "fed", []), matchup(2, "hay", "chr", [])]));
  const fed = standings.find((row) => row.teamId === "fed");

  assert.equal(fed?.name, "Team Federico Staksrud");
  assert.equal(fed?.side, "blue");
  assert.deepEqual(fed?.rounds, [null, null, null]);
});

test("a tie on Team score goes to point differential, then Games won, then setup order", () => {
  const standings = computeStandings(
    night([
      // Ben 22, Federico 22, differential 0 each, one Game won each.
      matchup(1, "ben", "fed", [[11, 9], [11, 13], null, null, null, null]),
      // Hayden 22 with +4; Christian 18.
      matchup(2, "hay", "chr", [[11, 9], [11, 9], null, null, null, null]),
    ]),
  );

  assert.deepEqual(
    standings.map((row) => row.teamId),
    ["hay", "ben", "fed", "chr"],
  );
});

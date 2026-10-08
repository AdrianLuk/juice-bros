import assert from "node:assert/strict";
import { test } from "node:test";

import type { DocGame, DocMatchup, DocTeam, TeamEventDoc } from "./event-doc.ts";
import { computeStandings, standingsMoved } from "./standings.ts";

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

function matchup(
  number: number,
  red: string,
  blue: string,
  scores: ([number, number] | null)[],
  extra: Partial<DocMatchup> = {},
): DocMatchup {
  return {
    id: `m${number}`,
    stage: "opening",
    number,
    flightLetter: null,
    courtPair: ["1", "2"],
    redTeamId: red,
    blueTeamId: blue,
    games: games(scores),
    doneAt: null,
    doneByTeamId: null,
    dreambreakerWinnerId: null,
    ...extra,
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
    seededAt: null,
    tieOrder: [],
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

const TIED: [number, number][] = [
  [11, 9],
  [9, 11],
  [11, 9],
  [9, 11],
  [11, 9],
  [9, 11],
];

test("two Teams level after their own Matchup are split by its Dreambreaker, and the row says so", () => {
  const standings = computeStandings(
    night([
      matchup(1, "ben", "fed", TIED, { dreambreakerWinnerId: "fed" }),
      matchup(2, "hay", "chr", [[11, 2], [11, 3], [11, 4], [11, 5], [11, 6], [11, 7]]),
    ]),
  );

  assert.deepEqual(
    standings.map(({ teamId, flightLetter, decidedBy }) => [teamId, flightLetter, decidedBy]),
    [
      ["hay", "A", null],
      ["fed", "A", "teamScore"],
      ["ben", "B", "matchupWinner"],
      ["chr", "B", "teamScore"],
    ],
  );
});

test("once Flights are placed, a corrected opening score shows the standings moved", () => {
  const opening = [
    matchup(1, "ben", "fed", [[11, 8], [11, 9], [11, 7], [11, 6], [11, 5], [11, 4]]),
    matchup(2, "hay", "chr", [[11, 9], [11, 9], [11, 9], [11, 9], [11, 9], [11, 9]]),
  ];
  // Seeded as Ben 66, Hayden 66 (Ben ahead on point differential), then
  // Christian 54 and Federico 39.
  const flights = [
    matchup(1, "ben", "hay", [], { id: "fa", stage: "flight", flightLetter: "A" }),
    matchup(2, "chr", "fed", [], { id: "fb", stage: "flight", flightLetter: "B" }),
  ];
  const seeded = { ...night([...opening, ...flights]), status: "flights" as const, seededAt: "2026-10-13T20:00:00Z" };
  assert.equal(standingsMoved(seeded), false);

  // The Organizer reopens Match 1 and corrects a score: Ben drops to 63.
  const corrected = structuredClone(seeded);
  corrected.matchups[0].games[0].redScore = 8;
  corrected.matchups[0].games[0].blueScore = 11;
  assert.equal(standingsMoved(corrected), true);
  assert.deepEqual(
    computeStandings(corrected).map((row) => row.teamId),
    ["hay", "ben", "chr", "fed"],
  );

  assert.equal(standingsMoved(night(opening)), false);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { seedTeams, tieRuleLabel, type SeedEntry } from "./seeding.ts";

/**
 * A Team's opening record. `matchup` names the opening Matchup it played and
 * `won` says whether it is that Matchup's winner (by Team score, or by the
 * Dreambreaker on a tie); its opponent is the other entry with the same
 * `matchup`.
 */
function entry(
  teamId: string,
  setupIndex: number,
  matchup: string,
  record: { score: number; diff: number; games: number; won?: boolean | null },
): SeedEntry {
  return {
    teamId,
    setupIndex,
    matchupId: matchup,
    teamScore: record.score,
    pointDiff: record.diff,
    gamesWon: record.games,
    wonMatchup: record.won ?? null,
  };
}

function order(entries: SeedEntry[], organizerOrder: string[] = []) {
  return seedTeams(entries, organizerOrder).map((seed) => [seed.teamId, seed.decidedBy]);
}

test("Teams rank by opening Team score, and Flights are pairs down the order", () => {
  const seeds = seedTeams([
    entry("ben", 0, "m1", { score: 50, diff: 10, games: 4, won: true }),
    entry("fed", 1, "m1", { score: 40, diff: -10, games: 2, won: false }),
    entry("hay", 2, "m2", { score: 62, diff: 20, games: 5, won: true }),
    entry("chr", 3, "m2", { score: 42, diff: -20, games: 1, won: false }),
  ]);

  assert.deepEqual(
    seeds.map(({ teamId, position, flightLetter, decidedBy }) => [teamId, position, flightLetter, decidedBy]),
    [
      ["hay", 1, "A", null],
      ["ben", 2, "A", "teamScore"],
      ["chr", 3, "B", "teamScore"],
      ["fed", 4, "B", "teamScore"],
    ],
  );
});

test("a tie between two Teams that played each other goes to their Matchup's winner", () => {
  // Ben and Federico finished 48-48; Federico won the Dreambreaker. Federico
  // has fewer Games won, which would have put Ben ahead without rule 1.
  assert.deepEqual(
    order([
      entry("ben", 0, "m1", { score: 48, diff: 0, games: 4, won: false }),
      entry("fed", 1, "m1", { score: 48, diff: 0, games: 2, won: true }),
      entry("hay", 2, "m2", { score: 60, diff: 30, games: 6, won: true }),
      entry("chr", 3, "m2", { score: 30, diff: -30, games: 0, won: false }),
    ]),
    [
      ["hay", null],
      ["fed", "teamScore"],
      ["ben", "matchupWinner"],
      ["chr", "teamScore"],
    ],
  );
});

test("a tie between Teams that did not play each other goes to point differential", () => {
  assert.deepEqual(
    order([
      entry("ben", 0, "m1", { score: 55, diff: 4, games: 3, won: true }),
      entry("fed", 1, "m1", { score: 51, diff: -4, games: 3, won: false }),
      entry("hay", 2, "m2", { score: 55, diff: 9, games: 2, won: true }),
      entry("chr", 3, "m2", { score: 46, diff: -9, games: 4, won: false }),
    ]),
    [
      ["hay", null],
      ["ben", "pointDiff"],
      ["fed", "teamScore"],
      ["chr", "teamScore"],
    ],
  );
});

test("level on point differential too, Games won decides", () => {
  assert.deepEqual(
    order([
      entry("ben", 0, "m1", { score: 55, diff: 4, games: 3, won: true }),
      entry("fed", 1, "m1", { score: 51, diff: -4, games: 3, won: false }),
      entry("hay", 2, "m2", { score: 55, diff: 4, games: 4, won: true }),
      entry("chr", 3, "m2", { score: 51, diff: -4, games: 2, won: false }),
    ]),
    [
      ["hay", null],
      ["ben", "gamesWon"],
      ["fed", "teamScore"],
      ["chr", "gamesWon"],
    ],
  );
});

test("level on every count across a Flight boundary, the Organizer's order decides", () => {
  const entries = [
    entry("ben", 0, "m1", { score: 60, diff: 10, games: 4, won: true }),
    entry("fed", 1, "m1", { score: 50, diff: -10, games: 2, won: false }),
    entry("hay", 2, "m2", { score: 50, diff: -10, games: 2, won: false }),
    entry("chr", 3, "m2", { score: 60, diff: 10, games: 4, won: true }),
  ];

  // Positions 2 and 3 straddle Flights A and B. With no word from the
  // Organizer, their setup order stands; Ben and Christian share Flight A.
  assert.deepEqual(order(entries), [
    ["ben", null],
    ["chr", "level"],
    ["fed", "teamScore"],
    ["hay", "level"],
  ]);

  const straddling = [
    entry("ben", 0, "m1", { score: 60, diff: 10, games: 4, won: true }),
    entry("fed", 1, "m1", { score: 50, diff: -10, games: 2, won: false }),
    entry("hay", 2, "m2", { score: 60, diff: 10, games: 4, won: true }),
    entry("chr", 3, "m2", { score: 50, diff: -10, games: 2, won: false }),
    entry("tyr", 4, "m3", { score: 70, diff: 20, games: 5, won: true }),
    entry("ann", 5, "m3", { score: 50, diff: -20, games: 1, won: false }),
  ];
  assert.deepEqual(order(straddling), [
    ["tyr", null],
    ["ben", "teamScore"],
    ["hay", "organizer"],
    ["fed", "teamScore"],
    ["chr", "organizer"],
    ["ann", "pointDiff"],
  ]);
  // The Organizer puts Hayden's Team ahead of Ben's.
  assert.deepEqual(order(straddling, ["hay", "ben"]).slice(1, 3), [
    ["hay", "teamScore"],
    ["ben", "organizer"],
  ]);
});

test("a tie inside a Flight needs no break: the two Teams share it either way", () => {
  const seeds = seedTeams([
    entry("ben", 0, "m1", { score: 60, diff: 10, games: 4, won: true }),
    entry("fed", 1, "m1", { score: 50, diff: -10, games: 2, won: false }),
    entry("hay", 2, "m2", { score: 60, diff: 10, games: 4, won: true }),
    entry("chr", 3, "m2", { score: 50, diff: -10, games: 2, won: false }),
  ]);

  assert.deepEqual(
    seeds.map(({ teamId, flightLetter, decidedBy }) => [teamId, flightLetter, decidedBy]),
    [
      ["ben", "A", null],
      ["hay", "A", "level"],
      ["fed", "B", "teamScore"],
      ["chr", "B", "level"],
    ],
  );
});

test("a three-way tie skips the Matchup winner, then restarts it for the pair point differential leaves", () => {
  // Ben and Federico played each other to 50-50 and Federico won the
  // Dreambreaker; Hayden also has 50, with +6. Three Teams did not all play
  // each other, so point differential goes first: Hayden, then Ben and
  // Federico level on 0, which their own Matchup settles.
  assert.deepEqual(
    order([
      entry("ben", 0, "m1", { score: 50, diff: 0, games: 3, won: false }),
      entry("fed", 1, "m1", { score: 50, diff: 0, games: 2, won: true }),
      entry("hay", 2, "m2", { score: 50, diff: 6, games: 3, won: true }),
      entry("chr", 3, "m2", { score: 44, diff: -6, games: 3, won: false }),
    ]),
    [
      ["hay", null],
      ["fed", "pointDiff"],
      ["ben", "matchupWinner"],
      ["chr", "teamScore"],
    ],
  );
});

test("a tie still level on point differential goes to Games won before any Matchup winner", () => {
  // All four on 50 and 0. Games won splits Christian (4) and Hayden (2) from
  // the pair on 3; that pair played each other, so their Dreambreaker
  // settles it.
  assert.deepEqual(
    order([
      entry("ben", 0, "m1", { score: 50, diff: 0, games: 3, won: false }),
      entry("fed", 1, "m1", { score: 50, diff: 0, games: 3, won: true }),
      entry("hay", 2, "m2", { score: 50, diff: 0, games: 2, won: false }),
      entry("chr", 3, "m2", { score: 50, diff: 0, games: 4, won: true }),
    ]),
    [
      ["chr", null],
      ["fed", "gamesWon"],
      ["ben", "matchupWinner"],
      ["hay", "gamesWon"],
    ],
  );
});

test("each rule reads as the standings say it", () => {
  assert.equal(tieRuleLabel("teamScore"), null);
  assert.equal(tieRuleLabel("matchupWinner"), "Won their Matchup");
  assert.equal(tieRuleLabel("pointDiff"), "Ahead on point differential");
  assert.equal(tieRuleLabel("gamesWon"), "Ahead on Games won");
  assert.equal(tieRuleLabel("organizer"), "Level on every count: organizer's call");
  assert.equal(tieRuleLabel("level"), "Level, same Flight");
});

import assert from "node:assert/strict";
import test from "node:test";

import { landingNights } from "./landing.ts";

const nights = landingNights("2026-10-13", "https://example.com");

test("the Flights preview is the demo night once its Flights are placed", () => {
  assert.equal(nights.night.status, "opening");
  assert.equal(nights.flights.status, "flights");
  const flights = nights.flights.matchups.filter((matchup) => matchup.stage === "flight");
  assert.equal(flights.length, 7);
  assert.deepEqual(
    flights.map((matchup) => matchup.flightLetter),
    ["A", "B", "C", "D", "E", "F", "G"],
  );
});

test("the Organizer's preview is the tied Matchup, edited by the Organizer, settled and done", () => {
  const matchup = nights.organizerMatchup;
  assert.equal(matchup.number, 6);
  assert.notEqual(matchup.doneAt, null);
  assert.equal(matchup.dreambreakerWinnerId, matchup.blueTeamId);
  assert.equal(nights.organizerGame.lastEditedByKind, "organizer");
});

test("every live preview's night has Golden Set's Round 2 captains' game in and the teammates' game waiting", () => {
  const mine = nights.night.matchups.find((matchup) => matchup.redTeamId === nights.myTeamId)!;
  const round2 = mine.games.filter((game) => game.round === 2);
  assert.deepEqual(
    round2.map((game) => [game.kind, game.redScore, game.lastEditedByTeamId]),
    [
      ["captains", 11, nights.myTeamId],
      ["teammates", null, null],
    ],
  );
});

test("the brief excerpt runs from the Matchups heading through Match 1 only", () => {
  const lines = nights.briefExcerpt.split("\n");
  assert.match(lines[0], /TEAM MATCHUPS/);
  assert.match(nights.briefExcerpt, /MATCH 1 — Courts 16 & 19/);
  assert.match(nights.briefExcerpt, /Score link: https:\/\/example\.com\//);
  assert.doesNotMatch(nights.briefExcerpt, /MATCH 2/);
});

test("the refusals are the app's own words", () => {
  assert.equal(nights.refusals.score, "13-9 can't happen: the game ends at 11-9");
  assert.equal(nights.refusals.tie, "Tied 56-56. Record who won the Dreambreaker first.");
  assert.equal(nights.refusals.roster, "Round 1 already has a score, so Player A stays Anna Leigh Waters.");
});

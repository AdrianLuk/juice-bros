import assert from "node:assert/strict";
import { test } from "node:test";

import { isScored, liveRound, openingMatchups, sideOf } from "../event-doc.ts";
import { needsDreambreaker } from "../matchup-done.ts";
import { demoNight } from "./night.ts";

test("the demo night is 14 Teams of four in seven opening Matchups on the real court pairs", () => {
  const { event } = demoNight("2026-10-13");
  assert.equal(event.status, "opening");
  assert.equal(event.date, "2026-10-13");
  assert.equal(event.teams.length, 14);
  assert.deepEqual(
    openingMatchups(event).map((matchup) => [matchup.number, matchup.courtPair.join(" & ")]),
    [
      [1, "16 & 19"],
      [2, "17 & 18"],
      [3, "20 & 21"],
      [4, "22 & 23"],
      [5, "24 & 25"],
      [6, "26 & 27"],
      [7, "28 & 29"],
    ],
  );
  for (const matchup of event.matchups) {
    assert.equal(matchup.games.length, 6);
  }
  // Every Team plays exactly one opening Matchup, from its home court.
  for (const team of event.teams) {
    const mine = event.matchups.filter((matchup) => sideOf(matchup, team.id));
    assert.equal(mine.length, 1, team.captain);
    assert.ok(mine[0].courtPair.includes(team.homeCourt), team.captain);
  }
});

test("every player on the night is a different person", () => {
  const { event } = demoNight("2026-10-13");
  const names = event.teams.flatMap((team) => [team.captain, team.slotA, team.slotB, team.slotC]);
  assert.equal(names.length, 56);
  assert.equal(new Set(names).size, 56);
});

test("the night opens under way: most Matchups done, a few mid-Round, one tied and waiting on its Dreambreaker", () => {
  const { event } = demoNight("2026-10-13");
  const opening = openingMatchups(event);
  const done = opening.filter((matchup) => matchup.doneAt !== null);
  const waiting = opening.filter((matchup) => matchup.doneAt === null && needsDreambreaker(matchup));
  const midRound = opening.filter((matchup) => matchup.doneAt === null && liveRound(matchup) !== undefined);

  assert.equal(done.length, 4);
  assert.equal(waiting.length, 1);
  assert.equal(waiting[0].dreambreakerWinnerId, null);
  assert.equal(midRound.length, 2);
  // Every scored Game says who entered it.
  for (const game of opening.flatMap((matchup) => matchup.games).filter(isScored)) {
    assert.equal(game.lastEditedByKind, "team");
    assert.ok(game.lastEditedByTeamId);
  }
});

test("you hold one Team's Score Link, mid Round 2 with Round 1 scored", () => {
  const { event, myTeamId } = demoNight("2026-10-13");
  const mine = event.matchups.find((matchup) => sideOf(matchup, myTeamId))!;
  assert.equal(mine.doneAt, null);
  assert.equal(liveRound(mine), 2);
  assert.deepEqual(
    mine.games.map((game) => [game.round, isScored(game)]),
    [
      [1, true],
      [1, true],
      [2, false],
      [2, false],
      [3, false],
      [3, false],
    ],
  );
});

test("Reset brings back the same night", () => {
  assert.deepEqual(demoNight("2026-10-13"), demoNight("2026-10-13"));
});

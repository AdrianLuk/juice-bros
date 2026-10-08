import assert from "node:assert/strict";
import { test } from "node:test";

import { flightMatchups, sideOf, type TeamEventDoc } from "../event-doc.ts";
import { demoNight } from "./night.ts";
import { applyDemoWrite, type DemoActor, type DemoWrite } from "./reduce.ts";

const AT = "2026-10-13T23:50:00.000Z";
const night = demoNight("2026-10-13");
const ME: DemoActor = { kind: "team", teamId: night.myTeamId };
const ORGANIZER: DemoActor = { kind: "organizer" };

function apply(event: TeamEventDoc, actor: DemoActor, write: DemoWrite): TeamEventDoc {
  const { event: next, result } = applyDemoWrite(event, actor, write, AT);
  assert.deepEqual(result, { ok: true });
  return next;
}

function refused(event: TeamEventDoc, actor: DemoActor, write: DemoWrite): string {
  const { event: next, result } = applyDemoWrite(event, actor, write, AT);
  assert.equal(next, event, "a refused write leaves the night as it was");
  assert.equal(result.ok, false);
  return result.ok ? "" : result.problem;
}

const match = (event: TeamEventDoc, number: number) =>
  event.matchups.find((matchup) => matchup.stage === "opening" && matchup.number === number)!;
const game = (event: TeamEventDoc, number: number, index: number) => match(event, number).games[index];

test("a score you enter lands on your Game, entered by your Team", () => {
  const id = game(night.event, 1, 2).id;
  const after = apply(night.event, ME, { type: "score", gameId: id, red: 11, blue: 8 });
  const saved = game(after, 1, 2);
  assert.deepEqual([saved.redScore, saved.blueScore, saved.lastEditedByKind, saved.lastEditedByTeamId], [
    11,
    8,
    "team",
    night.myTeamId,
  ]);
});

test("13-9 is refused with the real message", () => {
  assert.equal(
    refused(night.event, ME, { type: "score", gameId: game(night.event, 1, 2).id, red: 13, blue: 9 }),
    "13-9 can't happen: the game ends at 11-9",
  );
});

test("a Score Link only scores its own Matchup, and a done Matchup is locked", () => {
  assert.equal(
    refused(night.event, ME, { type: "score", gameId: game(night.event, 7, 5).id, red: 11, blue: 3 }),
    "That Game isn't in your Matchup.",
  );
  assert.equal(
    refused(night.event, ORGANIZER, { type: "score", gameId: game(night.event, 2, 0).id, red: 11, blue: 3 }),
    "This Matchup is done. Only the organizer can reopen it.",
  );
  assert.equal(refused(night.event, ME, { type: "done", matchupId: match(night.event, 7).id }), "That Matchup isn't yours.");
});

test("the tied Matchup needs its Dreambreaker before it can be done", () => {
  const tied = match(night.event, 6);
  const captain: DemoActor = { kind: "team", teamId: tied.redTeamId };
  assert.equal(
    refused(night.event, captain, { type: "done", matchupId: tied.id }),
    "Tied 56-56. Record who won the Dreambreaker first.",
  );
  const decided = apply(night.event, captain, { type: "dreambreaker", matchupId: tied.id, winnerTeamId: tied.blueTeamId });
  const done = apply(decided, captain, { type: "done", matchupId: tied.id });
  assert.equal(match(done, 6).doneAt, AT);
  assert.equal(match(done, 6).doneByTeamId, tied.redTeamId);
  assert.equal(
    refused(night.event, captain, { type: "dreambreaker", matchupId: match(night.event, 7).id, winnerTeamId: null }),
    "That Matchup isn't yours.",
  );
});

test("a scored Round pins its slot, and the Organizer may rename any Team's", () => {
  const me = night.event.teams.find((team) => team.id === night.myTeamId)!;
  const roster = { slotA: me.slotA, slotB: me.slotC, slotC: me.slotB };
  const swapped = apply(night.event, ME, { type: "roster", teamId: me.id, roster });
  const after = swapped.teams.find((team) => team.id === me.id)!;
  assert.deepEqual([after.slotB, after.slotC], [me.slotC, me.slotB]);

  assert.equal(
    refused(night.event, ME, { type: "roster", teamId: me.id, roster: { ...roster, slotA: "Someone Else" } }),
    `Round 1 already has a score, so Player A stays ${me.slotA}.`,
  );
  const other = match(night.event, 7).redTeamId;
  assert.equal(
    refused(night.event, ME, { type: "roster", teamId: other, roster }),
    "That Score Link only edits its own Team.",
  );
  const doneTeam = match(night.event, 2).redTeamId;
  const theirs = night.event.teams.find((team) => team.id === doneTeam)!;
  assert.equal(
    refused(night.event, ORGANIZER, {
      type: "roster",
      teamId: doneTeam,
      roster: { slotA: theirs.slotA, slotB: theirs.slotB, slotC: theirs.slotC },
    }),
    "This Team's Matchup is done, so its roster is final.",
  );
});

test("only the Organizer reopens, seeds now, swaps courts or calls a tie", () => {
  for (const write of [
    { type: "reopen", matchupId: match(night.event, 2).id },
    { type: "seedNow" },
    { type: "tieOrder", teamIds: [] },
  ] as DemoWrite[]) {
    assert.equal(refused(night.event, ME, write), "Only the organizer can do that.");
  }

  const reopened = apply(night.event, ORGANIZER, { type: "reopen", matchupId: match(night.event, 2).id });
  assert.equal(match(reopened, 2).doneAt, null);
  assert.equal(refused(reopened, ORGANIZER, { type: "reopen", matchupId: match(night.event, 2).id }), "This Matchup isn't done.");
});

test("Seed now places the Flights from the scores as they stand, once, and the courts swap until a Flight has a score", () => {
  const seeded = apply(night.event, ORGANIZER, { type: "seedNow" });
  assert.equal(seeded.status, "flights");
  const flights = flightMatchups(seeded);
  assert.equal(flights.length, 7);
  // Match 3's blue Team has 62, the most so far; Match 2's red Team is next on 61.
  assert.deepEqual([flights[0].redTeamId, flights[0].blueTeamId], [match(night.event, 3).blueTeamId, match(night.event, 2).redTeamId]);
  assert.equal(refused(seeded, ORGANIZER, { type: "seedNow" }), "The Flights are already placed.");

  const swapped = apply(seeded, ORGANIZER, { type: "swapCourts", flightId: flights[0].id, otherFlightId: flights[1].id });
  assert.deepEqual(flightMatchups(swapped).map((flight) => flight.courtPair.join(" & ")).slice(0, 2), ["17 & 18", "16 & 19"]);

  const flightA = flightMatchups(swapped)[0];
  const playing = apply(swapped, ORGANIZER, { type: "score", gameId: flightA.games[0].id, red: 11, blue: 4 });
  assert.equal(
    refused(playing, ORGANIZER, { type: "swapCourts", flightId: flights[0].id, otherFlightId: flights[1].id }),
    "A Flight has a score, so the courts stay.",
  );
});

test("once the night has ended, nothing changes", () => {
  const finished: TeamEventDoc = { ...night.event, status: "finished" };
  assert.equal(
    refused(finished, ME, { type: "score", gameId: game(night.event, 1, 2).id, red: 11, blue: 8 }),
    "This Team Event has finished, so its scores are final.",
  );
  const me = night.event.teams.find((team) => team.id === night.myTeamId)!;
  assert.equal(
    refused(finished, ME, { type: "roster", teamId: me.id, roster: { slotA: me.slotA, slotB: me.slotB, slotC: me.slotC } }),
    "This Team Event has finished, so its rosters are final.",
  );
});

test("your Team's Matchup is the one you can mark done", () => {
  let event = night.event;
  const mine = match(event, 1);
  for (const [index, g] of mine.games.entries()) {
    if (g.redScore !== null) continue;
    event = apply(event, ME, { type: "score", gameId: g.id, red: index % 2 ? 9 : 11, blue: index % 2 ? 11 : 6 });
  }
  event = apply(event, ME, { type: "done", matchupId: mine.id });
  assert.ok(sideOf(match(event, 1), night.myTeamId));
  assert.equal(match(event, 1).doneByTeamId, night.myTeamId);
});

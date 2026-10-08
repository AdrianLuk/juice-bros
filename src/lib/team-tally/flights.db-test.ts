/**
 * Matchup done, Seeding and Flights (issue #624) against the local database:
 * two captains tapping Matchup done on the last two Matchups at the same
 * moment place the Flights exactly once, and the Flights the database places
 * are the order the screens' standings show (src/lib/team-tally/seeding.ts).
 */

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { anonClient, createTestUser, deleteTestUser, type TestUser } from "../db-test-support.ts";
import { loadTeamEvent, saveTeamEvent } from "./events.ts";
import {
  loadOrganizerEvent,
  markDoneByLink,
  saveScoreAsOrganizer,
  seedNowAsOrganizer,
  setDreambreakerByLink,
} from "./live-events.ts";
import type { TeamEventSetup } from "./setup.ts";
import { computeStandings, placedOrder } from "./standings.ts";

const users: TestUser[] = [];

after(async () => {
  await Promise.all(users.map(deleteTestUser));
});

const NIGHT: TeamEventSetup = {
  name: "Tuesday Team Night",
  date: "2026-10-13",
  teams: [
    { nickname: "Golden Set", captain: "Ben Johns", slotA: "Anna Leigh Waters", slotB: "Collin Johns", slotC: "Anna Bright", homeCourt: "16" },
    { nickname: "", captain: "Federico Staksrud", slotA: "Catherine Parenteau", slotB: "Andrei Daescu", slotC: "Jorja Johnson", homeCourt: "19" },
    { nickname: "Kitchen Kings", captain: "Hayden Patriquin", slotA: "Tyra Black", slotB: "Gabriel Tardio", slotC: "Lea Jansen", homeCourt: "17" },
    { nickname: "", captain: "Christian Alshon", slotA: "Jessie Irvine", slotB: "JW Johnson", slotC: "Kaitlyn Christian", homeCourt: "18" },
  ],
  matchups: [
    { red: 0, blue: 1 },
    { red: 2, blue: 3 },
  ],
};

async function night() {
  const organizer = await createTestUser("Team Tally Organizer");
  users.push(organizer);
  const eventId = await saveTeamEvent(organizer.supabase, NIGHT);
  const loaded = (await loadTeamEvent(organizer.supabase, eventId))!;
  return { organizer, eventId, tokens: loaded.teams.map((team) => team.scoreToken) };
}

/** Scores a Matchup's six Games as the Organizer, red side first, in Round order. */
async function score(organizer: TestUser, eventId: string, matchupIndex: number, scores: [number, number][]) {
  const event = (await loadOrganizerEvent(organizer.supabase, eventId))!;
  const games = event.matchups[matchupIndex].games;
  for (const [index, [red, blue]] of scores.entries()) {
    assert.deepEqual(await saveScoreAsOrganizer(organizer.supabase, games[index].id, red, blue), { ok: true });
  }
  return event.matchups[matchupIndex].id;
}

const RED_WINS: [number, number][] = [
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

test("two captains marking the last two Matchups done at the same moment place the Flights exactly once", async () => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { organizer, eventId, tokens } = await night();
    const m1 = await score(organizer, eventId, 0, RED_WINS);
    const m2 = await score(organizer, eventId, 1, RED_WINS);

    // Two phones, two connections, one moment.
    const results = await Promise.all([
      markDoneByLink(anonClient(), tokens[0], m1),
      markDoneByLink(anonClient(), tokens[3], m2),
    ]);
    assert.deepEqual(results, [{ ok: true }, { ok: true }]);

    const event = (await loadOrganizerEvent(organizer.supabase, eventId))!;
    assert.equal(event.status, "flights");
    assert.ok(event.seededAt);
    assert.deepEqual(
      event.matchups.filter((matchup) => matchup.stage === "flight").map((matchup) => matchup.flightLetter),
      ["A", "B"],
    );
  }
});

test("the Flights the database places are the standings' order, Dreambreaker included", async () => {
  const { organizer, eventId, tokens } = await night();
  const m1 = await score(organizer, eventId, 0, TIED);
  const m2 = await score(organizer, eventId, 1, RED_WINS);

  assert.deepEqual(await setDreambreakerByLink(anonClient(), tokens[1], m1, (await loadOrganizerEvent(organizer.supabase, eventId))!.teams[1].id), {
    ok: true,
  });
  const before = (await loadOrganizerEvent(organizer.supabase, eventId))!;
  const standings = computeStandings(before).map((row) => row.teamId);

  assert.deepEqual(await markDoneByLink(anonClient(), tokens[0], m1), { ok: true });
  assert.deepEqual(await markDoneByLink(anonClient(), tokens[2], m2), { ok: true });

  const placed = (await loadOrganizerEvent(organizer.supabase, eventId))!;
  assert.deepEqual(placedOrder(placed), standings);
  // Federico's Team won the Dreambreaker, so it sits above Ben's.
  assert.ok(standings.indexOf(before.teams[1].id) < standings.indexOf(before.teams[0].id));
  assert.deepEqual(
    placed.matchups.filter((matchup) => matchup.stage === "flight").map((matchup) => matchup.courtPair.join(" & ")),
    ["16 & 19", "17 & 18"],
  );
});

test("a refused Matchup done comes back as the reason, and Seed now places the Flights once", async () => {
  const { organizer, eventId, tokens } = await night();
  const event = (await loadOrganizerEvent(organizer.supabase, eventId))!;

  assert.deepEqual(await markDoneByLink(anonClient(), tokens[0], event.matchups[0].id), {
    ok: false,
    problem: "Round 1's captains' game has no score yet.",
  });
  assert.deepEqual(await markDoneByLink(anonClient(), tokens[0], event.matchups[1].id), {
    ok: false,
    problem: "That Matchup isn't yours.",
  });

  assert.deepEqual(await seedNowAsOrganizer(organizer.supabase, eventId), { ok: true });
  assert.deepEqual(await seedNowAsOrganizer(organizer.supabase, eventId), {
    ok: false,
    problem: "The Flights are already placed.",
  });
});

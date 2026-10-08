/**
 * Team Tally's Team Event store (issue #622), against the local database as a
 * signed-in Organizer: what the setup form saves is what the Brief page loads
 * back, an edit keeps each Team (and so its Score Link), and another User's
 * list stays empty.
 */

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { createTestUser, deleteTestUser, type TestUser } from "../db-test-support.ts";
import type { TeamEventSetup } from "./setup.ts";
import { listTeamEvents, loadTeamEvent, saveTeamEvent, SetupRefused } from "./events.ts";
import { loadOrganizerEvent, saveScoreAsOrganizer } from "./live-events.ts";

const users: TestUser[] = [];

after(async () => {
  // Deleting the Organizer takes their Team Events with them.
  await Promise.all(users.map(deleteTestUser));
});

async function organizer(): Promise<TestUser> {
  const user = await createTestUser("Team Tally Organizer");
  users.push(user);
  return user;
}

function fourTeamNight(): TeamEventSetup {
  return {
    name: "Tuesday Team Night",
    date: "2026-10-13",
    teams: [
      { nickname: "Golden Set", captain: "Ben Johns", slotA: "Anna Leigh Waters", slotB: "Collin Johns", slotC: "Anna Bright", homeCourt: "16" },
      { nickname: "", captain: "Federico Staksrud", slotA: "Catherine Parenteau", slotB: "Andrei Daescu", slotC: "Jorja Johnson", homeCourt: "19" },
      { nickname: "Kitchen Kings", captain: "Hayden Patriquin", slotA: "Tyra Black", slotB: "Gabriel Tardio", slotC: "Lea Jansen", homeCourt: "17" },
      { nickname: "", captain: "Christian Alshon", slotA: "Jessie Irvine", slotB: "JW Johnson", slotC: "Kaitlyn Christian", homeCourt: "18" },
    ],
    matchups: [
      { red: 2, blue: 3 },
      { red: 0, blue: 1 },
    ],
  };
}

test("a saved Team Event loads back as it was set up", async () => {
  const { supabase } = await organizer();

  const eventId = await saveTeamEvent(supabase, fourTeamNight());
  const loaded = await loadTeamEvent(supabase, eventId);

  assert.ok(loaded);
  assert.equal(loaded.name, "Tuesday Team Night");
  assert.equal(loaded.date, "2026-10-13");
  assert.equal(loaded.status, "opening");
  assert.deepEqual(
    loaded.teams.map(({ nickname, captain, slotA, slotB, slotC, homeCourt }) => ({
      nickname, captain, slotA, slotB, slotC, homeCourt,
    })),
    fourTeamNight().teams,
  );
  assert.deepEqual(loaded.matchups, [
    { red: 2, blue: 3 },
    { red: 0, blue: 1 },
  ]);
  assert.equal(new Set(loaded.teams.map((team) => team.scoreToken)).size, 4);
  assert.ok(loaded.publicToken.length >= 24);
});

test("the Organizer's list shows their Team Events, newest night first", async () => {
  const { supabase } = await organizer();

  await saveTeamEvent(supabase, fourTeamNight());
  await saveTeamEvent(supabase, { ...fourTeamNight(), name: "Next Tuesday", date: "2026-10-20" });

  const events = await listTeamEvents(supabase);
  assert.deepEqual(
    events.map(({ name, date, teamCount }) => ({ name, date, teamCount })),
    [
      { name: "Next Tuesday", date: "2026-10-20", teamCount: 4 },
      { name: "Tuesday Team Night", date: "2026-10-13", teamCount: 4 },
    ],
  );
});

test("an edit keeps every Team's Score Link", async () => {
  const { supabase } = await organizer();
  const eventId = await saveTeamEvent(supabase, fourTeamNight());
  const before = await loadTeamEvent(supabase, eventId);
  assert.ok(before);

  const edited: TeamEventSetup = {
    ...fourTeamNight(),
    name: "Tuesday Team Night, week 2",
    teams: before.teams.map((team, index) =>
      index === 1 ? { ...team, nickname: "Third Shot Drop" } : team,
    ),
  };
  await saveTeamEvent(supabase, edited, eventId);
  const after = await loadTeamEvent(supabase, eventId);

  assert.ok(after);
  assert.equal(after.name, "Tuesday Team Night, week 2");
  assert.equal(after.teams[1].nickname, "Third Shot Drop");
  assert.deepEqual(
    after.teams.map((team) => team.scoreToken),
    before.teams.map((team) => team.scoreToken),
  );
});

test("another User can't list or load the Organizer's Team Event", async () => {
  const owner = await organizer();
  const stranger = await organizer();
  const eventId = await saveTeamEvent(owner.supabase, fourTeamNight());

  assert.deepEqual(await listTeamEvents(stranger.supabase), []);
  assert.equal(await loadTeamEvent(stranger.supabase, eventId), null);
});

test("once a Game has a score, an edit is refused with the reason and the night stays as it was", async () => {
  const { supabase } = await organizer();
  const eventId = await saveTeamEvent(supabase, fourTeamNight());
  const before = (await loadTeamEvent(supabase, eventId))!;
  const live = (await loadOrganizerEvent(supabase, eventId))!;
  assert.deepEqual(await saveScoreAsOrganizer(supabase, live.matchups[0].games[0].id, 11, 9), { ok: true });

  const repaired: TeamEventSetup = {
    ...fourTeamNight(),
    teams: before.teams,
    matchups: [
      { red: 0, blue: 2 },
      { red: 1, blue: 3 },
    ],
  };
  await assert.rejects(saveTeamEvent(supabase, repaired, eventId), (error: unknown) => {
    assert.ok(error instanceof SetupRefused);
    assert.equal(error.message, "Play has started, so the setup is set. Rosters change from the Score Links now.");
    return true;
  });

  const after = (await loadTeamEvent(supabase, eventId))!;
  assert.deepEqual(after.matchups, before.matchups);
  assert.equal((await loadOrganizerEvent(supabase, eventId))!.matchups[0].games[0].redScore, 11);
});

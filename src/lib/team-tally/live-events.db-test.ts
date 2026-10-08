/**
 * Team Tally's live scoring store (issue #623), against the local database: a
 * captain with no account scores from their Score Link and the Public Link
 * reads it back with who entered it; a refused score comes back as the
 * reason, not a crash; the Organizer reads and corrects their own night.
 */

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { anonClient, createTestUser, deleteTestUser, type TestUser } from "../db-test-support.ts";
import { deleteTeamEvent, loadTeamEvent, saveTeamEvent } from "./events.ts";
import {
  loadOrganizerEvent,
  loadPublicEvent,
  loadScoreLinkEvent,
  saveScoreAsOrganizer,
  saveScoreByLink,
  setSlotsByLink,
} from "./live-events.ts";
import type { TeamEventSetup } from "./setup.ts";

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
  return { organizer, eventId, loaded };
}

test("a captain scores from their Score Link and the Public Link shows it, entered by their Team", async () => {
  const { loaded } = await night();
  const anon = anonClient();
  const benToken = loaded.teams[0].scoreToken;

  const view = await loadScoreLinkEvent(anon, benToken);
  assert.ok(view);
  assert.equal(view.myTeamId, loaded.teams[0].id);
  const game = view.event.matchups[0].games[0];
  assert.equal(game.round, 1);
  assert.equal(game.kind, "captains");

  assert.deepEqual(await saveScoreByLink(anon, benToken, game.id, 11, 8), { ok: true });

  const shown = await loadPublicEvent(anon, loaded.publicToken);
  const saved = shown?.matchups[0].games.find((candidate) => candidate.id === game.id);
  assert.deepEqual(
    { red: saved?.redScore, blue: saved?.blueScore, by: saved?.lastEditedByTeamId },
    { red: 11, blue: 8, by: loaded.teams[0].id },
  );
});

test("a refused score or a Game outside the Matchup comes back as the reason", async () => {
  const { loaded } = await night();
  const anon = anonClient();
  const token = loaded.teams[0].scoreToken;
  const view = (await loadScoreLinkEvent(anon, token))!;

  assert.deepEqual(await saveScoreByLink(anon, token, view.event.matchups[0].games[0].id, 13, 9), {
    ok: false,
    problem: "13-9 can't happen: the game ends at 11-9",
  });
  assert.deepEqual(await saveScoreByLink(anon, token, view.event.matchups[1].games[0].id, 11, 9), {
    ok: false,
    problem: "That Game isn't in your Matchup.",
  });
});

test("a captain renames a slot, and a wrong token reads nothing", async () => {
  const { loaded } = await night();
  const anon = anonClient();
  const token = loaded.teams[0].scoreToken;

  assert.deepEqual(await setSlotsByLink(anon, token, { slotA: "Anna Leigh Waters", slotB: "Tyra Black", slotC: "Anna Bright" }), {
    ok: true,
  });
  const view = await loadScoreLinkEvent(anon, token);
  assert.equal(view?.event.teams[0].slotB, "Tyra Black");

  assert.equal(await loadScoreLinkEvent(anon, "not-the-token-not-the-token-not-the-token"), null);
});

test("the Organizer reads their night and corrects a Game as the Organizer", async () => {
  const { organizer, eventId } = await night();
  const event = await loadOrganizerEvent(organizer.supabase, eventId);
  assert.ok(event);
  const gameId = event.matchups[1].games[3].id;

  assert.deepEqual(await saveScoreAsOrganizer(organizer.supabase, gameId, 9, 11), { ok: true });
  const after = await loadOrganizerEvent(organizer.supabase, eventId);
  const saved = after?.matchups[1].games[3];
  assert.equal(saved?.lastEditedByKind, "organizer");
  assert.equal(saved?.blueScore, 11);

  const stranger = await createTestUser("Someone else");
  users.push(stranger);
  assert.equal(await loadOrganizerEvent(stranger.supabase, eventId), null);
});

test("deleting a played Team Event takes its Matchups with it and its links stop opening", async () => {
  const { organizer, eventId, loaded } = await night();
  const anon = anonClient();
  const event = await loadOrganizerEvent(organizer.supabase, eventId);
  assert.deepEqual(await saveScoreAsOrganizer(organizer.supabase, event!.matchups[0].games[0].id, 11, 7), { ok: true });
  const publicToken = loaded.publicToken;
  const scoreToken = loaded.teams[0].scoreToken;
  assert.ok(await loadPublicEvent(anon, publicToken));

  assert.deepEqual(await deleteTeamEvent(organizer.supabase, eventId), { ok: true });

  assert.equal(await loadTeamEvent(organizer.supabase, eventId), null);
  assert.equal(await loadOrganizerEvent(organizer.supabase, eventId), null);
  assert.equal(await loadPublicEvent(anon, publicToken), null);
  assert.equal(await loadScoreLinkEvent(anon, scoreToken), null);
});

test("another User cannot delete the Organizer's Team Event", async () => {
  const { organizer, eventId } = await night();
  const stranger = await createTestUser("Someone else");
  users.push(stranger);

  const result = await deleteTeamEvent(stranger.supabase, eventId);
  assert.equal(result.ok, false);
  assert.ok(await loadOrganizerEvent(organizer.supabase, eventId));
});

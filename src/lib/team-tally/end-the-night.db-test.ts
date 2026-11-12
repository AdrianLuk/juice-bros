/**
 * End the night and Resume the night (issue #684) against the local database:
 * the database and the port (`transitions.ts`) land in the same place, only
 * the Organizer or a Superadmin may call either, and an ended night's Score
 * Links are read-only until the night is resumed.
 */

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { anonClient, createTestUser, deleteTestUser, serviceRoleClient, type TestUser } from "../db-test-support.ts";
import { flightMatchups, type TeamEventDoc } from "./event-doc.ts";
import { loadTeamEvent, saveTeamEvent } from "./events.ts";
import { finalPlaces } from "./final-places.ts";
import {
  endNightAsOrganizer,
  loadOrganizerEvent,
  markDoneAsOrganizer,
  markDoneByLink,
  resumeNightAsOrganizer,
  saveScoreAsOrganizer,
  saveScoreByLink,
  seedNowAsOrganizer,
} from "./live-events.ts";
import type { TeamEventSetup } from "./setup.ts";
import { endNight, resumeNight } from "./transitions.ts";

const users: TestUser[] = [];

after(async () => {
  await Promise.all(users.map(deleteTestUser));
});

const NIGHT: TeamEventSetup = {
  name: "End the Night",
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

type Score = [number, number];

const RED_WINS: Score[] = [[11, 8], [11, 9], [7, 11], [11, 6], [9, 11], [11, 4]];
const TIED: Score[] = [[11, 9], [9, 11], [11, 9], [9, 11], [11, 9], [9, 11]];

const AT = "2026-10-13T20:15:00.000Z";

/** What the database and the port must agree on, without the ids and times each makes up. */
function shape(event: TeamEventDoc) {
  return {
    status: event.status,
    flights: flightMatchups(event)
      .sort((a, b) => a.number - b.number)
      .map((flight) => ({
        flightLetter: flight.flightLetter,
        done: flight.doneAt !== null,
        doneByTeamId: flight.doneByTeamId,
        games: flight.games.map((game) => [game.round, game.kind, game.redScore, game.blueScore]),
      })),
  };
}

/**
 * A night in its Flights. Flight A is fully scored and untied; Flight B has
 * only its first Game in. Nothing in a Flight is marked done.
 */
async function nightInFlights() {
  const organizer = await createTestUser("Team Tally End the Night");
  users.push(organizer);
  const eventId = await saveTeamEvent(organizer.supabase, NIGHT);
  const tokens = (await loadTeamEvent(organizer.supabase, eventId))!.teams.map((team) => team.scoreToken);

  const opening = (await loadOrganizerEvent(organizer.supabase, eventId))!;
  for (const matchup of opening.matchups) {
    for (const [index, [red, blue]] of RED_WINS.entries()) {
      assert.deepEqual(await saveScoreAsOrganizer(organizer.supabase, matchup.games[index].id, red, blue), { ok: true });
    }
  }
  assert.deepEqual(await seedNowAsOrganizer(organizer.supabase, eventId), { ok: true });

  const flights = flightMatchups((await loadOrganizerEvent(organizer.supabase, eventId))!).sort((a, b) => a.number - b.number);
  for (const [index, [red, blue]] of RED_WINS.entries()) {
    assert.deepEqual(await saveScoreAsOrganizer(organizer.supabase, flights[0].games[index].id, red, blue), { ok: true });
  }
  assert.deepEqual(await saveScoreAsOrganizer(organizer.supabase, flights[1].games[0].id, 11, 6), { ok: true });

  const read = async () => (await loadOrganizerEvent(organizer.supabase, eventId))!;
  const tokenOf = (event: TeamEventDoc, teamId: string) => tokens[event.teams.findIndex((team) => team.id === teamId)];
  return { organizer, eventId, read, tokenOf };
}

test("the database and the port end the night and resume it the same way", async () => {
  const { organizer, eventId, read } = await nightInFlights();
  const before = await read();
  assert.equal(before.status, "flights");

  const endedLocally = endNight(before, AT);
  assert.ok(endedLocally.ok);
  assert.deepEqual(await endNightAsOrganizer(organizer.supabase, eventId), { ok: true });

  const over = await read();
  assert.equal(over.status, "finished");
  assert.deepEqual(shape(over), shape(endedLocally.event));
  // Flight A was ready, so it has a champion; Flight B's places stay open.
  assert.deepEqual(
    finalPlaces(over).map(({ place }) => place),
    [1, 2],
  );
  assert.deepEqual(finalPlaces(over), finalPlaces(endedLocally.event));

  const resumedLocally = resumeNight(over);
  assert.ok(resumedLocally.ok);
  assert.deepEqual(await resumeNightAsOrganizer(organizer.supabase, eventId), { ok: true });

  const resumed = await read();
  assert.equal(resumed.status, "flights");
  assert.deepEqual(shape(resumed), shape(resumedLocally.event));
  assert.equal(flightMatchups(resumed).find((flight) => flight.flightLetter === "A")!.doneAt !== null, true);
});

test("a tied Flight is closed by End the night only when its Dreambreaker winner is in", async () => {
  const { organizer, eventId, read } = await nightInFlights();
  const flights = flightMatchups(await read()).sort((a, b) => a.number - b.number);
  const [flightA, flightB] = flights;

  // Flight B level at 60-60, no Dreambreaker winner yet.
  for (const [index, [red, blue]] of TIED.entries()) {
    assert.deepEqual(await saveScoreAsOrganizer(organizer.supabase, flightB.games[index].id, red, blue), { ok: true });
  }
  assert.deepEqual(await endNightAsOrganizer(organizer.supabase, eventId), { ok: true });

  const over = await read();
  assert.equal(over.status, "finished");
  const byLetter = (letter: string) => flightMatchups(over).find((flight) => flight.flightLetter === letter)!;
  assert.notEqual(byLetter(flightA.flightLetter!).doneAt, null);
  assert.equal(byLetter(flightB.flightLetter!).doneAt, null);
});

test("End the night and Resume the night are refused with the port's words", async () => {
  const { organizer, eventId } = await nightInFlights();

  assert.deepEqual(await resumeNightAsOrganizer(organizer.supabase, eventId), {
    ok: false,
    problem: "This Team Event is still running.",
  });
  assert.deepEqual(await endNightAsOrganizer(organizer.supabase, eventId), { ok: true });
  assert.deepEqual(await endNightAsOrganizer(organizer.supabase, eventId), {
    ok: false,
    problem: "This Team Event has already finished.",
  });

  const opening = await createTestUser("Team Tally Opening Round");
  users.push(opening);
  const openingId = await saveTeamEvent(opening.supabase, NIGHT);
  assert.deepEqual(await endNightAsOrganizer(opening.supabase, openingId), {
    ok: false,
    problem: "The Flights aren't placed yet.",
  });
});

test("a night that finished on its own can't be resumed: reopening a Flight is the way back", async () => {
  const { organizer, eventId, read } = await nightInFlights();
  const [flightA, flightB] = flightMatchups(await read()).sort((a, b) => a.number - b.number);
  for (const [index, [red, blue]] of RED_WINS.entries()) {
    assert.deepEqual(await saveScoreAsOrganizer(organizer.supabase, flightB.games[index].id, red, blue), { ok: true });
  }
  assert.deepEqual(await markDoneAsOrganizer(organizer.supabase, flightA.id), { ok: true });
  assert.deepEqual(await markDoneAsOrganizer(organizer.supabase, flightB.id), { ok: true });
  assert.equal((await read()).status, "finished");

  assert.deepEqual(await resumeNightAsOrganizer(organizer.supabase, eventId), {
    ok: false,
    problem: "Every Flight is done. Reopen a Flight to play it again.",
  });
});

test("only the Organizer or a Superadmin may end or resume a night, and a Score Link may not", async () => {
  const { eventId, read } = await nightInFlights();
  const stranger = await createTestUser("Team Tally Stranger");
  users.push(stranger);

  assert.deepEqual(await endNightAsOrganizer(stranger.supabase, eventId), { ok: false, problem: "Team Event not found" });
  const anon = await endNightAsOrganizer(anonClient(), eventId);
  assert.equal(anon.ok, false);
  assert.equal((await read()).status, "flights");

  const superadmin = await createTestUser("Team Tally Superadmin");
  users.push(superadmin);
  const { error } = await serviceRoleClient().from("team_tally_superadmins").insert({ user_id: superadmin.userId });
  assert.equal(error, null);

  assert.deepEqual(await endNightAsOrganizer(superadmin.supabase, eventId), { ok: true });
  assert.deepEqual(await resumeNightAsOrganizer(stranger.supabase, eventId), { ok: false, problem: "Team Event not found" });
  assert.deepEqual(await resumeNightAsOrganizer(superadmin.supabase, eventId), { ok: true });
});

test("an ended night's Score Links are read-only until the night is resumed", async () => {
  const { organizer, eventId, read, tokenOf } = await nightInFlights();
  const before = await read();
  const flightB = flightMatchups(before).find((flight) => flight.flightLetter === "B")!;
  const token = tokenOf(before, flightB.redTeamId);

  assert.deepEqual(await endNightAsOrganizer(organizer.supabase, eventId), { ok: true });

  const refused = "This Team Event has finished, so its scores are final.";
  assert.deepEqual(await saveScoreByLink(anonClient(), token, flightB.games[1].id, 11, 7), { ok: false, problem: refused });
  assert.deepEqual(await markDoneByLink(anonClient(), token, flightB.id), { ok: false, problem: refused });

  assert.deepEqual(await resumeNightAsOrganizer(organizer.supabase, eventId), { ok: true });
  assert.deepEqual(await saveScoreByLink(anonClient(), token, flightB.games[1].id, 11, 7), { ok: true });
});

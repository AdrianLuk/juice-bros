/**
 * Parity between the database and the port (issue #631). Placing the Flights
 * and ending the night are the database's to do on a real night
 * (`team_tally_finish_matchup`, `team_tally_seed_flights`); the demo night
 * does them in the browser through `transitions.ts`. This plays one night
 * through both, Matchup done for Matchup done, and checks they land in the
 * same place: the same Flights on the same court pairs with the same Teams,
 * then the same night ended with the same Final places.
 */

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { anonClient, createTestUser, deleteTestUser, type TestUser } from "../db-test-support.ts";
import { flightMatchups, type TeamEventDoc } from "./event-doc.ts";
import { loadTeamEvent, saveTeamEvent } from "./events.ts";
import { finalPlaces } from "./final-places.ts";
import { loadOrganizerEvent, markDoneByLink, saveScoreAsOrganizer, setDreambreakerByLink } from "./live-events.ts";
import type { TeamEventSetup } from "./setup.ts";
import { finishMatchup } from "./transitions.ts";

const users: TestUser[] = [];

after(async () => {
  await Promise.all(users.map(deleteTestUser));
});

const NIGHT: TeamEventSetup = {
  name: "Parity Night",
  date: "2026-10-13",
  teams: [
    { nickname: "Golden Set", captain: "Ben Johns", slotA: "Anna Leigh Waters", slotB: "Collin Johns", slotC: "Anna Bright", homeCourt: "16" },
    { nickname: "", captain: "Federico Staksrud", slotA: "Catherine Parenteau", slotB: "Andrei Daescu", slotC: "Jorja Johnson", homeCourt: "19" },
    { nickname: "Kitchen Kings", captain: "Hayden Patriquin", slotA: "Tyra Black", slotB: "Gabriel Tardio", slotC: "Lea Jansen", homeCourt: "17" },
    { nickname: "", captain: "Christian Alshon", slotA: "Jessie Irvine", slotB: "JW Johnson", slotC: "Kaitlyn Christian", homeCourt: "18" },
    { nickname: "", captain: "Tyson McGuffin", slotA: "Parris Todd", slotB: "Dylan Frazier", slotC: "Callie Smith", homeCourt: "21" },
    { nickname: "", captain: "Jay Devilliers", slotA: "Rachel Rohrabacher", slotB: "Connor Garnett", slotC: "Vivienne David", homeCourt: "22" },
  ],
  matchups: [
    { red: 0, blue: 1 },
    { red: 2, blue: 3 },
    { red: 4, blue: 5 },
  ],
};

type Score = [number, number];

/** Six Games per Matchup, Round order, captains' game first. Match 1 is tied 60-60. */
const OPENING: Score[][] = [
  [[11, 9], [9, 11], [11, 9], [9, 11], [11, 9], [9, 11]],
  [[11, 8], [11, 9], [7, 11], [11, 6], [9, 11], [11, 4]],
  [[8, 11], [9, 11], [11, 7], [6, 11], [11, 10], [5, 11]],
];

/** Flight A tied (decided by its Dreambreaker), then two clear wins. */
const FLIGHTS: Score[][] = [
  [[11, 9], [9, 11], [11, 9], [9, 11], [11, 9], [9, 11]],
  [[4, 11], [11, 9], [3, 11], [11, 7], [10, 12], [11, 5]],
  [[11, 2], [11, 3], [11, 4], [11, 5], [11, 6], [11, 7]],
];

const AT = "2026-10-13T20:15:00.000Z";

/** What both sides must agree on, without the ids and times each side makes up. */
function shape(event: TeamEventDoc) {
  return {
    status: event.status,
    seeded: event.seededAt !== null,
    flights: flightMatchups(event)
      .sort((a, b) => a.number - b.number)
      .map((flight) => ({
        number: flight.number,
        flightLetter: flight.flightLetter,
        courtPair: flight.courtPair,
        redTeamId: flight.redTeamId,
        blueTeamId: flight.blueTeamId,
        done: flight.doneAt !== null,
        games: flight.games.map((game) => [game.round, game.kind, game.redScore, game.blueScore]),
      })),
  };
}

function scoreLocally(event: TeamEventDoc, matchupId: string, scores: Score[]): TeamEventDoc {
  return {
    ...event,
    matchups: event.matchups.map((matchup) =>
      matchup.id !== matchupId
        ? matchup
        : {
            ...matchup,
            games: matchup.games.map((game, index) => ({
              ...game,
              redScore: scores[index][0],
              blueScore: scores[index][1],
              lastEditedByKind: "organizer" as const,
            })),
          },
    ),
  };
}

function doneLocally(event: TeamEventDoc, matchupId: string, byTeamId: string): TeamEventDoc {
  const result = finishMatchup(event, matchupId, byTeamId, AT);
  assert.ok(result.ok, result.ok ? "" : result.problem);
  return result.event;
}

test("the database and the port place the same Flights and end the night the same way", async () => {
  const organizer = await createTestUser("Team Tally Parity");
  users.push(organizer);
  const eventId = await saveTeamEvent(organizer.supabase, NIGHT);
  const tokens = (await loadTeamEvent(organizer.supabase, eventId))!.teams.map((team) => team.scoreToken);
  const read = async () => (await loadOrganizerEvent(organizer.supabase, eventId))!;
  const tokenOf = (event: TeamEventDoc, teamId: string) => tokens[event.teams.findIndex((team) => team.id === teamId)];

  // The opening round, scored in the database.
  let db = await read();
  for (const [index, matchup] of db.matchups.entries()) {
    for (const [g, [red, blue]] of OPENING[index].entries()) {
      assert.deepEqual(await saveScoreAsOrganizer(organizer.supabase, matchup.games[g].id, red, blue), { ok: true });
    }
  }
  const tied = db.matchups[0];
  assert.deepEqual(await setDreambreakerByLink(anonClient(), tokens[1], tied.id, tied.blueTeamId), { ok: true });

  // From here, the port starts from exactly what the database holds.
  db = await read();
  let local = db;

  for (const matchup of db.matchups) {
    assert.deepEqual(await markDoneByLink(anonClient(), tokenOf(db, matchup.redTeamId), matchup.id), { ok: true });
    local = doneLocally(local, matchup.id, matchup.redTeamId);
  }

  db = await read();
  assert.equal(db.status, "flights");
  assert.deepEqual(shape(local), shape(db));

  // The Flights, scored the same on both sides, then done in Flight order.
  const dbFlights = flightMatchups(db).sort((a, b) => a.number - b.number);
  const localFlights = flightMatchups(local).sort((a, b) => a.number - b.number);
  for (const [index, flight] of dbFlights.entries()) {
    for (const [g, [red, blue]] of FLIGHTS[index].entries()) {
      assert.deepEqual(await saveScoreAsOrganizer(organizer.supabase, flight.games[g].id, red, blue), { ok: true });
    }
    local = scoreLocally(local, localFlights[index].id, FLIGHTS[index]);
  }
  const flightA = dbFlights[0];
  assert.deepEqual(await setDreambreakerByLink(anonClient(), tokenOf(db, flightA.blueTeamId), flightA.id, flightA.blueTeamId), {
    ok: true,
  });
  local = {
    ...local,
    matchups: local.matchups.map((matchup) =>
      matchup.id === localFlights[0].id ? { ...matchup, dreambreakerWinnerId: localFlights[0].blueTeamId } : matchup,
    ),
  };

  for (const [index, flight] of dbFlights.entries()) {
    assert.deepEqual(await markDoneByLink(anonClient(), tokenOf(db, flight.redTeamId), flight.id), { ok: true });
    local = doneLocally(local, localFlights[index].id, flight.redTeamId);
    assert.equal(local.status, (await read()).status, `after Flight ${flight.flightLetter} is done`);
  }

  db = await read();
  assert.equal(db.status, "finished");
  assert.deepEqual(shape(local), shape(db));
  assert.deepEqual(finalPlaces(local), finalPlaces(db));
});

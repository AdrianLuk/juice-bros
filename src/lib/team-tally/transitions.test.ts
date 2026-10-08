import assert from "node:assert/strict";
import { test } from "node:test";

import { flightMatchups, type DocGame, type DocMatchup, type TeamEventDoc } from "./event-doc.ts";
import { finishMatchup, placeFlights } from "./transitions.ts";

type Score = [number, number] | null;

function games(matchupId: string, scores: Score[]): DocGame[] {
  return scores.map((score, index) => ({
    id: `${matchupId}-g${index}`,
    round: (Math.floor(index / 2) + 1) as 1 | 2 | 3,
    kind: index % 2 === 0 ? "captains" : "teammates",
    redScore: score?.[0] ?? null,
    blueScore: score?.[1] ?? null,
    lastEditedByKind: score ? "organizer" : null,
    lastEditedByTeamId: null,
  }));
}

function opening(number: number, red: string, blue: string, courts: [string, string], scores: Score[]): DocMatchup {
  const id = `m${number}`;
  return {
    id,
    stage: "opening",
    number,
    flightLetter: null,
    courtPair: courts,
    redTeamId: red,
    blueTeamId: blue,
    games: games(id, scores),
    doneAt: null,
    doneByTeamId: null,
    dreambreakerWinnerId: null,
  };
}

// Match 1: t1 60, t2 49. Match 2: t3 50, t4 61. So the order is t4, t1, t3, t2.
const RED_60_49: Score[] = [
  [11, 8],
  [11, 9],
  [7, 11],
  [11, 6],
  [9, 11],
  [11, 4],
];
const RED_50_61: Score[] = [
  [8, 11],
  [9, 11],
  [11, 7],
  [6, 11],
  [11, 10],
  [5, 11],
];
const UNSCORED: Score[] = [null, null, null, null, null, null];

function night(overrides: Partial<TeamEventDoc> = {}): TeamEventDoc {
  const team = (id: string, captain: string) => ({
    id,
    nickname: null,
    homeCourt: "1",
    captain,
    slotA: `${captain} A`,
    slotB: `${captain} B`,
    slotC: `${captain} C`,
  });
  return {
    id: "event-1",
    name: "Tuesday Team Night",
    date: "2026-10-13",
    status: "opening",
    teams: [team("t1", "Ben Johns"), team("t2", "Federico Staksrud"), team("t3", "Hayden Patriquin"), team("t4", "Christian Alshon")],
    matchups: [
      opening(1, "t1", "t2", ["16", "19"], RED_60_49),
      opening(2, "t3", "t4", ["17", "18"], RED_50_61),
    ],
    seededAt: null,
    tieOrder: [],
    ...overrides,
  };
}

const AT = "2026-10-13T20:15:00.000Z";

function done(event: TeamEventDoc, matchupId: string, byTeamId: string | null = null): TeamEventDoc {
  const result = finishMatchup(event, matchupId, byTeamId, AT);
  assert.ok(result.ok, result.ok ? "" : result.problem);
  return result.event;
}

test("Matchup done locks it and says who marked it", () => {
  const after = done(night(), "m1", "t2");
  const m1 = after.matchups.find((matchup) => matchup.id === "m1")!;
  assert.equal(m1.doneAt, AT);
  assert.equal(m1.doneByTeamId, "t2");
  assert.equal(after.status, "opening");
  assert.deepEqual(flightMatchups(after), []);
});

test("Matchup done is refused with the database's words", () => {
  const event = night({ matchups: [opening(1, "t1", "t2", ["16", "19"], UNSCORED), night().matchups[1]] });
  assert.deepEqual(finishMatchup(event, "m1", "t1", AT), {
    ok: false,
    problem: "Round 1's captains' game has no score yet.",
  });

  const once = done(night(), "m1");
  assert.deepEqual(finishMatchup(once, "m1", null, AT), { ok: false, problem: "This Matchup is already done." });

  assert.deepEqual(finishMatchup(night({ status: "finished" }), "m1", null, AT), {
    ok: false,
    problem: "This Team Event has finished, so its scores are final.",
  });
  assert.deepEqual(finishMatchup(night(), "nope", null, AT), { ok: false, problem: "Matchup not found" });
});

test("the last opening Matchup done places the Flights on the opening court pairs, higher seed red", () => {
  const seeded = done(done(night(), "m1"), "m2", "t4");

  assert.equal(seeded.status, "flights");
  assert.equal(seeded.seededAt, AT);
  const flights = flightMatchups(seeded);
  assert.deepEqual(
    flights.map(({ number, flightLetter, courtPair, redTeamId, blueTeamId, doneAt }) => ({
      number,
      flightLetter,
      courtPair,
      redTeamId,
      blueTeamId,
      doneAt,
    })),
    [
      { number: 1, flightLetter: "A", courtPair: ["16", "19"], redTeamId: "t4", blueTeamId: "t1", doneAt: null },
      { number: 2, flightLetter: "B", courtPair: ["17", "18"], redTeamId: "t3", blueTeamId: "t2", doneAt: null },
    ],
  );
  for (const flight of flights) {
    assert.deepEqual(
      flight.games.map((game) => [game.round, game.kind, game.redScore, game.blueScore]),
      [
        [1, "captains", null, null],
        [1, "teammates", null, null],
        [2, "captains", null, null],
        [2, "teammates", null, null],
        [3, "captains", null, null],
        [3, "teammates", null, null],
      ],
    );
  }
  // Every Game id is new and distinct.
  const ids = seeded.matchups.flatMap((matchup) => [matchup.id, ...matchup.games.map((game) => game.id)]);
  assert.equal(new Set(ids).size, ids.length);
});

test("the Organizer's order settles a tie on every count when the Flights are placed", () => {
  const level = night({
    matchups: [opening(1, "t1", "t2", ["16", "19"], RED_60_49), opening(2, "t3", "t4", ["17", "18"], RED_60_49)],
  });
  // t1 and t3 are level on every count, as are t2 and t4: setup order puts t1 then t3.
  assert.deepEqual(
    flightMatchups(placeFlights(level, AT)).map((flight) => [flight.redTeamId, flight.blueTeamId]),
    [
      ["t1", "t3"],
      ["t2", "t4"],
    ],
  );
  assert.deepEqual(
    flightMatchups(placeFlights({ ...level, tieOrder: ["t3", "t1"] }, AT)).map((flight) => [
      flight.redTeamId,
      flight.blueTeamId,
    ]),
    [
      ["t3", "t1"],
      ["t2", "t4"],
    ],
  );
});

test("reopening an opening Matchup after Seeding and finishing it again leaves the Flights where they are", () => {
  const seeded = done(done(night(), "m1"), "m2");
  const reopened: TeamEventDoc = {
    ...seeded,
    matchups: seeded.matchups.map((matchup) => (matchup.id === "m1" ? { ...matchup, doneAt: null } : matchup)),
  };
  const again = done(reopened, "m1");
  assert.equal(again.status, "flights");
  assert.equal(flightMatchups(again).length, 2);
});

test("the last Flight Matchup done ends the night", () => {
  const seeded = done(done(night(), "m1"), "m2");
  const scored: TeamEventDoc = {
    ...seeded,
    matchups: seeded.matchups.map((matchup) =>
      matchup.stage === "flight" ? { ...matchup, games: games(matchup.id, RED_60_49) } : matchup,
    ),
  };
  const [flightA, flightB] = flightMatchups(scored);

  const one = done(scored, flightA.id);
  assert.equal(one.status, "flights");
  const over = done(one, flightB.id);
  assert.equal(over.status, "finished");
  assert.deepEqual(finishMatchup(over, flightA.id, null, AT), {
    ok: false,
    problem: "This Team Event has finished, so its scores are final.",
  });
});

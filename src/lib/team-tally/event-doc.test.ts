import assert from "node:assert/strict";
import { test } from "node:test";

import { setupIsSet, type DocMatchup, type TeamEventDoc } from "./event-doc.ts";

function matchup(scored: boolean): DocMatchup {
  return {
    id: "m1",
    stage: "opening",
    number: 1,
    flightLetter: null,
    courtPair: ["16", "19"],
    redTeamId: "ben",
    blueTeamId: "fed",
    games: [
      {
        id: "g1",
        round: 1,
        kind: "captains",
        redScore: scored ? 11 : null,
        blueScore: scored ? 9 : null,
        lastEditedByKind: scored ? "team" : null,
        lastEditedByTeamId: scored ? "ben" : null,
      },
    ],
    doneAt: null,
    doneByTeamId: null,
    dreambreakerWinnerId: null,
  };
}

function night(status: TeamEventDoc["status"], scored: boolean): TeamEventDoc {
  return {
    id: "e",
    name: "Tuesday Team Night",
    date: "2026-10-13",
    status,
    teams: [],
    matchups: [matchup(scored)],
    seededAt: null,
    tieOrder: [],
  };
}

test("the setup stays editable until a Game has a score", () => {
  assert.equal(setupIsSet(night("opening", false)), false);
  assert.equal(setupIsSet(night("opening", true)), true);
});

test("the setup is set once the Flights are placed, scored or not", () => {
  assert.equal(setupIsSet(night("flights", false)), true);
  assert.equal(setupIsSet(night("finished", false)), true);
});

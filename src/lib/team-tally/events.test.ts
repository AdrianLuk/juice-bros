import assert from "node:assert/strict";
import test from "node:test";

import { briefInputFor, type LoadedTeamEvent } from "./events.ts";

function savedTeam(captain: string, homeCourt: string, scoreToken: string) {
  return {
    id: `id-${scoreToken}`,
    scoreToken,
    nickname: "",
    captain,
    slotA: `${captain} A`,
    slotB: `${captain} B`,
    slotC: `${captain} C`,
    homeCourt,
  };
}

test("a loaded Team Event becomes a Brief in MATCH order, each Team with its own Score Link", () => {
  const event: LoadedTeamEvent = {
    id: "event-1",
    name: "Tuesday Team Night",
    date: "2026-10-13",
    status: "opening",
    publicToken: "public-token",
    teams: [
      savedTeam("Ben Johns", "16", "token-ben"),
      savedTeam("Federico Staksrud", "19", "token-federico"),
      savedTeam("Anna Leigh Waters", "17", "token-anna"),
      savedTeam("Christian Alshon", "18", "token-christian"),
    ],
    matchups: [
      { red: 3, blue: 2 },
      { red: 0, blue: 1 },
    ],
  };

  const input = briefInputFor(event, "https://juicebrospickleball.com");

  assert.equal(input.publicLink, "https://juicebrospickleball.com/tools/team-tally/live/public-token");
  assert.deepEqual(
    input.matchups.map(({ red, blue }) => [red.captain, red.scoreLink, blue.captain, blue.scoreLink]),
    [
      [
        "Christian Alshon",
        "https://juicebrospickleball.com/tools/team-tally/score/token-christian",
        "Anna Leigh Waters",
        "https://juicebrospickleball.com/tools/team-tally/score/token-anna",
      ],
      [
        "Ben Johns",
        "https://juicebrospickleball.com/tools/team-tally/score/token-ben",
        "Federico Staksrud",
        "https://juicebrospickleball.com/tools/team-tally/score/token-federico",
      ],
    ],
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  comingTuesday,
  parseSetup,
  validateSetup,
  type SetupTeam,
  type TeamEventSetup,
} from "./setup.ts";

test("a new Team Event defaults to the coming Tuesday, tonight when it is Tuesday", () => {
  assert.equal(comingTuesday("2026-10-08"), "2026-10-13"); // a Thursday
  assert.equal(comingTuesday("2026-10-13"), "2026-10-13"); // a Tuesday
  assert.equal(comingTuesday("2026-10-14"), "2026-10-20"); // a Wednesday
  assert.equal(comingTuesday("2026-12-30"), "2027-01-05"); // over the year end
});

function team(captain: string, homeCourt: string, nickname = ""): SetupTeam {
  return {
    captain,
    slotA: `${captain} A`,
    slotB: `${captain} B`,
    slotC: `${captain} C`,
    nickname,
    homeCourt,
  };
}

/** Next Tuesday's smallest real night: four Teams, two opening Matchups. */
function fourTeamNight(): TeamEventSetup {
  return {
    name: "Tuesday Team Night",
    date: "2026-10-13",
    teams: [
      team("Ben Johns", "16", "Golden Set"),
      team("Federico Staksrud", "19"),
      team("Anna Leigh Waters", "17"),
      team("Christian Alshon", "18"),
    ],
    matchups: [
      { red: 0, blue: 1 },
      { red: 2, blue: 3 },
    ],
  };
}

function problemsOf(setup: TeamEventSetup): string[] {
  const result = validateSetup(setup);
  return result.ok ? [] : result.problems;
}

test("a four-Team night with every Team in one Matchup is valid", () => {
  assert.deepEqual(validateSetup(fourTeamNight()), { ok: true });
});

test("an odd number of Teams is refused", () => {
  const setup = fourTeamNight();
  setup.teams.push(team("Hayden Patriquin", "20"));

  assert.ok(problemsOf(setup).includes("A Team Event needs an even number of Teams."));
});

test("a Team in two Matchups is refused", () => {
  const setup = fourTeamNight();
  setup.matchups = [
    { red: 0, blue: 1 },
    { red: 1, blue: 3 },
  ];

  assert.ok(problemsOf(setup).includes("Team Federico Staksrud is in more than one Matchup."));
});

test("fewer than four Teams is refused", () => {
  const setup = fourTeamNight();
  setup.teams = setup.teams.slice(0, 2);
  setup.matchups = [{ red: 0, blue: 1 }];

  assert.ok(problemsOf(setup).includes("A Team Event needs at least 4 Teams."));
});

test("more than fourteen Teams is refused, since Flights stop at G", () => {
  const setup = fourTeamNight();
  setup.teams = Array.from({ length: 16 }, (_, index) => team(`Captain ${index + 1}`, String(index + 1)));
  setup.matchups = Array.from({ length: 8 }, (_, index) => ({ red: index * 2, blue: index * 2 + 1 }));

  assert.ok(problemsOf(setup).includes("Team Tally runs up to 14 Teams."));
});

test("a Team in no Matchup is refused", () => {
  const setup = fourTeamNight();
  setup.matchups = [{ red: 0, blue: 1 }];

  const problems = problemsOf(setup);
  assert.ok(problems.includes("Team Anna Leigh Waters isn't in a Matchup."));
  assert.ok(problems.includes("Team Christian Alshon isn't in a Matchup."));
});

test("a Matchup's two Teams need different home courts, which are its court pair", () => {
  const setup = fourTeamNight();
  setup.teams[1].homeCourt = "16";

  assert.ok(
    problemsOf(setup).includes(
      "Team Ben Johns and Team Federico Staksrud both meet on court 16. A Matchup plays on its two Teams' home courts.",
    ),
  );
});

test("two Matchups can't share a court", () => {
  const setup = fourTeamNight();
  setup.teams[2].homeCourt = "19";

  assert.ok(problemsOf(setup).includes("Court 19 is the home court of more than one Team."));
});

test("a Team needs a captain, three players and a home court", () => {
  const setup = fourTeamNight();
  setup.teams[3] = { ...setup.teams[3], slotB: "  ", homeCourt: "" };
  setup.teams[2] = { ...setup.teams[2], captain: "" };

  const problems = problemsOf(setup);
  assert.ok(problems.includes("Team Christian Alshon needs a name for Player B."));
  assert.ok(problems.includes("Team Christian Alshon needs a home court."));
  assert.ok(problems.includes("Team 3 needs a captain."));
});

test("the Team Event needs a name and a date", () => {
  const setup = { ...fourTeamNight(), name: " ", date: "" };

  const problems = problemsOf(setup);
  assert.ok(problems.includes("Give the Team Event a name."));
  assert.ok(problems.includes("Pick the date of the Team Event."));
});

test("courts are compared trimmed", () => {
  const setup = fourTeamNight();
  setup.teams[2].homeCourt = " 19 ";

  assert.ok(problemsOf(setup).includes("Court 19 is the home court of more than one Team."));
});

test("the form's posted setup parses back into a setup", () => {
  const setup = fourTeamNight();
  setup.teams[0].id = "5f0c2b1e-0000-4000-8000-000000000001";

  assert.deepEqual(parseSetup(JSON.stringify(setup)), setup);
});

test("a posted setup that isn't one is refused, not half-read", () => {
  assert.equal(parseSetup("not json"), null);
  assert.equal(parseSetup(JSON.stringify({ name: "x", date: "2026-10-13", teams: "nope", matchups: [] })), null);
  assert.equal(parseSetup(JSON.stringify({ ...fourTeamNight(), matchups: [{ red: "0", blue: 1 }] })), null);
  assert.equal(parseSetup(JSON.stringify({ ...fourTeamNight(), teams: [{ captain: 7 }] })), null);
});

test("a Matchup naming a Team that isn't there is refused", () => {
  const setup = fourTeamNight();
  setup.matchups[1] = { red: 2, blue: 7 };

  assert.equal(validateSetup(setup).ok, false);
});

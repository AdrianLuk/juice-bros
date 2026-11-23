import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { averageRating, canSave, captainOf, formatAverage, parseRoster, readPlayer, readRating, readTeamName } from "./roster.ts";
import { SHEET_CAPTAINS, SHEET_PASTE } from "./roster-sheet.ts";

describe("the real sheet", () => {
  const parsed = parseRoster(SHEET_PASTE);

  it("reads 24 players into 4 Teams of 6, header skipped, nothing flagged", () => {
    assert.deepEqual(parsed.rowProblems, []);
    assert.deepEqual(parsed.teamProblems, []);
    assert.equal(parsed.teams.length, 4);
    assert.deepEqual(parsed.teams.map((team) => team.players.length), [6, 6, 6, 6]);
    assert.ok(canSave(parsed));
  });

  it("finds each Captain by the Team's name", () => {
    assert.deepEqual(parsed.teams.map((team) => captainOf(team)?.name), SHEET_CAPTAINS);
  });

  it("keeps Ed Ju's blank DUAR and DUSR and averages only what is filled in", () => {
    const ed = parsed.teams[0].players.find((player) => player.name === "Ed Ju")!;
    assert.deepEqual([ed.dupr, ed.duar, ed.dusr], [4.258, null, null]);
    assert.equal(averageRating(ed), 4.258);
    assert.equal(formatAverage(ed), "4.258");
  });

  it("shows no average for the Wildcard, whatever the sheet's own column says", () => {
    const wildcard = parsed.teams[0].players.find((player) => player.name === "Wildcard (Kevin Ah-Chuen)")!;
    assert.deepEqual([wildcard.dupr, wildcard.duar, wildcard.dusr], [null, null, null]);
    assert.equal(averageRating(wildcard), null);
    assert.equal(formatAverage(wildcard), "–");
  });

  it("ignores the sheet's average, so Riley Newman is not 1.167", () => {
    const shaun = parsed.teams[2].players.find((player) => player.name === "Riley Newman")!;
    assert.equal(formatAverage(shaun), "2.425");
  });
});

describe("averageRating", () => {
  it("rounds the mean to 3 decimals", () => {
    assert.equal(averageRating({ dupr: 4.5, duar: 3.5, dusr: 3.5 }), 3.833);
  });
});

describe("ratings", () => {
  it("treats blanks and dashes as no rating", () => {
    for (const cell of ["", "  ", "-", "–"]) assert.deepEqual(readRating(cell, "dupr"), { value: null });
  });

  it("keeps DUPR to 3 decimals and DUAR/DUSR to 1", () => {
    assert.deepEqual(readRating("4.2589", "dupr"), { value: 4.259 });
    assert.deepEqual(readRating("3.54", "duar"), { value: 3.5 });
  });

  it("flags DUAR and DUSR outside 1.0 to 7.0, and non-numbers", () => {
    assert.ok("problem" in readRating("7.1", "duar"));
    assert.ok("problem" in readRating("0.5", "dusr"));
    assert.ok("problem" in readRating("abc", "dupr"));
    assert.deepEqual(readRating("7.0", "dusr"), { value: 7 });
    assert.deepEqual(readRating("1.0", "duar"), { value: 1 });
  });
});

describe("readPlayer", () => {
  const ok = { name: " Ed Ju ", gender: "M", dupr: "4.258", duar: "", dusr: "" };

  it("trims the name and keeps blanks blank", () => {
    assert.deepEqual(readPlayer(ok), { player: { name: "Ed Ju", gender: "M", dupr: 4.258, duar: null, dusr: null } });
  });

  it("refuses a missing name, gender or a bad rating", () => {
    assert.ok("problem" in readPlayer({ ...ok, name: " " }));
    assert.ok("problem" in readPlayer({ ...ok, gender: "" }));
    assert.ok("problem" in readPlayer({ ...ok, duar: "7.5" }));
  });
});

describe("flags", () => {
  const row = (name: string, team: string, rest = "M\t4.000\t4.0\t4.0\t4.0") => `${name}\t${rest}\t${team}`;
  const four = ["A", "B", "C", "D"].map((team) => row(team, team));

  it("flags a row that does not parse and blocks saving", () => {
    const parsed = parseRoster([...four, "just some words"].join("\n"));
    assert.equal(parsed.rowProblems.length, 1);
    assert.match(parsed.rowProblems[0].message, /Row 5/);
    assert.equal(canSave(parsed), false);
  });

  it("flags an out-of-range rating on its row", () => {
    const parsed = parseRoster(row("A", "A", "M\t4.000\t8.0\t4.0\t4.0"));
    assert.match(parsed.rowProblems[0].message, /DUAR 8.0 is outside 1.0 to 7.0/);
  });

  it("flags a Team count other than 4", () => {
    const parsed = parseRoster(four.slice(0, 2).join("\n"));
    assert.match(parsed.teamProblems[0].message, /Found 2 Teams/);
    assert.equal(canSave(parsed), false);
  });

  it("flags a Team with no Captain but still saves", () => {
    const parsed = parseRoster([...four.slice(0, 3), row("Dee", "D")].join("\n"));
    assert.match(parsed.teamProblems[0].message, /D has no Captain/);
    assert.ok(canSave(parsed));
  });

  it("finds a Captain marked (C) when the Team has its own name", () => {
    const named = ["Critical Dink Unit", "B", "C", "D"].map((team) => row(team === "B" ? "Bea (C)" : "Al (c)", team));
    const parsed = parseRoster(named.join("\n"));
    assert.deepEqual(parsed.teamProblems, []);
    assert.deepEqual(parsed.teams.map((team) => captainOf(team)?.name), ["Al (c)", "Bea (C)", "Al (c)", "Al (c)"]);
  });

  it("prefers the (C) mark over a name that matches the Team", () => {
    const team = { name: "A", players: [{ name: "A" }, { name: "Bea (C)" }] };
    assert.equal(captainOf(team)?.name, "Bea (C)");
  });

  it("does not read a bracketed nickname as a Captain mark", () => {
    assert.equal(captainOf({ name: "T", players: [{ name: "Wildcard (Kevin Ah-Chuen)" }, { name: "Cam (Cee)" }] }), undefined);
  });

  it("reads a Team rename: trimmed, not blank, 60 characters at most", () => {
    assert.deepEqual(readTeamName("  Critical Dink Unit "), { name: "Critical Dink Unit" });
    assert.ok("problem" in readTeamName("   "));
    assert.ok("problem" in readTeamName("x".repeat(61)));
    assert.deepEqual(readTeamName("x".repeat(60)), { name: "x".repeat(60) });
  });

  it("copes with Windows line endings and blank lines", () => {
    const parsed = parseRoster(SHEET_PASTE.replaceAll("\n", "\r\n") + "\r\n\r\n");
    assert.equal(parsed.teams.length, 4);
    assert.deepEqual(parsed.rowProblems, []);
  });
});

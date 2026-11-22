import assert from "node:assert/strict";
import test from "node:test";

import { eventProblem, formatDddDate, MAX_PUNISHMENT, punishmentsProblem, type DddSetup } from "./events.ts";

const november: DddSetup = {
  name: "DDD November",
  date: "2026-11-28",
  playVenue: "Rec Hall",
  dineVenue: "Noodle Bar",
  courts: ["16", "17", "18", "19"],
};

test("a DDD with a name, a date, both venues and its courts can save", () => {
  assert.equal(eventProblem(november), null);
});

test("each missing piece is named in the Organizer's words", () => {
  assert.equal(eventProblem({ ...november, name: "  " }), "Give the DDD a name.");
  assert.equal(eventProblem({ ...november, date: "" }), "Pick the date.");
  assert.equal(eventProblem({ ...november, date: "2026-02-30" }), "Pick the date.");
  assert.equal(eventProblem({ ...november, playVenue: "" }), "Pick the play venue.");
  assert.equal(eventProblem({ ...november, courts: [] }), "Tap the courts you booked.");
  assert.equal(eventProblem({ ...november, dineVenue: " " }), "Name the dine & drink venue.");
});

test("lengths match what the database keeps", () => {
  assert.equal(eventProblem({ ...november, name: "x".repeat(81) }), "Keep the name to 80 characters.");
  assert.equal(eventProblem({ ...november, dineVenue: "x".repeat(61) }), "Keep the dine & drink venue to 60 characters.");
  assert.equal(eventProblem({ ...november, courts: Array.from({ length: 21 }, (_, i) => String(i + 1)) }), "Book 20 courts at most.");
});

test("the date reads the way the group chat writes it", () => {
  assert.equal(formatDddDate("2026-11-28"), "Sat Nov 28, 2026");
});

test("four short Punishments save, free text and all", () => {
  assert.equal(punishmentsProblem(["1 bottle", "2 bottles", "3 bottles", "2 bottles + 3 shots"]), null);
});

test("a blank, a too-long or a missing Punishment is named", () => {
  assert.equal(punishmentsProblem(["1 bottle", " ", "3 bottles", "4 bottles"]), "Give 2nd place a Punishment.");
  assert.equal(
    punishmentsProblem(["1 bottle", "2 bottles", "3 bottles", "x".repeat(MAX_PUNISHMENT + 1)]),
    `Keep 4th place's Punishment to ${MAX_PUNISHMENT} characters.`,
  );
  assert.equal(punishmentsProblem(["1 bottle", "2 bottles", "3 bottles"]), "One Punishment for each of the 4 places.");
});

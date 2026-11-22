import assert from "node:assert/strict";
import test from "node:test";

import { eventProblem, formatDddDate, mapLink, MAX_PUNISHMENT, punishmentsProblem, type DddSetup } from "./events.ts";

const november: DddSetup = {
  name: "DDD November",
  date: "2026-11-28",
  playVenue: "Rec Hall",
  playVenueMap: "",
  dineVenue: "Noodle Bar",
  dineVenueMap: "",
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
  assert.equal(eventProblem({ ...november, dineVenue: " " }), "Name the dine & drink venue or paste its map link.");
});

test("lengths match what the database keeps", () => {
  assert.equal(eventProblem({ ...november, name: "x".repeat(81) }), "Keep the name to 80 characters.");
  assert.equal(eventProblem({ ...november, dineVenue: "x".repeat(61) }), "Keep the dine & drink venue to 60 characters.");
  assert.equal(eventProblem({ ...november, courts: Array.from({ length: 21 }, (_, i) => String(i + 1)) }), "Book 20 courts at most.");
});

test("a map link saves as pasted, with https:// added when it has none", () => {
  assert.equal(mapLink(" https://maps.app.goo.gl/abc123 "), "https://maps.app.goo.gl/abc123");
  assert.equal(mapLink("maps.app.goo.gl/abc123"), "https://maps.app.goo.gl/abc123");
  assert.equal(mapLink("http://maps.google.com/?q=Rec+Hall"), "http://maps.google.com/?q=Rec+Hall");
  assert.equal(mapLink("  "), "");
});

test("anything that isn't a web link is refused", () => {
  assert.equal(mapLink("javascript:alert(1)"), null);
  assert.equal(mapLink("mailto:someone@example.com"), null);
  assert.equal(mapLink("Rec Hall"), null);
  assert.equal(mapLink("https://"), null);
});

test("the dine & drink venue can be just a map link, and either venue can carry one", () => {
  const link = "https://maps.app.goo.gl/abc123";
  assert.equal(eventProblem({ ...november, dineVenue: "", dineVenueMap: link }), null);
  assert.equal(eventProblem({ ...november, playVenueMap: link, dineVenueMap: link }), null);
  assert.equal(
    eventProblem({ ...november, playVenueMap: "Rec Hall" }),
    "The play venue's map link isn't a web link. Copy it from Share in Google Maps.",
  );
  assert.equal(
    eventProblem({ ...november, dineVenueMap: "javascript:alert(1)" }),
    "The dine & drink venue's map link isn't a web link. Copy it from Share in Google Maps.",
  );
  assert.equal(
    eventProblem({ ...november, dineVenueMap: `https://maps.google.com/?q=${"x".repeat(500)}` }),
    "Shorten the dine & drink venue's map link to 500 characters.",
  );
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

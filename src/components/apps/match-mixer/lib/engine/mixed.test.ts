import assert from "node:assert/strict";
import test from "node:test";

import {
  countMarkers,
  describeMarkers,
  markersOf,
  maxMixedCourts,
  mixedCourtDefault,
  mixedObjection,
  partnershipSupply,
  resolveMixed,
  rosterLine,
  splitMarker,
} from "./mixed.ts";
import { parseRoster } from "./roster.ts";

test("a trailing M or F is a marker, and is not part of the name", () => {
  assert.deepEqual(splitMarker("Sam M"), { name: "Sam", marker: "M" });
  assert.deepEqual(splitMarker("Anna Leigh Waters F"), {
    name: "Anna Leigh Waters",
    marker: "F",
  });
});

test("case is not the organizer's problem", () => {
  assert.deepEqual(splitMarker("sam m"), { name: "sam", marker: "M" });
  assert.deepEqual(splitMarker("Anna f"), { name: "Anna", marker: "F" });
});

test("a line with no trailing marker keeps the whole line as the name", () => {
  assert.deepEqual(splitMarker("Ben Johns"), { name: "Ben Johns" });
  // A middle initial is not a marker: the token has to be the last one.
  assert.deepEqual(splitMarker("Anna F Waters"), { name: "Anna F Waters" });
  // Nor is a letter stuck to the name.
  assert.deepEqual(splitMarker("SamM"), { name: "SamM" });
});

test("a line that is only a marker is a name, because it has no name to attach it to", () => {
  assert.deepEqual(splitMarker("M"), { name: "M" });
  assert.deepEqual(splitMarker("F"), { name: "F" });
});

test("a Player goes back to the line that was typed", () => {
  assert.equal(rosterLine({ name: "Sam", marker: "M" }), "Sam M");
  assert.equal(rosterLine({ name: "Ben Johns" }), "Ben Johns");
});

test("the round trip through the roster box is the identity", () => {
  const typed = "Sam M\nAnna Leigh Waters F\nBen Johns";
  assert.equal(parseRoster(typed).map(rosterLine).join("\n"), typed);
});

test("counting says how the list divides and how much of it has not said", () => {
  const roster = parseRoster("Sam M\nAnna F\nBen M\nJorja", [], true);
  assert.deepEqual(countMarkers(roster), { M: 2, F: 1, unmarked: 1 });
  assert.equal(describeMarkers(countMarkers(roster)), "2 M, 1 F");
});

test("markersOf is the whole list or nothing at all", () => {
  assert.deepEqual(markersOf(parseRoster("Sam M\nAnna F", [], true)), ["M", "F"]);
  assert.equal(markersOf(parseRoster("Sam M\nAnna", [], true)), null);
});

test("mixed doubles is a qualifier on rotating and means nothing elsewhere", () => {
  assert.equal(resolveMixed("rotating", true), true);
  assert.equal(resolveMixed("rotating", undefined), false);
  assert.equal(resolveMixed("fixed", true), false);
});

test("the partnership supply is M x F while the constraint is on", () => {
  const roster = parseRoster("Sam M\nAnna F\nBen M\nJorja F\nJW M\nCat F", [], true);
  assert.equal(partnershipSupply(roster, true), 9);
  // Off, it is the whole triangle, which is what `naturalLength` works out
  // for itself when nothing overrides it.
  assert.equal(partnershipSupply(roster, false), undefined);
});

function rosterOf(m: number, f: number) {
  return parseRoster(
    [
      ...Array.from({ length: m }, (_, i) => `M${i + 1} M`),
      ...Array.from({ length: f }, (_, i) => `F${i + 1} F`),
    ].join("\n"),
    [],
    true,
  );
}

test("no objection while the constraint is off, whatever the list looks like", () => {
  assert.equal(mixedObjection(parseRoster("a\nb\nc\nd"), 1, false), null);
});

test("a fully marked list that fills the courts draws", () => {
  assert.equal(mixedObjection(rosterOf(4, 4), 2, true), null);
});

test("an unmarked line refuses, and the message says how many are missing one", () => {
  const roster = parseRoster("Sam M\nAnna F\nBen\nJorja", [], true);
  const objection = mixedObjection(roster, 1, true);
  assert.ok(objection);
  assert.match(objection, /2 lines are missing one/);
});

test("one unmarked line reads as one line, not as '1 lines'", () => {
  const objection = mixedObjection(parseRoster("Sam M\nAnna F\nBen M\nJorja", [], true), 1, true);
  assert.ok(objection);
  assert.match(objection, /1 line is missing one/);
});

test("counts that cannot fill the courts refuse, naming the shortfall and both ways out", () => {
  // Ten M and four F on three courts: a Round seats six of each, so six M sit
  // out every single Round and the Bye rotation is broken before the search
  // starts.
  const objection = mixedObjection(rosterOf(10, 4), 3, true);
  assert.ok(objection);
  assert.match(objection, /seats 6 M and 6 F every round/);
  assert.match(objection, /the list has 4 F/);
  // Fewer courts...
  assert.match(objection, /Drop to 2 courts/);
  // ...or more of the short side.
  assert.match(objection, /add 2 more F/);
});

test("the short side can be either one", () => {
  const objection = mixedObjection(rosterOf(2, 10), 2, true);
  assert.ok(objection);
  assert.match(objection, /the list has 2 M/);
  assert.match(objection, /Drop to 1 court/);
});

test("below two of a side there is no court count that works, so none is offered", () => {
  const objection = mixedObjection(rosterOf(7, 1), 1, true);
  assert.ok(objection);
  assert.doesNotMatch(objection, /Drop to/);
  assert.match(objection, /Add 1 more F\./);
});

test("the court ceiling is the short side, two to a court", () => {
  assert.equal(maxMixedCourts({ M: 10, F: 4, unmarked: 0 }), 2);
  assert.equal(maxMixedCourts({ M: 6, F: 6, unmarked: 0 }), 3);
  assert.equal(maxMixedCourts({ M: 7, F: 1, unmarked: 0 }), 0);
});

test("a roster part-way through being marked has no supply figure, not a supply of nothing", () => {
  // `0` is not absence: `naturalLength` reads `partnerships ?? triangle`, so a
  // zero would floor the rotation at one round and the Rounds dial would drop
  // to 1 and climb back on its own as the last marker landed.
  assert.equal(partnershipSupply(parseRoster("Sam M\nAnna\nBen\nJo", [], true), true), undefined);
  assert.equal(partnershipSupply(parseRoster("Sam M\nAnna F\nBen M\nJo F", [], true), true), 4);
});

test("the court default follows the markers, so ticking the box does not block the button", () => {
  // Ten M and six F: the roster fills four courts, mixed doubles fills three.
  // Offering four before anybody has chosen would refuse a drawable roster out
  // of the gate.
  assert.equal(mixedCourtDefault(rosterOf(10, 6), true), 3);
  // Off, and while a line is still bare, the roster size decides as it always has.
  assert.equal(mixedCourtDefault(rosterOf(10, 6), false), undefined);
  assert.equal(mixedCourtDefault(parseRoster("Sam M\nAnna\nBen\nJo", [], true), true), undefined);
  // Below two of a side the answer is the refusal, not a silent zero.
  assert.equal(mixedCourtDefault(rosterOf(7, 1), true), undefined);
});

test("the court default is a default and never a ceiling", () => {
  // The courts are booked. An organizer who has three and types three still
  // gets the arithmetic for why this list cannot fill them, rather than having
  // one quietly taken away.
  const roster = rosterOf(10, 4);
  assert.equal(mixedCourtDefault(roster, true), 2);
  assert.ok(mixedObjection(roster, 3, true));
});

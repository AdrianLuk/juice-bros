import assert from "node:assert/strict";
import test from "node:test";

import {
  duplicateNames,
  parsePoolHeaders,
  parseRoster,
  rosterText,
} from "./roster.ts";

test("one name per line, blank lines and stray whitespace dropped", () => {
  const roster = parseRoster(
    "  Ben Johns \n\n Anna Leigh Waters\n\n  \nCatherine Parenteau\n",
  );
  assert.deepEqual(
    roster.map((player) => player.name),
    ["Ben Johns", "Anna Leigh Waters", "Catherine Parenteau"],
  );
  assert.equal(new Set(roster.map((player) => player.id)).size, 3);
});

test("ids survive an edit that reorders or inserts names", () => {
  const first = parseRoster("Ben Johns\nAnna Leigh Waters");
  const ids = new Map(first.map((player) => [player.name, player.id]));

  const second = parseRoster("Anna Leigh Waters\nJW Johnson\nBen Johns", first);

  assert.equal(second[0].id, ids.get("Anna Leigh Waters"));
  assert.equal(second[2].id, ids.get("Ben Johns"));
  assert.equal(new Set(second.map((player) => player.id)).size, 3);
});

test("two players sharing a name keep two distinct ids", () => {
  const first = parseRoster("Mike\nMike\nBen Johns");
  assert.equal(new Set(first.map((player) => player.id)).size, 3);

  const second = parseRoster("Mike\nMike\nBen Johns", first);
  assert.deepEqual(
    second.map((player) => player.id),
    first.map((player) => player.id),
  );
});

test("a removed name's id is not handed to a later arrival", () => {
  const first = parseRoster("Ben Johns\nAnna Leigh Waters");
  const second = parseRoster("Ben Johns\nJW Johnson", first);

  assert.equal(second[0].id, first[0].id);
  assert.notEqual(second[1].id, first[1].id);
});

test("a roster with no repeated name has no duplicates to report", () => {
  assert.deepEqual(duplicateNames(parseRoster("Ben\nAnna\nJW\nJorja")), []);
});

test("a repeated name is reported once, however many times it appears", () => {
  assert.deepEqual(duplicateNames(parseRoster("Mike\nBen\nMike\nMike")), ["Mike"]);
});

test("several repeated names are reported in the order they first appear", () => {
  const roster = parseRoster("Anna\nMike\nAnna\nBen\nMike");
  assert.deepEqual(duplicateNames(roster), ["Anna", "Mike"]);
});

test("names that differ only in case are two different players", () => {
  // The Roster is a list of names as typed; deciding that "mike" and "Mike"
  // are the same person is the organizer's call, not the tool's.
  assert.deepEqual(duplicateNames(parseRoster("Mike\nmike")), []);
});

test("a trailing M or F is read as a marker and taken off the name", () => {
  const roster = parseRoster("Sam M\nAnna Leigh Waters F\nBen Johns", [], true);
  assert.deepEqual(roster, [
    { id: "p0", name: "Sam", marker: "M" },
    { id: "p1", name: "Anna Leigh Waters", marker: "F" },
    { id: "p2", name: "Ben Johns" },
  ]);
});

test("changing somebody's marker keeps them the same player", () => {
  const first = parseRoster("Sam M\nAnna F", [], true);
  const second = parseRoster("Sam F\nAnna F", first, true);
  assert.deepEqual(
    second.map((player) => player.id),
    first.map((player) => player.id),
  );
  assert.equal(second[0].marker, "F");
});

test("two Sams with different markers are still two Sams", () => {
  const roster = parseRoster("Sam M\nSam F\nBen Johns M", [], true);
  // Distinct entries to the engine...
  assert.equal(new Set(roster.map((player) => player.id)).size, 3);
  // ...and the same name to anyone reading the board, which is what the
  // notice is about: the board prints no markers, so it cannot tell them
  // apart at all.
  assert.deepEqual(duplicateNames(roster), ["Sam"]);
});

test("a last initial is a name, not a marker, until mixed doubles is asked for", () => {
  // The regression this parameter exists for. A club roster that tells two
  // Sarahs apart by last initial types exactly what a marker looks like, and
  // reading one off every line unconditionally deletes the initial — for the
  // two letters only, so `Mike T` would sit intact beside a `Sarah M` that had
  // become a second `Sarah`.
  const roster = parseRoster("Sarah M\nSarah F\nMike T\nBen Johns");
  assert.deepEqual(
    roster.map((player) => player.name),
    ["Sarah M", "Sarah F", "Mike T", "Ben Johns"],
  );
  assert.equal(
    roster.some((player) => player.marker),
    false,
  );
  // And the notice that exists to catch a genuine collision stays quiet on
  // names the organizer has already told apart.
  assert.deepEqual(duplicateNames(roster), []);
});

test("the same lines read as markers once mixed doubles is asked for", () => {
  const roster = parseRoster("Sarah M\nSarah F\nMike T\nBen Johns", [], true);
  assert.deepEqual(
    roster.map((player) => player.name),
    ["Sarah", "Sarah", "Mike T", "Ben Johns"],
  );
  // Now they genuinely are two Sarahs on the printed board, and the notice
  // says so.
  assert.deepEqual(duplicateNames(roster), ["Sarah"]);
});

test("a line beginning --- is a Pool header and never a Player", () => {
  const text = "Ben\nAnna\n--- 4.0\nCath\nDave";
  const roster = parseRoster(text);
  assert.deepEqual(
    roster.map((player) => player.name),
    ["Ben", "Anna", "Cath", "Dave"],
  );
  assert.deepEqual(parsePoolHeaders(text), [{ label: "4.0", start: 2 }]);
});

test("a blank line is still not a divider", () => {
  const text = "Ben\n\nAnna\n\nCath\nDave";
  assert.deepEqual(parsePoolHeaders(text), []);
  assert.deepEqual(
    parseRoster(text).map((player) => player.name),
    ["Ben", "Anna", "Cath", "Dave"],
  );
});

test("a bare header carries no label", () => {
  const text = "Ben\nAnna\n---\nCath\nDave";
  assert.deepEqual(parsePoolHeaders(text), [{ label: null, start: 2 }]);
});

test("a header's label is trimmed and capped at 24 characters", () => {
  const text = "Ben\n---    padded label   \nAnna";
  assert.deepEqual(parsePoolHeaders(text), [{ label: "padded label", start: 1 }]);

  const long = "-".repeat(30);
  const capped = parsePoolHeaders(`Ben\n--- ${long}\nAnna`);
  assert.equal(capped[0].label, long.slice(0, 24));
});

test("headers are read before markers: --- F is a pool, not a player", () => {
  const text = "Sam M\n--- F\nAnna F";
  const roster = parseRoster(text, [], true);
  assert.deepEqual(
    roster.map((player) => player.name),
    ["Sam", "Anna"],
  );
  assert.deepEqual(parsePoolHeaders(text), [{ label: "F", start: 1 }]);
});

test("headers are never counted by the duplicate-names notice", () => {
  // Two headers with nothing before the first one produce an empty Pool, but
  // that is a size question for `pools.ts` — the headers themselves are never
  // Players, so they never turn up as a name typed twice.
  const roster = parseRoster("---\n---\nMike\nMike");
  assert.deepEqual(duplicateNames(roster), ["Mike"]);
});

test("moving a header changes nothing about the Players it sits among", () => {
  const withHeaderLate = parseRoster("Ben\nAnna\n---\nCath\nDave");
  const withHeaderEarly = parseRoster("Ben\n---\nAnna\nCath\nDave");
  assert.deepEqual(
    withHeaderLate.map((p) => p.name),
    withHeaderEarly.map((p) => p.name),
  );
});

test("rosterText is the inverse of parseRoster and parsePoolHeaders", () => {
  const text = "Ben\nAnna\n--- 4.0\nCath M\nDave F";
  const roster = parseRoster(text, [], true);
  const headers = parsePoolHeaders(text);
  assert.equal(rosterText(roster, headers), text);
});

test("rosterText writes a bare header with just the three dashes", () => {
  assert.equal(
    rosterText(parseRoster("Ben\nAnna"), [{ label: null, start: 1 }]),
    "Ben\n---\nAnna",
  );
});

test("rosterText supports a leading header naming Pool A", () => {
  assert.equal(
    rosterText(parseRoster("Ben\nAnna"), [{ label: "A", start: 0 }]),
    "--- A\nBen\nAnna",
  );
});

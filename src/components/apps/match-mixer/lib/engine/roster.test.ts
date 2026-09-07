import assert from "node:assert/strict";
import test from "node:test";

import { duplicateNames, parseRoster } from "./roster.ts";

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

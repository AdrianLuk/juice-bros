import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatRoster, parseRoster } from "./roster.ts";
import type { Entrant } from "./types.ts";

const entrant = (name: string, tickets: number): Entrant => ({
  id: name,
  name,
  tickets,
});

describe("formatRoster", () => {
  it("leaves a single ticket unwritten", () => {
    assert.equal(formatRoster([entrant("Ben Johns", 1)]), "Ben Johns");
  });

  it("writes any other count", () => {
    assert.equal(formatRoster([entrant("Ben Johns", 5)]), "Ben Johns x5");
  });

  it("writes somebody holding none, rather than dropping them", () => {
    assert.equal(formatRoster([entrant("Ben Johns", 0)]), "Ben Johns x0");
  });

  it("is one line each, in roster order", () => {
    const text = formatRoster([
      entrant("Ben Johns", 5),
      entrant("Anna Leigh Waters", 1),
      entrant("Riley Newman", 2),
    ]);

    assert.equal(text, "Ben Johns x5\nAnna Leigh Waters\nRiley Newman x2");
  });

  it("is empty for an empty roster", () => {
    assert.equal(formatRoster([]), "");
  });
});

describe("parseRoster", () => {
  it("reads a plain list as one ticket each", () => {
    assert.deepEqual(parseRoster("Ben Johns\nAnna Leigh Waters"), [
      { name: "Ben Johns", tickets: 1 },
      { name: "Anna Leigh Waters", tickets: 1 },
    ]);
  });

  it("reads a trailing count", () => {
    assert.deepEqual(parseRoster("Ben Johns x5"), [{ name: "Ben Johns", tickets: 5 }]);
  });

  it("reads a count written loosely", () => {
    // What someone typing it by hand in a hurry actually produces.
    assert.deepEqual(parseRoster("Ben Johns X 5"), [{ name: "Ben Johns", tickets: 5 }]);
  });

  it("reads zero as zero", () => {
    assert.deepEqual(parseRoster("Ben Johns x0"), [{ name: "Ben Johns", tickets: 0 }]);
  });

  it("keeps a name that merely contains an x", () => {
    assert.deepEqual(parseRoster("Alex\nMax Factor"), [
      { name: "Alex", tickets: 1 },
      { name: "Max Factor", tickets: 1 },
    ]);
  });

  it("keeps a pair written with an x between the names", () => {
    // "Jess x Sam" has no number after the x, so it is a name, not a count.
    assert.deepEqual(parseRoster("Jess x Sam"), [
      { name: "Jess x Sam", tickets: 1 },
    ]);
  });

  it("takes a bare count as a name, since nobody is holding it", () => {
    assert.deepEqual(parseRoster("x12"), [{ name: "x12", tickets: 1 }]);
  });

  it("skips blank lines and trims the rest", () => {
    assert.deepEqual(parseRoster("  Ben Johns  \n\n\n  Riley Newman x2\n"), [
      { name: "Ben Johns", tickets: 1 },
      { name: "Riley Newman", tickets: 2 },
    ]);
  });

  it("survives carriage returns from a pasted message", () => {
    assert.deepEqual(parseRoster("Ben Johns x3\r\nRiley Newman"), [
      { name: "Ben Johns", tickets: 3 },
      { name: "Riley Newman", tickets: 1 },
    ]);
  });

  it("is empty for empty text", () => {
    assert.deepEqual(parseRoster(""), []);
    assert.deepEqual(parseRoster("   \n  \n"), []);
  });
});

describe("the handover round trip", () => {
  it("returns the same names and counts it was given", () => {
    // The property the whole feature rests on: a roster copied off one phone
    // and pasted into another is the same roster, ticket counts included.
    const roster = [
      entrant("Ben Johns", 5),
      entrant("Anna Leigh Waters", 1),
      entrant("Catherine Parenteau", 2),
      entrant("Alex", 3),
      entrant("Jess x Sam", 1),
      entrant("Tyson McGuffin", 0),
    ];

    assert.deepEqual(
      parseRoster(formatRoster(roster)),
      roster.map(({ name, tickets }) => ({ name, tickets })),
    );
  });
});

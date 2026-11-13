import assert from "node:assert/strict";
import { test } from "node:test";

import { venueProblem } from "./venues.ts";

const TWO_COURTS = { courts: [{ row: 0, col: 0, number: 16 }, { row: 0, col: 1, number: 17 }] };

test("a named Venue with its own number on each court saves", () => {
  assert.equal(venueProblem("  Rec Centre North ", TWO_COURTS), null);
});

test("a Venue needs a name, a court, and no number twice", () => {
  assert.equal(venueProblem("   ", TWO_COURTS), "Give the venue a name.");
  assert.equal(venueProblem("x".repeat(41), TWO_COURTS), "Keep the venue's name to 40 characters.");
  assert.equal(venueProblem("Hall", { courts: [] }), "Draw at least one court.");
  assert.equal(
    venueProblem("Hall", { courts: [{ row: 0, col: 0, number: 5 }, { row: 1, col: 0, number: 5 }] }),
    "Two courts are numbered 5. Give each court its own number.",
  );
});

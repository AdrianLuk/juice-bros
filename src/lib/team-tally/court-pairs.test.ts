import assert from "node:assert/strict";
import { test } from "node:test";

import type { CourtGrid } from "../court-grid/grid.ts";
import { firstOpen, offVenue, placedPairs, tapCourt, type HomeCourts } from "./court-pairs.ts";

/**
 * A 2 x 3 hall numbered 16 to 21:
 *
 *   16 17 18
 *   19 20 21
 *
 * 16 touches 17 and 19; 16 and 20 only meet at a corner.
 */
const HALL: CourtGrid = {
  courts: [16, 17, 18, 19, 20, 21].map((number, index) => ({
    row: Math.floor(index / 3),
    col: index % 3,
    number,
  })),
};

function tap(matchups: HomeCourts[], active: number, court: number) {
  return tapCourt(HALL, placedPairs(HALL, matchups), active, court);
}

const EMPTY: HomeCourts = { red: "", blue: "" };

test("the first tap is the red Team's Home court, and waits for blue", () => {
  assert.deepEqual(tap([EMPTY, EMPTY], 0, 16), {
    writes: [
      { index: 0, side: "red", homeCourt: "16" },
      { index: 0, side: "blue", homeCourt: "" },
    ],
    active: 0,
  });
});

test("a touching second tap is blue's, and the next Matchup without courts becomes active", () => {
  assert.deepEqual(tap([{ red: "16", blue: "" }, { red: "17", blue: "18" }, EMPTY], 0, 19), {
    writes: [{ index: 0, side: "blue", homeCourt: "19" }],
    active: 2,
  });
});

test("the last pair placed leaves its Matchup active", () => {
  assert.deepEqual(tap([{ red: "17", blue: "18" }, { red: "16", blue: "" }], 1, 19).active, 1);
});

test("a second tap that only meets the first at a corner starts the pair again from it", () => {
  assert.deepEqual(tap([{ red: "16", blue: "" }, EMPTY], 0, 20).writes, [
    { index: 0, side: "red", homeCourt: "20" },
    { index: 0, side: "blue", homeCourt: "" },
  ]);
});

test("tapping the red court again takes it back", () => {
  assert.deepEqual(tap([{ red: "16", blue: "" }, EMPTY], 0, 16).writes, [{ index: 0, side: "red", homeCourt: "" }]);
});

test("a court another Matchup holds jumps to that Matchup and changes nothing", () => {
  assert.deepEqual(tap([EMPTY, { red: "17", blue: "18" }], 0, 18), { writes: [], active: 1 });
});

test("a court of the active Matchup's placed pair starts it again from that court", () => {
  assert.deepEqual(tap([{ red: "16", blue: "19" }, EMPTY], 0, 19).writes, [
    { index: 0, side: "red", homeCourt: "19" },
    { index: 0, side: "blue", homeCourt: "" },
  ]);
});

test("a Home court the Venue has no court for reads as unplaced and is flagged", () => {
  assert.deepEqual(placedPairs(HALL, [{ red: " 17 ", blue: "Court 9" }]), [{ red: 17, blue: null }]);
  assert.equal(offVenue(HALL, "Court 9"), true);
  assert.equal(offVenue(HALL, "9"), true);
  assert.equal(offVenue(HALL, "17"), false);
  assert.equal(offVenue(HALL, "  "), false, "an empty box is unfilled, not off the Venue");
});

test("setup starts on the first Matchup without both courts", () => {
  const pairs = placedPairs(HALL, [{ red: "16", blue: "19" }, { red: "17", blue: "" }]);
  assert.equal(firstOpen(pairs), 1);
  assert.equal(firstOpen(placedPairs(HALL, [{ red: "16", blue: "19" }])), 0);
});

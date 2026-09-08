import assert from "node:assert/strict";
import test from "node:test";

import { describeUpdateChanges } from "./update-diff.ts";

/** The Booking from the report that opened #458: noon Singles on Court #7, nobody logged. */
const LOGGED = {
  startTime: "12:00",
  endTime: "14:00",
  courtLabel: "#7",
  format: "singles" as const,
  players: [],
};

test("a moved time, a new format and a fresh player list each get their own row", () => {
  const changes = describeUpdateChanges(LOGGED, {
    startTime: "13:00",
    endTime: "15:00",
    courtLabel: "#7",
    format: "doubles",
    players: ["Cecilia Mui", "Adrian Luk"],
  });

  assert.deepEqual(changes, [
    { label: "Time", before: "12:00 PM–2:00 PM", after: "1:00 PM–3:00 PM" },
    { label: "Format", before: "Singles", after: "Doubles" },
    { label: "Players", before: "Nobody logged", after: "Cecilia Mui, Adrian Luk" },
  ]);
});

test("an email describing the Booking exactly as it stands changes nothing", () => {
  assert.deepEqual(describeUpdateChanges(LOGGED, LOGGED), []);
});

test("a court moved off, or onto, no court at all reads either way", () => {
  const [moved] = describeUpdateChanges(LOGGED, { ...LOGGED, courtLabel: "#9 - Hard" });
  assert.deepEqual(moved, { label: "Court", before: "Court #7", after: "Court #9 - Hard" });

  const [cleared] = describeUpdateChanges(LOGGED, { ...LOGGED, courtLabel: null });
  assert.deepEqual(cleared, { label: "Court", before: "Court #7", after: "No court noted" });
});

test("an update listing no Player(s) at all is the facility saying nothing, not 'nobody'", () => {
  const withPlayers = { ...LOGGED, players: ["Amy Ace", "Ben Backhand"] };
  assert.deepEqual(describeUpdateChanges(withPlayers, { ...withPlayers, players: [] }), []);
});

test("the same names in a different order isn't a change worth a row", () => {
  const before = { ...LOGGED, players: ["Amy Ace", "Ben Backhand"] };
  const after = { ...LOGGED, players: ["Amy Ace", "Ben Backhand"] };
  assert.deepEqual(describeUpdateChanges(before, after), []);
});

test("a Booking that runs past midnight reads its End on the same clock, not as a negative range", () => {
  const lateNight = { ...LOGGED, startTime: "22:00", endTime: "01:00" };
  const [moved] = describeUpdateChanges(lateNight, { ...lateNight, startTime: "21:00" });
  assert.deepEqual(moved, { label: "Time", before: "10:00 PM–1:00 AM", after: "9:00 PM–1:00 AM" });
});

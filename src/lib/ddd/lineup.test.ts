import assert from "node:assert/strict";
import { test } from "node:test";

import { hasWarnings, LINEUP_GAMES, lineupWarnings, readLineup, readLineupFields, type Lineup } from "./lineup.ts";

const p = (id: string, gender: "M" | "F") => ({ id, name: id.toUpperCase(), gender });

const even = [p("m1", "M"), p("m2", "M"), p("m3", "M"), p("w1", "F"), p("w2", "F"), p("w3", "F")];
// An uneven Team: 4 men, 2 women.
const uneven = [p("m1", "M"), p("m2", "M"), p("m3", "M"), p("m4", "M"), p("w1", "F"), p("w2", "F")];

const none: Lineup = { mens: [null, null], womens: [null, null], mixed1: [null, null], mixed2: [null, null] };
const good: Lineup = { mens: ["m1", "m2"], womens: ["w1", "w2"], mixed1: ["m3", "w1"], mixed2: ["m4", "w2"] };

test("an uneven Team, 2 women and 4 men, with both women playing twice, has no warning", () => {
  const warnings = lineupWarnings(uneven, good);
  assert.equal(hasWarnings(warnings), false);
  assert.deepEqual(warnings.team, []);
  for (const game of LINEUP_GAMES) assert.deepEqual(warnings.pairs[game], []);
});

test("a player in 3 Games is warned beside each Pair they are in, and in none of the others", () => {
  const three: Lineup = { mens: ["m1", "m2"], womens: ["w1", "w2"], mixed1: ["m1", "w1"], mixed2: ["m1", "w2"] };
  const w = lineupWarnings(uneven, three);
  for (const game of ["mens", "mixed1", "mixed2"] as const) assert.deepEqual(w.pairs[game], ["M1 plays 3 Games. Two is the most."]);
  assert.deepEqual(w.pairs.womens, []);
});

test("a player in no Game is a Team warning, and an empty Lineup warns for everyone", () => {
  assert.deepEqual(lineupWarnings(uneven, { ...good, mixed1: ["m1", "w1"] }).team, ["M3 is in no Game."]);
  assert.equal(lineupWarnings(even, none).team.length, 6);
});

test("wrong gender is warned in the Game it is about", () => {
  const w = lineupWarnings(even, { mens: ["m1", "w3"], womens: ["w1", "w2"], mixed1: ["m2", "m3"], mixed2: ["m2", "w3"] });
  assert.deepEqual(w.pairs.mens, ["W3 is a woman. Men's doubles takes two men."]);
  assert.deepEqual(w.pairs.mixed1, ["Mixed 1 takes one man and one woman."]);
  assert.deepEqual(w.pairs.womens, []);
});

test("the same player twice in one Pair is warned once and counts as one Game", () => {
  const w = lineupWarnings(even, { mens: ["m1", "m1"], womens: ["w1", "w2"], mixed1: ["m2", "w3"], mixed2: ["m3", "w1"] });
  assert.deepEqual(w.pairs.mens, ["M1 is in this Pair twice."]);
});

test("a half-filled Pair is not a gender warning", () => {
  const w = lineupWarnings(even, { mens: ["m1", null], womens: none.womens, mixed1: ["m2", null], mixed2: [null, "w1"] });
  assert.deepEqual(w.pairs.mens, []);
  assert.deepEqual(w.pairs.mixed1, []);
});

test("readLineup: null when nothing is saved; a player who left the Team reads as an empty slot", () => {
  assert.equal(readLineup(even, null), null);
  assert.equal(readLineup(even, {}), null);
  const read = readLineup(even, { mens: ["m1", "gone"], womens: ["w1", "w2"] });
  assert.deepEqual(read?.mens, ["m1", null]);
  assert.deepEqual(read?.mixed1, [null, null]);
});

test("readLineupFields maps blanks to empty slots and refuses an id off the Team", () => {
  const fields: Record<string, string> = { "mens-1": "m1", "mens-2": "m2", "womens-1": "w1", "womens-2": "" };
  const read = readLineupFields(even, (field) => fields[field] ?? "");
  assert.ok("lineup" in read);
  assert.deepEqual(read.lineup.womens, ["w1", null]);
  assert.ok("problem" in readLineupFields(even, (field) => (field === "mens-1" ? "someone-else" : "")));
});

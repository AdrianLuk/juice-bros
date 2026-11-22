import assert from "node:assert/strict";
import { test } from "node:test";

import type { Lineup } from "./lineup.ts";
import { lineupsOf, needsRecheck, pairName, pairings, pairSig, readSpreadFields, readSpreadPoints } from "./spreads.ts";

const p = (id: string, gender: "M" | "F") => ({ id, name: id.toUpperCase(), gender });
const players = [p("m1", "M"), p("m2", "M"), p("w1", "F"), p("w2", "F")];
const lineup: Lineup = { mens: ["m1", "m2"], womens: ["w1", "w2"], mixed1: ["m1", "w1"], mixed2: ["m2", "w2"] };

test("4 Teams make 6 pairings, each Team against each other once, in Team order", () => {
  const teams = ["A", "B", "C", "D"];
  assert.deepEqual(pairings(teams).map(([x, y]) => x + y), ["AB", "AC", "AD", "BC", "BD", "CD"]);
});

test("every cell names the right Pairs", () => {
  assert.equal(pairName(players, lineup, "mens"), "M1 / M2");
  assert.equal(pairName(players, lineup, "mixed2"), "M2 / W2");
  assert.equal(pairName(players, { ...lineup, mixed2: ["m2", null] }, "mixed2"), "M2 / –");
});

test("a Spread must end in .5 and sit between 0.5 and 10.5", () => {
  assert.deepEqual(readSpreadPoints("5.5"), { value: 5.5 });
  assert.deepEqual(readSpreadPoints(" 0.5 "), { value: 0.5 });
  assert.deepEqual(readSpreadPoints("10.5"), { value: 10.5 });
  assert.deepEqual(readSpreadPoints(""), { value: null });
  for (const bad of ["5", "5.25", "5.0", "abc", "-5.5"]) assert.ok("problem" in readSpreadPoints(bad), bad);
  assert.match((readSpreadPoints("11.5") as { problem: string }).problem, /0\.5 to 10\.5/);
  assert.ok("problem" in readSpreadPoints("0"));
  assert.match((readSpreadPoints("5") as { problem: string }).problem, /ends in \.5/);
});

test("a pairing's form: blank cells clear, half-filled cells and bad points refuse the whole save", () => {
  const form = (fields: Record<string, string>) => (field: string) => fields[field] ?? "";
  const ok = readSpreadFields(form({ "mens-lower": "a", "mens-points": "5.5", "womens-lower": "b", "womens-points": "3.5" }));
  assert.ok("entries" in ok);
  assert.deepEqual(ok.entries.map((e) => e.set), [{ lower: "a", points: 5.5 }, { lower: "b", points: 3.5 }, null, null]);
  assert.ok("problem" in readSpreadFields(form({ "mens-lower": "a" })));
  assert.ok("problem" in readSpreadFields(form({ "mens-points": "5.5" })));
  assert.match((readSpreadFields(form({ "mixed1-lower": "a", "mixed1-points": "5" })) as { problem: string }).problem, /^Mixed 1:/);
  assert.ok("problem" in readSpreadFields(form({ "mens-lower": "c", "mens-points": "5.5" })));
});

test("a Lineup change flags the Spread for a re-check; an unrelated change does not", () => {
  const other: Lineup = { mens: ["m1", "m2"], womens: ["w1", "w2"], mixed1: ["m2", "w1"], mixed2: ["m1", "w2"] };
  const row = { teamA: "a", teamB: "b", game: "mens" as const, lower: "a" as const, points: 5.5, sig: pairSig(lineup, other, "mens") };
  assert.equal(needsRecheck(row, [lineup, other]), false);
  // The same Pair in the other order is the same Pair.
  assert.equal(needsRecheck(row, [{ ...lineup, mens: ["m2", "m1"] }, other]), false);
  assert.equal(needsRecheck(row, [{ ...lineup, mens: ["m1", "w1"] }, other]), true);
  assert.equal(needsRecheck(row, [lineup, { ...other, mens: ["m1", null] }]), true);
  // Another Game's change is not this Spread's business.
  assert.equal(needsRecheck(row, [{ ...lineup, mixed1: ["m2", "w2"] }, other]), false);
});

test("lineupsOf is null until both Teams have a Lineup", () => {
  const a = { id: "ta", players };
  const b = { id: "tb", players };
  assert.equal(lineupsOf(a, b, { ta: { mens: ["m1", "m2"] } }), null);
  assert.ok(lineupsOf(a, b, { ta: { mens: ["m1", "m2"] }, tb: { mens: ["m1", "m2"] } }));
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pickWinner, reelNames } from "./draw.ts";
import type { Entrant } from "./types.ts";

const entrant = (id: string, tickets: number): Entrant => ({
  id,
  name: id.toUpperCase(),
  tickets,
});

describe("pickWinner", () => {
  it("returns the same name for the same bucket and seed", () => {
    const pool = [entrant("a", 1), entrant("b", 1), entrant("c", 1)];

    for (const seed of [1, 7, 4242, 0xfffffff]) {
      assert.equal(pickWinner(pool, seed)?.id, pickWinner(pool, seed)?.id);
    }
  });

  it("is a pure function of the pool, so a draw can be recomputed later", () => {
    const pool = [entrant("a", 3), entrant("b", 5)];
    const once = pickWinner(pool, 99);
    const again = pickWinner([entrant("a", 3), entrant("b", 5)], 99);

    assert.equal(once?.id, again?.id);
  });

  it("leaves out anyone holding no tickets", () => {
    const pool = [entrant("in", 4), entrant("out", 0)];

    for (let seed = 0; seed < 200; seed++) {
      assert.equal(pickWinner(pool, seed)?.id, "in");
    }
  });

  it("returns nothing when the bucket is empty", () => {
    assert.equal(pickWinner([], 1), null);
    assert.equal(pickWinner([entrant("a", 0)], 1), null);
  });

  it("weights by ticket count", () => {
    // Nine tickets against one. Over a wide sweep of seeds the split should
    // land near 9:1; the bounds are loose enough not to flake and tight
    // enough to fail an unweighted pick, which would sit at 1:1.
    const pool = [entrant("many", 9), entrant("few", 1)];

    let many = 0;
    const runs = 2000;
    for (let seed = 1; seed <= runs; seed++) {
      if (pickWinner(pool, seed)?.id === "many") many++;
    }

    const share = many / runs;
    assert.ok(share > 0.85, `expected the 9-ticket entrant near 0.9, got ${share}`);
    assert.ok(share < 0.95, `expected the 9-ticket entrant near 0.9, got ${share}`);
  });

  it("can return every entrant who holds a ticket", () => {
    const pool = [entrant("a", 1), entrant("b", 1), entrant("c", 1)];
    const seen = new Set<string>();

    for (let seed = 1; seed <= 500; seed++) {
      seen.add(pickWinner(pool, seed)!.id);
    }

    assert.deepEqual([...seen].sort(), ["a", "b", "c"]);
  });
});

describe("reelNames", () => {
  it("ends on the winner", () => {
    const pool = [entrant("a", 1), entrant("b", 1)];
    const names = reelNames(pool, pool[1]!, 5);

    assert.equal(names.at(-1), "B");
  });

  it("runs the length asked for", () => {
    const pool = [entrant("a", 1), entrant("b", 1)];

    assert.equal(reelNames(pool, pool[0]!, 5, 10).length, 10);
  });

  it("still shows the winner when the bucket held only them", () => {
    const only = entrant("a", 1);

    assert.deepEqual(reelNames([], only, 5), ["A"]);
  });
});

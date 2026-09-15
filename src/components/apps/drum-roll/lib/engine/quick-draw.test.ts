import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { eligibleForQuick, reduceRaffle } from "./fold.ts";
import type { RaffleEvent } from "./types.ts";

const added = (id: string, tickets = 1): RaffleEvent => ({
  type: "ENTRANT_ADDED",
  id,
  name: id.toUpperCase(),
  tickets,
});

const quick = (entrantId: string, seed = 7): RaffleEvent => ({
  type: "QUICK_DRAWN",
  entrantId,
  seed,
});

const ids = (entrants: readonly { id: string }[]) => entrants.map((e) => e.id);

describe("prizeless draws", () => {
  it("records each draw in the order it happened, with its seed", () => {
    const state = reduceRaffle([
      added("a"),
      added("b"),
      quick("a", 11),
      quick("b", 22),
    ]);

    assert.deepEqual(state.quickDraws, [
      { entrantId: "a", seed: 11 },
      { entrantId: "b", seed: 22 },
    ]);
  });

  it("needs no prize to draw against", () => {
    const state = reduceRaffle([added("a"), added("b")]);

    assert.equal(state.prizes.length, 0);
    assert.deepEqual(ids(eligibleForQuick(state)), ["a", "b"]);
  });

  it("drops a name that has already come out while the house rule is on", () => {
    const state = reduceRaffle([added("a"), added("b"), quick("a")]);

    assert.equal(state.onePrizePerPerson, true);
    assert.deepEqual(ids(eligibleForQuick(state)), ["b"]);
  });

  it("keeps a drawn name in the bucket once the house rule is off", () => {
    const state = reduceRaffle([
      added("a"),
      added("b"),
      { type: "ONE_PRIZE_PER_PERSON_SET", value: false },
      quick("a"),
    ]);

    assert.deepEqual(ids(eligibleForQuick(state)), ["a", "b"]);
  });

  it("leaves out anyone holding no tickets", () => {
    const state = reduceRaffle([added("a", 0), added("b", 2)]);

    assert.deepEqual(ids(eligibleForQuick(state)), ["b"]);
  });

  /**
   * The two shapes of draw share a bucket but not a result list, and mixing
   * them up is the failure this whole split exists to prevent.
   */
  it("does not let a prizeless draw fill a prize", () => {
    const state = reduceRaffle([
      added("a"),
      { type: "PRIZE_ADDED", id: "p1", name: "The good paddle" },
      quick("a"),
    ]);

    assert.equal(state.prizes[0]?.winnerId, null);
    assert.equal(state.quickDraws.length, 1);
  });

  it("clears the prizeless results without touching names or prizes", () => {
    const state = reduceRaffle([
      added("a", 3),
      { type: "PRIZE_ADDED", id: "p1", name: "The good paddle" },
      { type: "DRAWN", prizeId: "p1", entrantId: "a", seed: 5 },
      quick("a"),
      { type: "QUICK_CLEARED" },
    ]);

    assert.deepEqual(state.quickDraws, []);
    assert.deepEqual(ids(state.entrants), ["a"]);
    assert.equal(state.entrants[0]?.tickets, 3);
    assert.equal(state.prizes[0]?.winnerId, "a");
  });

  it("undoes a draw by dropping the last event and folding again", () => {
    const events: RaffleEvent[] = [added("a"), added("b"), quick("a")];

    const undone = reduceRaffle(events.slice(0, -1));

    assert.deepEqual(undone.quickDraws, []);
    assert.deepEqual(ids(eligibleForQuick(undone)), ["a", "b"]);
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { eligibleFor, nextPrize, reduceRaffle, ticketsIn } from "./fold.ts";
import type { RaffleEvent } from "./types.ts";

const added = (id: string, tickets = 1): RaffleEvent => ({
  type: "ENTRANT_ADDED",
  id,
  name: id.toUpperCase(),
  tickets,
});

const prize = (id: string): RaffleEvent => ({
  type: "PRIZE_ADDED",
  id,
  name: `Prize ${id}`,
});

const drawn = (prizeId: string, entrantId: string): RaffleEvent => ({
  type: "DRAWN",
  prizeId,
  entrantId,
  seed: 42,
});

const ids = (entrants: readonly { id: string }[]) => entrants.map((e) => e.id);

describe("reduceRaffle", () => {
  it("keeps entrants in the order they were added", () => {
    const state = reduceRaffle([added("a"), added("b"), added("c")]);

    assert.deepEqual(ids(state.entrants), ["a", "b", "c"]);
  });

  it("corrects a ticket count without disturbing the order", () => {
    const state = reduceRaffle([
      added("a", 1),
      added("b", 1),
      { type: "TICKETS_SET", id: "a", tickets: 5 },
    ]);

    assert.deepEqual(ids(state.entrants), ["a", "b"]);
    assert.equal(state.entrants[0]!.tickets, 5);
  });

  it("treats a negative or fractional ticket count as a whole number of none", () => {
    const state = reduceRaffle([added("a", -3), added("b", 2.7)]);

    assert.equal(state.entrants[0]!.tickets, 0);
    assert.equal(state.entrants[1]!.tickets, 2);
  });

  it("folds a draw onto the prize", () => {
    const state = reduceRaffle([added("a"), prize("p1"), drawn("p1", "a")]);

    assert.equal(state.prizes[0]!.winnerId, "a");
    assert.equal(state.prizes[0]!.seed, 42);
  });

  it("puts a redrawn name on the record and clears the prize", () => {
    const state = reduceRaffle([
      added("a"),
      added("b"),
      prize("p1"),
      drawn("p1", "a"),
      { type: "REDRAWN", prizeId: "p1", entrantId: "a", reason: "not-present" },
    ]);

    assert.equal(state.prizes[0]!.winnerId, null);
    assert.equal(state.prizes[0]!.seed, null);
    assert.deepEqual(state.prizes[0]!.skipped, ["a"]);
  });

  it("undoes a draw by dropping the last event and folding again", () => {
    const log: RaffleEvent[] = [added("a"), prize("p1"), drawn("p1", "a")];

    assert.equal(reduceRaffle(log).prizes[0]!.winnerId, "a");
    assert.equal(reduceRaffle(log.slice(0, -1)).prizes[0]!.winnerId, null);
  });

  it("leaves a prize standing when its winner is removed from the list", () => {
    // A draw that happened, happened. The screen shows a prize held by a name
    // no longer listed, which is the truth rather than a quiet un-draw.
    const state = reduceRaffle([
      added("a"),
      prize("p1"),
      drawn("p1", "a"),
      { type: "ENTRANT_REMOVED", id: "a" },
    ]);

    assert.deepEqual(ids(state.entrants), []);
    assert.equal(state.prizes[0]!.winnerId, "a");
  });
});

describe("eligibleFor", () => {
  it("leaves out anyone with no tickets", () => {
    const state = reduceRaffle([added("a", 0), added("b", 2), prize("p1")]);

    assert.deepEqual(ids(eligibleFor(state, "p1")), ["b"]);
  });

  it("leaves out anyone already sent back from this prize", () => {
    const state = reduceRaffle([
      added("a"),
      added("b"),
      prize("p1"),
      drawn("p1", "a"),
      { type: "REDRAWN", prizeId: "p1", entrantId: "a", reason: "not-present" },
    ]);

    assert.deepEqual(ids(eligibleFor(state, "p1")), ["b"]);
  });

  it("still allows a name sent back from one prize to win another", () => {
    const state = reduceRaffle([
      added("a"),
      added("b"),
      prize("p1"),
      prize("p2"),
      drawn("p1", "a"),
      { type: "REDRAWN", prizeId: "p1", entrantId: "a", reason: "not-present" },
    ]);

    assert.deepEqual(ids(eligibleFor(state, "p2")), ["a", "b"]);
  });

  it("takes a winner out of the other buckets while one-per-person is on", () => {
    const state = reduceRaffle([
      added("a"),
      added("b"),
      prize("p1"),
      prize("p2"),
      drawn("p1", "a"),
    ]);

    assert.equal(state.onePrizePerPerson, true);
    assert.deepEqual(ids(eligibleFor(state, "p2")), ["b"]);
  });

  it("leaves a winner in the other buckets once one-per-person is off", () => {
    const state = reduceRaffle([
      added("a"),
      added("b"),
      prize("p1"),
      prize("p2"),
      { type: "ONE_PRIZE_PER_PERSON_SET", value: false },
      drawn("p1", "a"),
    ]);

    assert.deepEqual(ids(eligibleFor(state, "p2")), ["a", "b"]);
  });

  it("puts a late arrival in for the prizes still to come, not the ones gone", () => {
    // Exactly what paper does: you cannot be in a bucket that was already
    // tipped out, and nobody has to re-run the night to let you in.
    const log: RaffleEvent[] = [
      added("early"),
      prize("p1"),
      prize("p2"),
      drawn("p1", "early"),
      added("late"),
    ];
    const state = reduceRaffle(log);

    assert.deepEqual(ids(eligibleFor(state, "p2")), ["late"]);
    assert.equal(state.prizes[0]!.winnerId, "early");
  });

  it("empties out when every eligible name already holds a prize", () => {
    const state = reduceRaffle([
      added("a"),
      prize("p1"),
      prize("p2"),
      drawn("p1", "a"),
    ]);

    assert.deepEqual(eligibleFor(state, "p2"), []);
  });
});

describe("ticketsIn and nextPrize", () => {
  it("counts the bucket", () => {
    const state = reduceRaffle([added("a", 3), added("b", 5), added("c", 0)]);

    assert.equal(ticketsIn(state.entrants), 8);
  });

  it("points at the first prize nobody holds", () => {
    const state = reduceRaffle([
      added("a"),
      prize("p1"),
      prize("p2"),
      drawn("p1", "a"),
    ]);

    assert.equal(nextPrize(state)?.id, "p2");
  });

  it("points nowhere once every prize is gone", () => {
    const state = reduceRaffle([added("a"), prize("p1"), drawn("p1", "a")]);

    assert.equal(nextPrize(state), null);
  });
});

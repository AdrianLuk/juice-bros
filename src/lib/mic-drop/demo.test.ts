import assert from "node:assert/strict";
import { test } from "node:test";

import { crowdMove, demoPoll, demoReduce, demoStart, DEMO_ROOM_SIZE, type DemoState } from "./demo.ts";

const counts = (state: DemoState) => Object.fromEntries(demoPoll(state).contestants.map((c) => [c.id, c.votes]));

test("the visitor's first tap is a new phone's Vote", () => {
  const start = demoStart();
  const voted = demoReduce(start, { kind: "tap", contestantId: "anna-bright" });
  assert.equal(voted.myVote, "anna-bright");
  assert.equal(voted.phonesIn, start.phonesIn + 1);
  assert.equal(counts(voted)["anna-bright"], 1);
});

test("tapping another Contestant moves the Vote: the old count drops, no new phone", () => {
  const first = demoReduce(demoStart(), { kind: "tap", contestantId: "anna-bright" });
  const switched = demoReduce(first, { kind: "tap", contestantId: "ben-johns" });
  assert.equal(switched.phonesIn, first.phonesIn);
  assert.equal(counts(switched)["anna-bright"], 0);
  assert.equal(counts(switched)["ben-johns"], 4);
});

test("tapping your own Vote again takes it back: the count and the phone both drop", () => {
  const start = demoStart();
  const voted = demoReduce(start, { kind: "tap", contestantId: "ben-johns" });
  const unvoted = demoReduce(voted, { kind: "tap", contestantId: "ben-johns" });
  assert.equal(unvoted.myVote, null);
  assert.equal(unvoted.phonesIn, start.phonesIn);
  assert.deepEqual(unvoted.votes, start.votes);
});

test("once closed, no tap changes anything, your own pick included", () => {
  const closed = demoReduce(demoReduce(demoStart(), { kind: "tap", contestantId: "ben-johns" }), { kind: "close" });
  assert.equal(demoReduce(closed, { kind: "tap", contestantId: "anna-bright" }), closed);
  assert.equal(demoReduce(closed, { kind: "tap", contestantId: "ben-johns" }), closed);
});

test("the chart reads most Votes first, entry order breaking ties", () => {
  const ids = demoPoll(demoStart()).contestants.map((c) => c.id);
  assert.deepEqual(ids.slice(0, 3), ["anna-leigh-waters", "ben-johns", "jw-dylan"]);
});

test("closing names every Contestant tied on the top count; an open Poll names none", () => {
  const tied = demoReduce(demoStart(), { kind: "tap", contestantId: "ben-johns" });
  assert.deepEqual(demoPoll(tied).winnerIds, []);
  assert.deepEqual(demoPoll(demoReduce(tied, { kind: "close" })).winnerIds, ["anna-leigh-waters", "ben-johns"]);
});

test("the crowd fills the room, then only switches, and never moves the visitor's Vote", () => {
  let state = demoReduce(demoStart(), { kind: "tap", contestantId: "federico-staksrud" });
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let step = 0; step < 400; step++) {
    const move = crowdMove(state, random);
    if (move) state = demoReduce(state, move);
  }
  assert.equal(state.phonesIn, DEMO_ROOM_SIZE);
  assert.equal(Object.values(state.votes).reduce((sum, count) => sum + count, 0), DEMO_ROOM_SIZE);
  assert.ok(state.votes["federico-staksrud"] >= 1, "the visitor's Vote still counts");
  assert.ok(Object.values(state.votes).every((count) => count >= 0));
});

test("a closed Poll gets no crowd moves", () => {
  assert.equal(crowdMove(demoReduce(demoStart(), { kind: "close" }), Math.random), null);
});

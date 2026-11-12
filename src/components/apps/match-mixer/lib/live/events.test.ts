import assert from "node:assert/strict";
import test from "node:test";

import { gameKey, replay, type MixerEvent } from "./events.ts";

let id = 0;
const event = (kind: string, payload: Record<string, unknown>): MixerEvent => ({ id: ++id, kind, payload });
const entered = (round: number, court: number, score: [number, number]) =>
  event("score_entered", { round, court, score });
const cleared = (round: number, court: number) => event("score_cleared", { round, court });

test("a Live Mixer with no events plays to 11, win by 2, with no scores", () => {
  const live = replay([]);
  assert.deepEqual(live.rule, { to: 11, winBy: 2 });
  assert.equal(live.scores.size, 0);
});

test("a Game's score is its latest event", () => {
  const live = replay([entered(0, 0, [11, 4]), entered(0, 1, [3, 11]), entered(0, 0, [11, 9])]);
  assert.deepEqual(live.scores.get(gameKey(0, 0)), [11, 9]);
  assert.deepEqual(live.scores.get(gameKey(0, 1)), [3, 11]);
});

test("a cleared score is gone, and can be entered again", () => {
  const gone = replay([entered(2, 1, [11, 4]), cleared(2, 1)]);
  assert.equal(gone.scores.has(gameKey(2, 1)), false);

  const back = replay([entered(2, 1, [11, 4]), cleared(2, 1), entered(2, 1, [8, 11])]);
  assert.deepEqual(back.scores.get(gameKey(2, 1)), [8, 11]);
});

test("the Game Rule is the latest change, and changing it keeps every score already in", () => {
  const live = replay([
    event("game_rule_changed", { to: 21, winBy: 1 }),
    entered(0, 0, [21, 20]),
    event("game_rule_changed", { to: 11, winBy: 2 }),
  ]);
  assert.deepEqual(live.rule, { to: 11, winBy: 2 });
  assert.deepEqual(live.scores.get(gameKey(0, 0)), [21, 20]);
});

test("an event the reader can't make sense of is skipped, not fatal", () => {
  const live = replay([
    entered(0, 0, [11, 4]),
    event("score_entered", { round: 0, court: 0, score: [5, 5] }),
    event("score_entered", { round: -1, court: 0, score: [11, 4] }),
    event("score_entered", { round: 0, court: 0 }),
    event("game_rule_changed", { to: 12, winBy: 2 }),
    event("player_added", { name: "Ben Johns" }),
  ]);
  assert.deepEqual(live.scores.get(gameKey(0, 0)), [11, 4]);
  assert.equal(live.scores.size, 1);
  assert.deepEqual(live.rule, { to: 11, winBy: 2 });
});

// #689: the Current Round, as a Round index (Round 1 is 0), like a Game's `round`.

const started = (round: number) => event("round_started", { round });

test("before anything happens the Current Round is Round 1", () => {
  assert.equal(replay([]).currentRound, 0);
});

test("the organizer starting a Round makes it the Current Round", () => {
  assert.equal(replay([started(1)]).currentRound, 1);
  assert.equal(replay([started(1), started(2)]).currentRound, 2);
});

test("scores alone move the night on: the Current Round is one past the latest Round scored", () => {
  assert.equal(replay([entered(0, 0, [11, 4])]).currentRound, 1);
  assert.equal(replay([entered(0, 0, [11, 4]), entered(0, 1, [11, 6]), entered(1, 0, [9, 11])]).currentRound, 2);
});

test("with both a tap and scores, the Current Round is the higher of the two", () => {
  assert.equal(replay([started(3), entered(1, 0, [11, 4])]).currentRound, 3);
  assert.equal(replay([started(1), entered(1, 0, [11, 4]), entered(2, 1, [11, 4])]).currentRound, 3);
});

test("a score one Round ahead moves the Current Round on by one", () => {
  const before = [started(1), entered(0, 0, [11, 4])];
  assert.equal(replay(before).currentRound, 1);
  assert.equal(replay([...before, entered(1, 0, [11, 4])]).currentRound, 2);
});

test("clearing a score never lowers the Current Round: locks never undo", () => {
  assert.equal(replay([entered(3, 0, [11, 4]), cleared(3, 0)]).currentRound, 4);
  assert.equal(replay([entered(3, 0, [11, 4]), cleared(3, 0), cleared(3, 0)]).currentRound, 4);
});

test("a cleared Game alone, or a malformed start, moves nothing", () => {
  assert.equal(replay([cleared(2, 0)]).currentRound, 0);
  assert.equal(replay([event("round_started", { round: -1 }), event("round_started", {})]).currentRound, 0);
  assert.equal(replay([event("score_entered", { round: 5, court: 0, score: [5, 5] })]).currentRound, 0);
});

test("on a Pooled board the Current Round is one number across Pools", () => {
  // Courts are global across Pools (ADR 0004): Pool A plays courts 0 and 1, Pool B courts 2 and 3.
  const live = replay([entered(0, 0, [11, 4]), entered(2, 3, [11, 9]), entered(1, 1, [4, 11])]);
  assert.equal(live.currentRound, 3);
});

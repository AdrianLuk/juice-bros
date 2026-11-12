import assert from "node:assert/strict";
import test from "node:test";

import { gameKey, replay, type MixerEvent } from "./events.ts";

let id = 0;
const event = (kind: string, payload: Record<string, unknown>): MixerEvent => ({ id: ++id, kind, payload });
const entered = (round: number, court: number, score: [number, number]) =>
  event("score_entered", { round, court, score });
const cleared = (round: number, court: number) => event("score_cleared", { round, court });

test("a Live Mixer with no events plays to 11, win by 2, with no scores", () => {
  const night = replay([]);
  assert.deepEqual(night.rule, { to: 11, winBy: 2 });
  assert.equal(night.scores.size, 0);
});

test("a Game's score is its latest event", () => {
  const night = replay([entered(0, 0, [11, 4]), entered(0, 1, [3, 11]), entered(0, 0, [11, 9])]);
  assert.deepEqual(night.scores.get(gameKey(0, 0)), [11, 9]);
  assert.deepEqual(night.scores.get(gameKey(0, 1)), [3, 11]);
});

test("a cleared score is gone, and can be entered again", () => {
  const gone = replay([entered(2, 1, [11, 4]), cleared(2, 1)]);
  assert.equal(gone.scores.has(gameKey(2, 1)), false);

  const back = replay([entered(2, 1, [11, 4]), cleared(2, 1), entered(2, 1, [8, 11])]);
  assert.deepEqual(back.scores.get(gameKey(2, 1)), [8, 11]);
});

test("the Game Rule is the latest change, and changing it keeps every score already in", () => {
  const night = replay([
    event("game_rule_changed", { to: 21, winBy: 1 }),
    entered(0, 0, [21, 20]),
    event("game_rule_changed", { to: 11, winBy: 2 }),
  ]);
  assert.deepEqual(night.rule, { to: 11, winBy: 2 });
  assert.deepEqual(night.scores.get(gameKey(0, 0)), [21, 20]);
});

test("an event the reader can't make sense of is skipped, not fatal", () => {
  const night = replay([
    entered(0, 0, [11, 4]),
    event("score_entered", { round: 0, court: 0, score: [5, 5] }),
    event("score_entered", { round: -1, court: 0, score: [11, 4] }),
    event("score_entered", { round: 0, court: 0 }),
    event("game_rule_changed", { to: 12, winBy: 2 }),
    event("player_added", { name: "Ben Johns" }),
  ]);
  assert.deepEqual(night.scores.get(gameKey(0, 0)), [11, 4]);
  assert.equal(night.scores.size, 1);
  assert.deepEqual(night.rule, { to: 11, winBy: 2 });
});

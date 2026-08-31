import assert from "node:assert/strict";
import test from "node:test";

import { reduceSession } from "./reduce.ts";
import type { Operator, SessionConfig, SessionEvent } from "./types.ts";

const config: SessionConfig = {
  sessionId: "session-1",
  clubId: "club-1",
  venueName: "Ramsden Park",
  courtCount: 8,
  groupCap: 4,
  floorMode: "hybrid",
  seed: "seed-1",
};

const vanessa: Operator = { kind: "organizer", userId: "vanessa" };

let clock = 1_000;
/** Monotonic fake timestamps so tests never touch the real clock. */
function tick(): number {
  clock += 1_000;
  return clock;
}

function started(operator: Operator = vanessa): SessionEvent {
  return { type: "SESSION_STARTED", at: tick(), operator };
}

test("an empty log folds to a pending Session carrying its config", () => {
  const state = reduceSession(config, []);

  assert.equal(state.status, "pending");
  assert.equal(state.startedAt, null);
  assert.equal(state.startedBy, null);
  assert.deepEqual(state.config, config);
});

test("SESSION_STARTED opens the Session and records when and by whom", () => {
  const event = started();
  const state = reduceSession(config, [event]);

  assert.equal(state.status, "open");
  assert.equal(state.startedAt, event.at);
  assert.deepEqual(state.startedBy, vanessa);
});

test("a replayed duplicate SESSION_STARTED does not move the start time or Operator", () => {
  const first = started(vanessa);
  const second = started({ kind: "organizer", userId: "someone-else" });

  const state = reduceSession(config, [first, second]);

  assert.equal(state.startedAt, first.at);
  assert.deepEqual(state.startedBy, vanessa);
});

test("folding is deterministic — identical config and events give identical state", () => {
  const events: SessionEvent[] = [started()];

  assert.deepEqual(
    reduceSession(config, events),
    reduceSession(config, events),
  );
});

test("undo is dropping the last event: re-folding the shorter log restores the prior state", () => {
  const before = reduceSession(config, []);
  const event = started();
  const after = reduceSession(config, [event]);

  assert.notDeepEqual(after, before);
  assert.deepEqual(reduceSession(config, [event].slice(0, -1)), before);
});

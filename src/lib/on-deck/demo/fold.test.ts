import assert from "node:assert/strict";
import test from "node:test";

import type { Operator, SessionEvent } from "../session/types.ts";
import {
  appendToDemoLog,
  demoLoadedSession,
  demoLogOf,
  readDemoLog,
  undoInDemoLog,
} from "./fold.ts";
import { DEMO_CONFIG } from "./night.ts";

const ORGANIZER: Operator = { kind: "organizer", userId: "demo-organizer" };

const started: SessionEvent = { type: "SESSION_STARTED", at: 1_000, operator: ORGANIZER };
const finished = (court: number, at: number): SessionEvent => ({
  type: "COURT_FINISHED",
  at,
  operator: ORGANIZER,
  court,
});

test("an authored log numbers its events from 1, and the newest is lastEvent", () => {
  const log = demoLogOf([started, finished(1, 2_000)]);
  assert.deepEqual(readDemoLog(log).lastEvent, {
    seq: 2,
    type: "COURT_FINISHED",
    at: 2_000,
    operator: ORGANIZER,
  });
});

test("an append stamps the body with when and who", () => {
  const log = appendToDemoLog(demoLogOf([started]), { type: "COURT_FINISHED", court: 1 }, ORGANIZER, 2_000);
  assert.deepEqual(readDemoLog(log).events, [started, finished(1, 2_000)]);
});

test("lastRowAt is the newest entry's at, and null for an empty log", () => {
  assert.equal(readDemoLog(demoLogOf([])).lastRowAt, null);
  assert.equal(readDemoLog(demoLogOf([started, finished(1, 2_000)])).lastRowAt, 2_000);
});

test("Undo drops the newest event only while it is still the one the board showed", () => {
  const log = appendToDemoLog(demoLogOf([started]), { type: "COURT_FINISHED", court: 1 }, ORGANIZER, 2_000);
  assert.equal(undoInDemoLog(log, 1), null, "a stale seq is refused");

  const undone = undoInDemoLog(log, 2);
  assert.ok(undone);
  assert.deepEqual(readDemoLog(undone).events, [started]);
});

test("a seq is never reused after an Undo, as the database's identity never is", () => {
  const log = appendToDemoLog(demoLogOf([started]), { type: "COURT_FINISHED", court: 1 }, ORGANIZER, 2_000);
  const undone = undoInDemoLog(log, 2)!;
  const again = appendToDemoLog(undone, { type: "COURT_FINISHED", court: 2 }, ORGANIZER, 3_000);

  assert.equal(readDemoLog(again).lastEvent?.seq, 3);
  // An Undo aimed at the event that was dropped can't take its replacement.
  assert.equal(undoInDemoLog(again, 2), null);
});

test("the demo's Session reads closed once SESSION_CLOSED is in its log", () => {
  const open = demoLogOf([started]);
  assert.equal(demoLoadedSession(DEMO_CONFIG, open).status, "open");

  const closed = appendToDemoLog(
    appendToDemoLog(open, { type: "LAST_CALL" }, ORGANIZER, 2_000),
    { type: "SESSION_CLOSED" },
    ORGANIZER,
    3_000,
  );
  const loaded = demoLoadedSession(DEMO_CONFIG, closed);
  assert.equal(loaded.status, "closed");
  assert.equal(loaded.state.status, "closed");
});

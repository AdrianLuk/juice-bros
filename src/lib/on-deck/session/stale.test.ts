import assert from "node:assert/strict";
import test from "node:test";

import { AUTO_CLOSE_AFTER_MS, isSessionStale } from "./stale.ts";

const NOW = 10_000_000;

test("a Session with a very recent event is not stale", () => {
  assert.equal(isSessionStale(NOW - 1_000, NOW), false);
});

test("a Session whose last event is exactly at the threshold is not stale", () => {
  assert.equal(isSessionStale(NOW - AUTO_CLOSE_AFTER_MS, NOW), false);
});

test("a Session whose last event is one ms past the threshold is stale", () => {
  assert.equal(isSessionStale(NOW - AUTO_CLOSE_AFTER_MS - 1, NOW), true);
});

test("a Session quiet for days is stale", () => {
  const nineDaysMs = 9 * 24 * 60 * 60 * 1000;
  assert.equal(isSessionStale(NOW - nineDaysMs, NOW), true);
});

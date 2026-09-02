import { test } from "node:test";
import assert from "node:assert/strict";

import { formatWaitLabel } from "./wait.ts";

const NOW = 1_700_000_000_000;

test("under a minute reads 'just now'", () => {
  assert.equal(formatWaitLabel(NOW - 30_000, NOW), "just now");
  assert.equal(formatWaitLabel(NOW, NOW), "just now");
});

test("minutes under an hour", () => {
  assert.equal(formatWaitLabel(NOW - 60_000, NOW), "1 min");
  assert.equal(formatWaitLabel(NOW - 7 * 60_000, NOW), "7 min");
  assert.equal(formatWaitLabel(NOW - 59 * 60_000, NOW), "59 min");
});

test("hours, with and without a minute remainder", () => {
  assert.equal(formatWaitLabel(NOW - 60 * 60_000, NOW), "1 hr");
  assert.equal(formatWaitLabel(NOW - 72 * 60_000, NOW), "1 hr 12 min");
  assert.equal(formatWaitLabel(NOW - 125 * 60_000, NOW), "2 hr 5 min");
});

test("clock skew (a future waitSince) clamps to 'just now'", () => {
  assert.equal(formatWaitLabel(NOW + 5_000, NOW), "just now");
});

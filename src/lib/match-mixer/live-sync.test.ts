import assert from "node:assert/strict";
import test from "node:test";

import { FALLBACK_POLL_MS, LIVE_POLL_MS, liveMixerTopic, pollIntervalFor, socketFrom } from "./live-sync.ts";

test("the topic matches the one the migration's trigger broadcasts on", () => {
  assert.equal(liveMixerTopic("abc"), "match-mixer:abc");
});

test("a live socket polls slowly; connecting or dropped polls often", () => {
  assert.equal(pollIntervalFor(socketFrom("SUBSCRIBED")), LIVE_POLL_MS);
  assert.equal(pollIntervalFor(socketFrom("CHANNEL_ERROR")), FALLBACK_POLL_MS);
  assert.equal(pollIntervalFor(socketFrom("JOINING")), FALLBACK_POLL_MS);
  assert.ok(FALLBACK_POLL_MS <= 5_000, "a dropped socket still shows a score within a few seconds");
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { FALLBACK_POLL_MS, LIVE_POLL_MS, pollIntervalFor, pollTopic, socketFrom } from "./live-sync.ts";

test("a subscribed channel is live; an error, timeout or close is dropped", () => {
  assert.equal(socketFrom("SUBSCRIBED"), "live");
  assert.equal(socketFrom("CHANNEL_ERROR"), "dropped");
  assert.equal(socketFrom("TIMED_OUT"), "dropped");
  assert.equal(socketFrom("CLOSED"), "dropped");
  assert.equal(socketFrom("JOINING"), "connecting");
});

test("polling slows to a backstop only while the socket is live", () => {
  assert.equal(pollIntervalFor("live"), LIVE_POLL_MS);
  assert.equal(pollIntervalFor("connecting"), FALLBACK_POLL_MS);
  assert.equal(pollIntervalFor("dropped"), FALLBACK_POLL_MS);
});

test("a Poll's topic is the one the database trigger broadcasts on", () => {
  assert.equal(pollTopic("p-1"), "mic-drop:p-1");
});

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  FALLBACK_POLL_MS,
  LIVE_POLL_MS,
  pollIntervalFor,
  statusFromChannel,
} from "./realtime.ts";

test("a subscribed channel reads as live", () => {
  assert.equal(statusFromChannel("SUBSCRIBED"), "live");
});

test("every unhealthy channel state reads as dropped", () => {
  assert.equal(statusFromChannel("TIMED_OUT"), "dropped");
  assert.equal(statusFromChannel("CHANNEL_ERROR"), "dropped");
  assert.equal(statusFromChannel("CLOSED"), "dropped");
});

test("a live socket slow-polls; connecting and dropped run the fallback cadence", () => {
  assert.equal(pollIntervalFor("live"), LIVE_POLL_MS);
  assert.equal(pollIntervalFor("connecting"), FALLBACK_POLL_MS);
  assert.equal(pollIntervalFor("dropped"), FALLBACK_POLL_MS);
});

test("the fallback cadence matches the pre-Realtime poll and stays quicker than the live backstop", () => {
  assert.equal(FALLBACK_POLL_MS, 4_000);
  assert.ok(LIVE_POLL_MS > FALLBACK_POLL_MS);
  // The live backstop covers the notify Realtime can't deliver (SESSION_CLOSED
  // to an anon subscriber, once the Session is closed) — keep it tolerable.
  assert.ok(LIVE_POLL_MS <= 15_000);
});

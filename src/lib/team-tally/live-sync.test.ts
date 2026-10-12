import assert from "node:assert/strict";
import { test } from "node:test";

import { freshnessFor, isStale, trackFailures } from "./live-sync.ts";

test("a board whose reads are landing is fresh", () => {
  assert.equal(freshnessFor(null), "fresh");
});

test("a short blip stays quiet: under 30 seconds of failed reads is still fresh", () => {
  assert.equal(freshnessFor(0), "fresh");
  assert.equal(freshnessFor(29_999), "fresh");
});

test("30 seconds of failed reads says reconnecting", () => {
  assert.equal(freshnessFor(30_000), "reconnecting");
  assert.equal(freshnessFor(119_999), "reconnecting");
});

test("two minutes of failed reads asks for a reload", () => {
  assert.equal(freshnessFor(120_000), "reload");
  assert.equal(freshnessFor(600_000), "reload");
});

test("the failure clock starts at the first failed read and only a good read stops it", () => {
  let clock = trackFailures(null, { failing: true, lastGoodRead: 1_000, now: 5_000 });
  assert.deepEqual(clock, { lastGoodRead: 1_000, since: 5_000 });

  // A redeploy with Realtime still up: each broadcast restarts the read, so
  // "failing" blinks false between attempts. The clock keeps running.
  clock = trackFailures(clock, { failing: false, lastGoodRead: 1_000, now: 20_000 });
  clock = trackFailures(clock, { failing: true, lastGoodRead: 1_000, now: 40_000 });
  assert.deepEqual(clock, { lastGoodRead: 1_000, since: 5_000 });

  // A read lands: the clock stops.
  assert.equal(trackFailures(clock, { failing: false, lastGoodRead: 41_000, now: 41_000 }), null);
});

test("a board that never failed has no failure clock", () => {
  assert.equal(trackFailures(null, { failing: false, lastGoodRead: 1_000, now: 90_000 }), null);
});

test("only reconnecting and reload are stale", () => {
  assert.equal(isStale(undefined), false);
  assert.equal(isStale("fresh"), false);
  assert.equal(isStale("reconnecting"), true);
  assert.equal(isStale("reload"), true);
});

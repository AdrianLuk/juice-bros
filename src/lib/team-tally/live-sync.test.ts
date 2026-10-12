import assert from "node:assert/strict";
import { test } from "node:test";

import { freshnessFor } from "./live-sync.ts";

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

import assert from "node:assert/strict";
import test from "node:test";

const data = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  },
};

// Imported after the window stub exists so the SSR guards see a browser.
const { recall, remember } = await import("./live-storage.ts");

const KEY = "juicebros.matchmixer.live";
const LIVE = {
  organizerPath: `/tools/match-mixer/organizer/${"a".repeat(32)}`,
  playerPath: `/tools/match-mixer/player/${"b".repeat(32)}`,
  wentLiveAt: "2026-11-12T23:00:00.000Z",
};

test("the last Live Mixer comes back", () => {
  remember(LIVE);
  assert.deepEqual(recall(), LIVE);
});

test("nothing stored is nothing remembered", () => {
  data.clear();
  assert.equal(recall(), null);
});

test("a value this build didn't write is nothing remembered", () => {
  for (const raw of [
    "not json",
    JSON.stringify({ schema: 2, ...LIVE }),
    JSON.stringify({ schema: 1, ...LIVE, organizerPath: "https://evil.example/" }),
    JSON.stringify({ schema: 1, ...LIVE, playerPath: LIVE.organizerPath }),
    JSON.stringify({ schema: 1, ...LIVE, wentLiveAt: "yesterday" }),
  ]) {
    data.set(KEY, raw);
    assert.equal(recall(), null, raw);
  }
});

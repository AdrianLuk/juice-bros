import assert from "node:assert/strict";
import test from "node:test";

import type { MatchConfig, MatchEvent } from "../scoring/types.ts";

/** Minimal localStorage stand-in; the module only ever uses these three. */
class MemoryStorage {
  private data = new Map<string, string>();
  throwOnWrite = false;

  getItem(key: string) {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string) {
    if (this.throwOnWrite) throw new Error("QuotaExceededError");
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const storage = new MemoryStorage();
(globalThis as { window?: unknown }).window = { localStorage: storage };

// Imported after the window stub exists so the SSR guards see a browser.
const { save, load, clear } = await import("./match-storage.ts");

const config = {
  scoring: "sideout",
  doubles: true,
  pointsToWin: 11,
  winBy: 2,
  bestOf: 3,
  freezeRule: false,
  switchAtScore: 6,
  switchAtScoreDecidingGameOnly: true,
  timeoutsPerGame: 2,
  timeoutSeconds: 60,
  medicalTimeoutSeconds: 900,
  equipmentTimeoutSeconds: 120,
  players: { A: ["Amy", "Alex"], B: ["Ben", "Bea"] },
} satisfies MatchConfig;

const events: MatchEvent[] = [
  { type: "PREMATCH", at: 1_000, winner: "A", server: "A" },
  { type: "RALLY_WON", at: 2_000, team: "A" },
];

const KEY = "juicebros.picklepointpal.match";

test("round-trips a config and event log", () => {
  clear();
  save(config, events);
  const loaded = load();
  assert.ok(loaded);
  assert.deepEqual(loaded.config, config);
  assert.deepEqual(loaded.events, events);
  assert.equal(typeof loaded.savedAt, "number");
});

test("load returns null when nothing is saved", () => {
  clear();
  assert.equal(load(), null);
});

test("load returns null on malformed JSON rather than throwing", () => {
  storage.setItem(KEY, "{not json");
  assert.equal(load(), null);
});

test("load discards a save from a different schema version", () => {
  storage.setItem(KEY, JSON.stringify({ schema: 99, config, events, savedAt: 1 }));
  assert.equal(load(), null);
});

test("load rejects a well-formed envelope with a missing event log", () => {
  storage.setItem(KEY, JSON.stringify({ schema: 1, config, savedAt: 1 }));
  assert.equal(load(), null);
});

test("save swallows quota errors", () => {
  clear();
  storage.throwOnWrite = true;
  assert.doesNotThrow(() => save(config, events));
  storage.throwOnWrite = false;
  assert.equal(load(), null);
});

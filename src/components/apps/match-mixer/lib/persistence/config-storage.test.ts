import assert from "node:assert/strict";
import test from "node:test";

import { generateSchedule } from "../engine/schedule.ts";
import type { ResolvedConfig } from "../engine/config.ts";
import type { Roster } from "../engine/types.ts";

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
const { save, load, clear } = await import("./config-storage.ts");

const KEY = "juicebros.matchmixer.config";
const SCHEMA = 1;

const roster: Roster = [
  { id: "p0", name: "Ben Johns" },
  { id: "p1", name: "Anna Leigh Waters" },
  { id: "p2", name: "Federico Staksrud" },
  { id: "p3", name: "Catherine Parenteau" },
  { id: "p4", name: "JW Johnson" },
  { id: "p5", name: "Anna Bright" },
  { id: "p6", name: "Gabriel Tardio" },
  { id: "p7", name: "Jorja Johnson" },
];

const drawn: ResolvedConfig = { roster, courts: 2, rounds: 5, seed: 12345 };

const fields = { roster, courts: 2, rounds: null };

test("round-trips the fields and the drawn config", () => {
  clear();
  save(fields, drawn);
  const loaded = load();
  assert.ok(loaded);
  assert.deepEqual(loaded.fields, fields);
  assert.deepEqual(loaded.drawn, drawn);
  assert.equal(typeof loaded.savedAt, "number");
});

test("keeps every player's id, so identity survives a reload", () => {
  clear();
  save(fields, drawn);
  const loaded = load();
  assert.deepEqual(
    loaded?.fields.roster.map((player) => player.id),
    roster.map((player) => player.id),
  );
});

test("a restored config regenerates the identical schedule", () => {
  clear();
  save(fields, drawn);
  const loaded = load();
  assert.ok(loaded?.drawn);
  assert.deepEqual(generateSchedule(loaded.drawn), generateSchedule(drawn));
});

test("keeps a drawn config that no longer matches the fields", () => {
  // The sheet on screen is the previous draw; the fields have moved on. The
  // screen says so, and it can only say so if both halves come back.
  clear();
  const edited = { ...fields, roster: [...roster, { id: "p8", name: "Tyson McGuffin" }] };
  save(edited, drawn);
  const loaded = load();
  assert.equal(loaded?.fields.roster.length, 9);
  assert.equal(loaded?.drawn?.roster.length, 8);
});

test("round-trips a saved roster with nothing drawn from it yet", () => {
  clear();
  save(fields, null);
  const loaded = load();
  assert.deepEqual(loaded?.fields, fields);
  assert.equal(loaded?.drawn, null);
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
  storage.setItem(KEY, JSON.stringify({ schema: 99, fields, drawn, savedAt: 1 }));
  assert.equal(load(), null);
});

test("load rejects a roster that is not a roster", () => {
  for (const bad of [null, "Ben Johns", [{ id: "p0" }], [{ name: "Ben Johns" }], [42]]) {
    storage.setItem(
      KEY,
      JSON.stringify({ schema: SCHEMA, fields: { ...fields, roster: bad }, drawn: null, savedAt: 1 }),
    );
    assert.equal(load(), null, `accepted ${JSON.stringify(bad)} as a roster`);
  }
});

test("load rejects court and round counts that are not numbers", () => {
  for (const bad of ["2", {}, true]) {
    storage.setItem(
      KEY,
      JSON.stringify({ schema: SCHEMA, fields: { ...fields, courts: bad }, drawn: null, savedAt: 1 }),
    );
    assert.equal(load(), null, `accepted ${String(bad)} as a court count`);
  }
});

test("load rejects a drawn config missing its seed", () => {
  storage.setItem(
    KEY,
    JSON.stringify({ schema: SCHEMA, fields, drawn: { roster, courts: 2, rounds: 5 }, savedAt: 1 }),
  );
  assert.equal(load(), null);
});

test("load rejects a drawn roster the engine could not schedule", () => {
  // Only reachable by hand-editing storage, but the answer to it has to be a
  // fresh screen rather than an UnsupportedConfigError on mount.
  storage.setItem(
    KEY,
    JSON.stringify({
      schema: SCHEMA,
      fields,
      drawn: { ...drawn, roster: roster.slice(0, 3) },
      savedAt: 1,
    }),
  );
  assert.equal(load(), null);
});

test("save with an empty roster clears the save, sheet on screen or not", () => {
  for (const stillDrawn of [null, drawn]) {
    clear();
    save(fields, drawn);
    save({ roster: [], courts: null, rounds: null }, stillDrawn);
    assert.equal(storage.getItem(KEY), null);
  }
});

test("save swallows quota errors", () => {
  clear();
  storage.throwOnWrite = true;
  assert.doesNotThrow(() => save(fields, drawn));
  storage.throwOnWrite = false;
  assert.equal(load(), null);
});

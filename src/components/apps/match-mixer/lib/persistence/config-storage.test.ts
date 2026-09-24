import assert from "node:assert/strict";
import test from "node:test";

import { drawPools, type BoardConfig } from "../engine/pools.ts";
import { parsePoolHeaders, parseRoster } from "../engine/roster.ts";
import { generateSchedule } from "../engine/schedule.ts";
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
/**
 * Deliberately a second copy rather than an import: the module's SCHEMA is a
 * promise about what is already on disk in somebody's browser, so a bump
 * should have to be typed twice and show up as an edit to this file. 2 is
 * RR-4.1's Format (#543).
 */
const SCHEMA = 2;

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

const drawn: BoardConfig = {
  roster,
  courts: 2,
  rounds: 5,
  seed: 12345,
  format: "rotating",
  mixed: false,
  pools: 1,
};

const edited = {
  roster,
  courts: 2,
  rounds: null,
  format: "rotating",
  mixed: false,
  pools: 1,
  headers: [],
} as const;

test("round-trips the edited config and the drawn one", () => {
  clear();
  save(edited, drawn);
  const loaded = load();
  assert.ok(loaded);
  assert.deepEqual(loaded.edited, edited);
  assert.deepEqual(loaded.drawn, drawn);
  assert.equal(typeof loaded.savedAt, "number");
});

test("keeps every player's id, so identity survives a reload", () => {
  clear();
  save(edited, drawn);
  const loaded = load();
  assert.deepEqual(
    loaded?.edited.roster.map((player) => player.id),
    roster.map((player) => player.id),
  );
});

test("a restored config regenerates the identical schedule", () => {
  clear();
  save(edited, drawn);
  const loaded = load();
  assert.ok(loaded?.drawn);
  assert.deepEqual(generateSchedule(loaded.drawn), generateSchedule(drawn));
});

test("keeps a drawn config that no longer matches the edited one", () => {
  // The sheet on screen is the previous draw; the edited Config has moved on.
  // The screen says so, and it can only say so if both halves come back.
  clear();
  const grown = { ...edited, roster: [...roster, { id: "p8", name: "Tyson McGuffin" }] };
  save(grown, drawn);
  const loaded = load();
  assert.equal(loaded?.edited.roster.length, 9);
  assert.equal(loaded?.drawn?.roster.length, 8);
});

test("round-trips a saved roster with nothing drawn from it yet", () => {
  clear();
  save(edited, null);
  const loaded = load();
  assert.deepEqual(loaded?.edited, edited);
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
  storage.setItem(KEY, JSON.stringify({ schema: 99, edited, drawn, savedAt: 1 }));
  assert.equal(load(), null);
});

test("load rejects a roster that is not a roster", () => {
  for (const bad of [null, "Ben Johns", [{ id: "p0" }], [{ name: "Ben Johns" }], [42]]) {
    storage.setItem(
      KEY,
      JSON.stringify({ schema: SCHEMA, edited: { ...edited, roster: bad }, drawn: null, savedAt: 1 }),
    );
    assert.equal(load(), null, `accepted ${JSON.stringify(bad)} as a roster`);
  }
});

test("load rejects court and round counts that are not numbers", () => {
  for (const bad of ["2", {}, true]) {
    storage.setItem(
      KEY,
      JSON.stringify({ schema: SCHEMA, edited: { ...edited, courts: bad }, drawn: null, savedAt: 1 }),
    );
    assert.equal(load(), null, `accepted ${String(bad)} as a court count`);
  }
});

test("load rejects a drawn config missing its seed", () => {
  storage.setItem(
    KEY,
    JSON.stringify({ schema: SCHEMA, edited, drawn: { roster, courts: 2, rounds: 5 }, savedAt: 1 }),
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
      edited,
      drawn: { ...drawn, roster: roster.slice(0, 3) },
      savedAt: 1,
    }),
  );
  assert.equal(load(), null);
});

test("brings a hand-edited drawn config inside what the roster supports", () => {
  // The restored numbers are read back for the stale key and the line naming
  // what the sheet was drawn from, so they have to be the numbers the engine
  // will actually use rather than whatever storage happened to hold.
  storage.setItem(
    KEY,
    JSON.stringify({
      schema: SCHEMA,
      edited,
      drawn: { ...drawn, courts: 99, rounds: 500 },
      savedAt: 1,
    }),
  );
  const loaded = load();
  assert.equal(loaded?.drawn?.courts, 2, "eight players cannot fill 99 courts");
  assert.equal(loaded?.drawn?.rounds, 40, "the round count outran MAX_ROUNDS");
});

test("save with an empty roster clears the save, sheet on screen or not", () => {
  for (const stillDrawn of [null, drawn]) {
    clear();
    save(edited, drawn);
    save(
      {
        roster: [],
        courts: null,
        rounds: null,
        format: "rotating",
        mixed: false,
        pools: 1,
        headers: [],
      },
      stillDrawn,
    );
    assert.equal(storage.getItem(KEY), null);
  }
});

test("save swallows quota errors", () => {
  clear();
  storage.throwOnWrite = true;
  assert.doesNotThrow(() => save(edited, drawn));
  storage.throwOnWrite = false;
  assert.equal(load(), null);
});

test("the format round-trips, and a schedule restored in it is that format", () => {
  clear();
  const pairs = { ...drawn, format: "fixed" } as const;
  save({ ...edited, format: "fixed" }, pairs);

  const loaded = load();
  assert.equal(loaded?.edited.format, "fixed");
  assert.equal(loaded?.drawn?.format, "fixed");
});

test("a singles visit comes back as one, court count and all", () => {
  // Adding a Format is a new value in an existing field rather than a new
  // shape, so the schema does not move and a singles save reads back like any
  // other. Four courts is a singles number — the same eight names in doubles
  // would have clamped it to two.
  clear();
  const solo = { ...drawn, courts: 4, format: "singles" } as const;
  save({ ...edited, courts: 4, format: "singles" }, solo);

  const loaded = load();
  assert.equal(loaded?.edited.format, "singles");
  assert.equal(loaded?.edited.courts, 4);
  assert.equal(loaded?.drawn?.format, "singles");
  assert.equal(loaded?.drawn?.courts, 4);
});

test("a save written by the previous schema is discarded, not migrated", () => {
  // A schema-1 save has no Format and would read as rotating perfectly well,
  // so this is the bump being deliberate rather than forced. What is thrown
  // away is a Roster the organizer can paste again; the alternative is a
  // migration path kept alive forever for one optional field.
  clear();
  storage.setItem(
    KEY,
    JSON.stringify({
      schema: 1,
      edited: { roster, courts: 2, rounds: null },
      drawn: { roster, courts: 2, rounds: 5, seed: 12345 },
      savedAt: 1,
    }),
  );
  assert.equal(load(), null);
});

test("a saved format this build does not know is refused, not guessed at", () => {
  // Storage is hand-editable, and a Format nobody here can draw would
  // otherwise fall back to rotating and put a board on screen that is not the
  // one the save describes.
  clear();
  storage.setItem(
    KEY,
    JSON.stringify({
      schema: SCHEMA,
      edited: { ...edited, format: "kingofthecourt" },
      drawn: null,
      savedAt: 1,
    }),
  );
  assert.equal(load(), null);
});

test("a saved board its format cannot seat is discarded, not restored", () => {
  // Storage is hand-editable, and this Config is drawn from during mount. A
  // fixed-partner board with an odd roster would throw there rather than fail
  // gracefully — a tool that does not render at all, on every visit, until
  // somebody clears localStorage by hand.
  clear();
  const odd = roster.slice(0, 5);
  storage.setItem(
    KEY,
    JSON.stringify({
      schema: SCHEMA,
      edited: { ...edited, roster: odd, format: "fixed" },
      drawn: { ...drawn, roster: odd, courts: 1, rounds: 4, format: "fixed" },
      savedAt: 1,
    }),
  );
  assert.equal(load(), null);
});

/**
 * Mixed doubles (#545). The markers live on the Roster entries and the
 * constraint beside the Format, and both have to come back: a marker dropped
 * on the way in would put a roster on screen that no longer says what was
 * typed, and the ticked box over it would start refusing a list the organizer
 * had already marked.
 */

const marked: Roster = [
  { id: "p0", name: "Ben Johns", marker: "M" },
  { id: "p1", name: "Anna Leigh Waters", marker: "F" },
  { id: "p2", name: "Federico Staksrud", marker: "M" },
  { id: "p3", name: "Catherine Parenteau", marker: "F" },
];

const mixedEdited = {
  roster: marked,
  courts: 1,
  rounds: null,
  format: "rotating",
  mixed: true,
  pools: 1,
  headers: [],
} as const;

const mixedDrawn: BoardConfig = {
  roster: marked,
  courts: 1,
  rounds: 4,
  seed: 777,
  format: "rotating",
  mixed: true,
  pools: 1,
};

test("markers and the mixed box survive a reload", () => {
  clear();
  save(mixedEdited, mixedDrawn);
  const loaded = load();
  assert.deepEqual(loaded?.edited, mixedEdited);
  assert.deepEqual(loaded?.drawn, mixedDrawn);
});

test("a restored mixed config regenerates the identical board", () => {
  clear();
  save(mixedEdited, mixedDrawn);
  const loaded = load();
  assert.ok(loaded?.drawn);
  assert.deepEqual(generateSchedule(loaded.drawn), generateSchedule(mixedDrawn));
});

test("a save written before mixed doubles existed reads as unmixed", () => {
  // The whole reason this milestone does not bump the schema: what it adds is
  // a flag that is off in every existing save and a marker absent from every
  // existing Roster, and both read correctly as what they were.
  clear();
  storage.setItem(
    KEY,
    JSON.stringify({
      schema: SCHEMA,
      edited: { roster, courts: 2, rounds: null, format: "rotating" },
      drawn: { roster, courts: 2, rounds: 5, seed: 12345, format: "rotating" },
      savedAt: 1,
    }),
  );
  const loaded = load();
  assert.equal(loaded?.edited.mixed, false);
  assert.equal(loaded?.drawn?.mixed, false);
  assert.equal(loaded?.edited.roster[0].marker, undefined);
});

test("a marker this build cannot seat is corruption, not something to drop", () => {
  clear();
  storage.setItem(
    KEY,
    JSON.stringify({
      schema: SCHEMA,
      edited: {
        roster: [{ id: "p0", name: "Sam", marker: "X" }],
        courts: null,
        rounds: null,
        format: "rotating",
      },
      drawn: null,
      savedAt: 1,
    }),
  );
  assert.equal(load(), null);
});

test("a hand-edited save asking for mixed doubles it cannot seat is refused", () => {
  // Drawn from during mount, so anything `generateSchedule` would throw on is
  // a screen that never renders until storage is cleared by hand.
  clear();
  storage.setItem(
    KEY,
    JSON.stringify({
      schema: SCHEMA,
      edited: { roster, courts: 2, rounds: null, format: "rotating", mixed: true },
      drawn: {
        roster,
        courts: 2,
        rounds: 5,
        seed: 12345,
        format: "rotating",
        mixed: true,
      },
      savedAt: 1,
    }),
  );
  // The unmarked roster cannot be seated as mixed doubles, so the drawn half
  // is corruption and the whole read is refused.
  assert.equal(load(), null);
});

test("a ticked box under a format that cannot carry it is dropped, not restored", () => {
  clear();
  storage.setItem(
    KEY,
    JSON.stringify({
      schema: SCHEMA,
      edited: { roster, courts: 2, rounds: null, format: "fixed", mixed: true },
      drawn: null,
      savedAt: 1,
    }),
  );
  assert.equal(load()?.edited.mixed, false);
});

/**
 * Pools (#552). A count on the Config, absent from every save written before
 * it, and absent reads as one Pool. No schema bump, for the same reason mixed
 * doubles had none.
 */

const twenty: Roster = Array.from({ length: 20 }, (_, i) => ({
  id: `p${i}`,
  name: `Player ${i + 1}`,
}));

const pooledDrawn: BoardConfig = {
  roster: twenty,
  courts: 4,
  rounds: 6,
  seed: 31,
  format: "rotating",
  mixed: false,
  pools: 2,
};

test("the pool count survives a reload, and the board comes back dealt the same", () => {
  clear();
  save({ ...edited, roster: twenty, pools: 2 }, pooledDrawn);
  const loaded = load();
  assert.equal(loaded?.edited.pools, 2);
  assert.ok(loaded?.drawn);
  assert.equal(loaded.drawn.pools, 2);
  assert.deepEqual(drawPools(loaded.drawn), drawPools(pooledDrawn));
});

test("a save written before pools existed reads as one pool, and draws what it drew", () => {
  clear();
  storage.setItem(
    KEY,
    JSON.stringify({
      schema: SCHEMA,
      edited: { roster, courts: 2, rounds: null, format: "rotating", mixed: false },
      drawn: { roster, courts: 2, rounds: 5, seed: 12345, format: "rotating", mixed: false },
      savedAt: 1,
    }),
  );
  const loaded = load();
  assert.equal(loaded?.edited.pools, 1);
  assert.equal(loaded?.drawn?.pools, 1);
  assert.ok(loaded?.drawn);
  assert.deepEqual(drawPools(loaded.drawn)[0].schedule, generateSchedule(drawn));
});

test("a pool count that is not a count is corruption", () => {
  for (const pools of [0, -1, 1.5, "2", true]) {
    clear();
    storage.setItem(
      KEY,
      JSON.stringify({
        schema: SCHEMA,
        edited: { ...edited, pools },
        drawn: null,
        savedAt: 1,
      }),
    );
    assert.equal(load(), null, String(pools));
  }
});

test("a saved pooled board the courts cannot hold is discarded, not restored", () => {
  clear();
  save({ ...edited, roster: twenty, pools: 3 }, { ...pooledDrawn, pools: 3, courts: 2 });
  assert.equal(load(), null);
});

/**
 * The Roster declares the Pools (#553, ADR 0005). Headers are absent from
 * every save written before this, and absent reads as no declared split — the
 * ordinary Roster every existing save already is. No schema bump, for the
 * same reason the Pool count had none.
 */

const declaredText = [
  ...twenty.slice(0, 10).map((p) => p.name),
  "--- 4.0",
  ...twenty.slice(10).map((p) => p.name),
].join("\n");
const declaredHeaders = parsePoolHeaders(declaredText);
const declaredRoster = parseRoster(declaredText);

const declaredEdited = {
  roster: declaredRoster,
  courts: 4,
  rounds: null,
  format: "rotating",
  mixed: false,
  pools: 2,
  headers: declaredHeaders,
} as const;

const declaredDrawn: BoardConfig = {
  roster: declaredRoster,
  courts: 4,
  rounds: 6,
  seed: 31,
  format: "rotating",
  mixed: false,
  pools: 2,
  headers: declaredHeaders,
};

test("headers survive a reload, and the board comes back declared the same", () => {
  clear();
  save(declaredEdited, declaredDrawn);
  const loaded = load();
  assert.deepEqual(loaded?.edited.headers, declaredHeaders);
  assert.ok(loaded?.drawn);
  assert.deepEqual(loaded.drawn.headers, declaredHeaders);
  const pools = drawPools(loaded.drawn);
  assert.deepEqual(
    pools.map((pool) => pool.label),
    ["A", "4.0"],
  );
  assert.deepEqual(pools, drawPools(declaredDrawn));
});

test("a save written before headers existed reads as no declared split", () => {
  clear();
  storage.setItem(
    KEY,
    JSON.stringify({
      schema: SCHEMA,
      edited: { roster: twenty, courts: 4, rounds: null, format: "rotating", mixed: false, pools: 2 },
      drawn: { roster: twenty, courts: 4, rounds: 6, seed: 31, format: "rotating", mixed: false, pools: 2 },
      savedAt: 1,
    }),
  );
  const loaded = load();
  assert.deepEqual(loaded?.edited.headers, []);
  assert.equal(loaded?.drawn?.headers, undefined);
});

test("headers that are not { label, start } pairs are corruption", () => {
  for (const bad of [
    "not an array",
    [{ label: 1, start: 0 }],
    [{ label: "A", start: -1 }],
    [{ label: "A", start: 1.5 }],
    [{ start: 0 }],
  ]) {
    clear();
    storage.setItem(
      KEY,
      JSON.stringify({ schema: SCHEMA, edited: { ...edited, headers: bad }, drawn: null, savedAt: 1 }),
    );
    assert.equal(load(), null, JSON.stringify(bad));
  }
});

test("a header on an odd boundary in fixed partners is discarded, not restored", () => {
  clear();
  const oddText = "Ben\nAnna\nCath\nDon\n---\nDave\nEve\nFay\nGus\nHal";
  const oddRoster = parseRoster(oddText);
  const oddHeaders = parsePoolHeaders(oddText);
  save(
    { ...edited, roster: oddRoster, format: "fixed", headers: oddHeaders, pools: 2 },
    {
      roster: oddRoster,
      courts: 2,
      rounds: 3,
      seed: 1,
      format: "fixed",
      mixed: false,
      pools: 2,
      headers: oddHeaders,
    },
  );
  assert.equal(load(), null);
});

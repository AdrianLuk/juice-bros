import assert from "node:assert/strict";
import test from "node:test";

/** Minimal localStorage stand-in; the module only ever uses these three. */
class MemoryStorage {
  private data = new Map<string, string>();
  throwOnWrite = false;
  throwOnRead = false;

  getItem(key: string) {
    if (this.throwOnRead) throw new Error("SecurityError");
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string) {
    if (this.throwOnWrite) throw new Error("QuotaExceededError");
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  raw(key: string) {
    return this.data.get(key) ?? null;
  }
}

const storage = new MemoryStorage();
(globalThis as { window?: unknown }).window = { localStorage: storage };

// Imported after the window stub exists so the SSR guards see a browser.
const { boardIdentity, save, load, clear } = await import(
  "./selection-storage.ts"
);

const KEY = "juicebros.matchmixer.selection";
const SCHEMA = 1;

const board = boardIdentity("2/5/Ben Johns\nAnna Bright", 12345);
const other = boardIdentity("2/5/Ben Johns\nAnna Bright", 99);

/** Back to nothing stored, without going through the board-scoped clear. */
function reset() {
  storage.removeItem(KEY);
}

test("round-trips a roster index against the board it was picked on", () => {
  reset();
  save(board, 3);
  assert.equal(load(board, 8), 3);
});

test("load returns null when nothing is saved", () => {
  reset();
  assert.equal(load(board, 8), null);
});

test("a selection stored against another board does not attach to this one", () => {
  // The organizer sent a second link. An index only means anything against
  // the board it was picked on, so index 3 here is a stranger's evening.
  reset();
  save(other, 3);
  assert.equal(load(board, 8), null);
});

test("a different seed on the same roster is a different board", () => {
  reset();
  save(board, 3);
  assert.notEqual(board, other);
  assert.equal(load(other, 8), null);
});

test("an index off the end of this roster reads as no selection", () => {
  reset();
  save(board, 7);
  assert.equal(load(board, 4), null);
});

test("a negative or fractional index reads as no selection", () => {
  reset();
  storage.setItem(
    KEY,
    JSON.stringify({ schema: SCHEMA, board, player: -1 }),
  );
  assert.equal(load(board, 8), null);
  storage.setItem(
    KEY,
    JSON.stringify({ schema: SCHEMA, board, player: 1.5 }),
  );
  assert.equal(load(board, 8), null);
});

test("load returns null on malformed JSON rather than throwing", () => {
  reset();
  storage.setItem(KEY, "{not json");
  assert.equal(load(board, 8), null);
});

test("load discards a save from a different schema version", () => {
  reset();
  storage.setItem(
    KEY,
    JSON.stringify({ schema: SCHEMA + 1, board, player: 2 }),
  );
  assert.equal(load(board, 8), null);
});

test("load rejects a board identity that is not a string", () => {
  reset();
  storage.setItem(KEY, JSON.stringify({ schema: SCHEMA, board: 7, player: 2 }));
  assert.equal(load(board, 8), null);
});

test("load returns null when the browser refuses storage", () => {
  reset();
  save(board, 3);
  storage.throwOnRead = true;
  try {
    assert.equal(load(board, 8), null);
  } finally {
    storage.throwOnRead = false;
  }
});

test("save swallows quota errors", () => {
  reset();
  storage.throwOnWrite = true;
  try {
    assert.doesNotThrow(() => save(board, 3));
  } finally {
    storage.throwOnWrite = false;
  }
});

test("clearing removes the value rather than leaving a tombstone", () => {
  reset();
  save(board, 3);
  clear(board);
  assert.equal(storage.raw(KEY), null);
});

test("clearing leaves another board's selection alone", () => {
  // One slot, shared by every tab. A second tab reading a different board must
  // not delete the selection the first one is still showing.
  reset();
  save(other, 3);
  clear(board);
  assert.equal(load(other, 8), 3);
});

test("clearing removes a value nobody could have read", () => {
  reset();
  storage.setItem(KEY, "{not json");
  clear(board);
  assert.equal(storage.raw(KEY), null);
});

test("clear swallows a browser that refuses storage", () => {
  reset();
  storage.throwOnRead = true;
  try {
    assert.doesNotThrow(() => clear(board));
  } finally {
    storage.throwOnRead = false;
  }
});

test("a board identity keys on the draw and the seed together", () => {
  assert.notEqual(
    boardIdentity("2/5/Ben Johns", 1),
    boardIdentity("2/6/Ben Johns", 1),
  );
  assert.equal(boardIdentity("2/5/Ben Johns", 1), boardIdentity("2/5/Ben Johns", 1));
});

test("the selection is kept under its own key, away from the saved config", () => {
  reset();
  save(board, 3);
  assert.ok(storage.raw(KEY));
  assert.equal(storage.raw("juicebros.matchmixer.config"), null);
});

import assert from "node:assert/strict";
import test from "node:test";

import { addCourt, EMPTY_GRID, PRESETS } from "../../../../../lib/court-grid/grid.ts";

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
const { loadVenues, saveVenue, deleteVenue } = await import("./venue-storage.ts");

const KEY = "juicebros.matchmixer.venues";
const plus = PRESETS.find((preset) => preset.id === "plus")!.grid();
const row = PRESETS.find((preset) => preset.id === "row-4")!.grid();

function reset() {
  storage.removeItem(KEY);
  storage.throwOnWrite = false;
}

test("an organizer can keep several venues, in the order they were saved", () => {
  reset();
  saveVenue("Rec Centre North", plus);
  saveVenue("Eastside Courts", row);
  assert.deepEqual(
    loadVenues().map((venue) => venue.name),
    ["Rec Centre North", "Eastside Courts"],
  );
  assert.deepEqual(loadVenues()[0].grid, plus);
});

test("saving under a name already kept updates that venue instead of adding one", () => {
  reset();
  saveVenue("Rec Centre North", plus);
  saveVenue("  rec centre north ", row);
  const venues = loadVenues();
  assert.equal(venues.length, 1);
  assert.equal(venues[0].name, "rec centre north");
  assert.deepEqual(venues[0].grid, row);
});

test("a venue needs a name and at least one court", () => {
  reset();
  assert.equal(saveVenue("   ", plus), null);
  assert.equal(saveVenue("Empty hall", EMPTY_GRID), null);
  assert.deepEqual(loadVenues(), []);
});

test("deleting a venue leaves the others", () => {
  reset();
  saveVenue("Rec Centre North", plus);
  saveVenue("Eastside Courts", row);
  deleteVenue("Rec Centre North");
  assert.deepEqual(
    loadVenues().map((venue) => venue.name),
    ["Eastside Courts"],
  );
});

test("a damaged entry is skipped and the rest still load", () => {
  reset();
  storage.setItem(
    KEY,
    JSON.stringify({
      schema: 1,
      venues: [
        { name: "Good", grid: addCourt(EMPTY_GRID, 0, 0) },
        { name: "Bad", grid: { courts: [{ row: -1, col: 0, number: 1 }] } },
        "nonsense",
      ],
    }),
  );
  assert.deepEqual(
    loadVenues().map((venue) => venue.name),
    ["Good"],
  );
});

test("storage that is unreadable or full never throws", () => {
  reset();
  storage.setItem(KEY, "{not json");
  assert.deepEqual(loadVenues(), []);
  storage.throwOnWrite = true;
  assert.doesNotThrow(() => saveVenue("Rec Centre North", plus));
});

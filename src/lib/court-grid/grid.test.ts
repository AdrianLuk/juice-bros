import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addCourt,
  bookedNumbers,
  courtAt,
  duplicateNumbers,
  EMPTY_GRID,
  GRID_COLUMNS,
  PRESETS,
  readGrid,
  renumber,
  setCourtNumber,
  touchingPairs,
  type CourtGrid,
} from "./grid.ts";

function preset(id: string): CourtGrid {
  const found = PRESETS.find((p) => p.id === id);
  assert.ok(found, `no preset ${id}`);
  return found.grid();
}

describe("painting and numbering", () => {
  it("numbers a new court one past the highest, whatever the facility started from", () => {
    let grid = addCourt(EMPTY_GRID, 0, 0);
    grid = setCourtNumber(grid, 0, 0, 14);
    grid = addCourt(grid, 0, 1);
    assert.deepEqual(
      grid.courts.map((court) => court.number),
      [14, 15],
    );
  });

  it("ignores a tap on a square that already has a court, or off the grid", () => {
    const grid = addCourt(EMPTY_GRID, 0, 0);
    assert.equal(addCourt(grid, 0, 0), grid);
    assert.equal(addCourt(grid, 0, GRID_COLUMNS), grid);
  });

  it("renumbers 1 to N across each row, top to bottom", () => {
    let grid = EMPTY_GRID;
    grid = addCourt(grid, 1, 0); // 1, second row
    grid = addCourt(grid, 0, 2); // 2, first row right
    grid = addCourt(grid, 0, 0); // 3, first row left
    const renumbered = renumber(grid);
    assert.equal(courtAt(renumbered, 0, 0)?.number, 1);
    assert.equal(courtAt(renumbered, 0, 2)?.number, 2);
    assert.equal(courtAt(renumbered, 1, 0)?.number, 3);
  });

  it("reports numbers two courts share", () => {
    let grid = addCourt(addCourt(addCourt(EMPTY_GRID, 0, 0), 0, 1), 0, 2);
    grid = setCourtNumber(grid, 0, 2, 1);
    assert.deepEqual(duplicateNumbers(grid), [1]);
  });

  it("lists tonight's courts in court order, ignoring numbers not on the grid", () => {
    assert.deepEqual(bookedNumbers(preset("hall-4x3"), new Set([10, 2, 6, 40])), [2, 6, 10]);
  });
});

describe("readGrid", () => {
  it("reads back what was stored", () => {
    const grid = preset("plus");
    assert.deepEqual(readGrid(JSON.parse(JSON.stringify(grid))), grid);
  });

  it("refuses courts off the grid, sharing a square, or with no usable number", () => {
    assert.equal(readGrid({ courts: [{ row: 0, col: GRID_COLUMNS, number: 1 }] }), null);
    assert.equal(
      readGrid({
        courts: [
          { row: 0, col: 0, number: 1 },
          { row: 0, col: 0, number: 2 },
        ],
      }),
      null,
    );
    assert.equal(readGrid({ courts: [{ row: 0, col: 0, number: 0 }] }), null);
    assert.equal(readGrid("courts"), null);
  });
});

describe("touchingPairs", () => {
  it("pairs courts that share an edge, never across a gap or a corner", () => {
    // 1 2 . 3
    // . 4 . .
    let grid = EMPTY_GRID;
    grid = addCourt(grid, 0, 0); // 1
    grid = addCourt(grid, 0, 1); // 2
    grid = addCourt(grid, 0, 3); // 3
    grid = addCourt(grid, 1, 1); // 4
    assert.deepEqual(touchingPairs(grid), [
      [1, 2],
      [2, 4],
    ]);
  });

  it("a plus sign has four pairs, all through the middle court", () => {
    assert.deepEqual(touchingPairs(preset("plus")), [
      [1, 3],
      [2, 3],
      [3, 4],
      [3, 5],
    ]);
  });

  it("only counts the courts booked tonight when given them", () => {
    // Big hall: 1 2 3 4 / 5 6 7 8 / 9 10 11 12. Book a plus around 6.
    const tonight = new Set([2, 5, 6, 7, 10]);
    assert.deepEqual(touchingPairs(preset("hall-4x3"), tonight), [
      [2, 6],
      [5, 6],
      [6, 7],
      [6, 10],
    ]);
  });
});

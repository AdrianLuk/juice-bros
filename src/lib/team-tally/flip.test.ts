import assert from "node:assert/strict";
import { test } from "node:test";

import { flipDeltas } from "./flip.ts";

test("a row that moved down the tower starts from where it was, above its new place", () => {
  const before = new Map([
    ["ben", 40],
    ["fed", 80],
  ]);
  const after = new Map([
    ["fed", 40],
    ["ben", 80],
  ]);

  // Ben slides from 40 to 80: starts 40px above. Federico starts 40px below.
  assert.deepEqual(
    [...flipDeltas(before, after)].sort(),
    [
      ["ben", -40],
      ["fed", 40],
    ],
  );
});

test("rows that stayed put, and rows with no earlier place, don't animate", () => {
  const before = new Map([["ben", 40]]);
  const after = new Map([
    ["ben", 40],
    ["hay", 80],
  ]);
  assert.equal(flipDeltas(before, after).size, 0);
});

test("a move under a pixel is ignored", () => {
  const before = new Map([["ben", 40]]);
  const after = new Map([["ben", 40.4]]);
  assert.equal(flipDeltas(before, after).size, 0);
});

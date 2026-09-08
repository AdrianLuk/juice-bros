import assert from "node:assert/strict";
import test from "node:test";

import { nightLabel, nightLabelWithYear } from "./night-label.ts";

test("a night is named by its weekday and date", () => {
  assert.equal(nightLabel("2026-09-05T17:00:00.000Z"), "Saturday, September 5");
  assert.equal(
    nightLabelWithYear("2026-09-05T17:00:00.000Z"),
    "Saturday, September 5, 2026",
  );
});

test("the label is UTC-stable, so it does not move with the machine's zone", () => {
  // Same instant, three ways of writing it.
  const utc = nightLabel("2026-09-05T17:00:00.000Z");
  assert.equal(nightLabel("2026-09-05T13:00:00.000-04:00"), utc);
  assert.equal(nightLabel("2026-09-06T02:00:00.000+09:00"), utc);
});

test("an unparseable timestamp reads as missing, never as Invalid Date", () => {
  assert.equal(nightLabel("not a date"), "");
  assert.equal(nightLabel(""), "");
  assert.equal(nightLabelWithYear("not a date"), "");
});

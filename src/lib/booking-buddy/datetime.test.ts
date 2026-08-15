import assert from "node:assert/strict";
import test from "node:test";

import { HALF_HOUR_TIMES, formatTimeLabel, isHalfHourTime, isRealDate } from "./datetime.ts";

test("a real calendar date round-trips", () => {
  assert.equal(isRealDate("2026-08-20"), true);
});

test("a date that isn't a date is rejected", () => {
  for (const date of ["", "20/08/2026", "2026-8-20", "not a date", "2026-13-01", "2026-02-30"]) {
    assert.equal(isRealDate(date), false, date);
  }
});

test("only half-hour boundaries are accepted", () => {
  assert.equal(isHalfHourTime("18:00"), true);
  assert.equal(isHalfHourTime("18:30"), true);
  assert.equal(isHalfHourTime("18:15"), false);
  assert.equal(isHalfHourTime("25:00"), false);
});

test("every half-hour slot in a day is offered, and only those", () => {
  assert.equal(HALF_HOUR_TIMES.length, 48);
  assert.equal(HALF_HOUR_TIMES[0], "00:00");
  assert.equal(HALF_HOUR_TIMES.at(-1), "23:30");
});

test("a half-hour slot renders as a 12-hour label", () => {
  assert.equal(formatTimeLabel("00:00"), "12:00 AM");
  assert.equal(formatTimeLabel("18:30"), "6:30 PM");
});

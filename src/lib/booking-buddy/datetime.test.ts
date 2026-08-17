import assert from "node:assert/strict";
import test from "node:test";

import {
  HALF_HOUR_TIMES,
  formatInstantDateAndTime,
  formatInstantRange,
  formatTimeLabel,
  isHalfHourTime,
  isPastDate,
  isRealDate,
  nextCalendarDate,
  previousCalendarDate,
  todayInZone,
} from "./datetime.ts";

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

test("todayInZone reads the calendar date in the given zone, not UTC", () => {
  // 2026-01-01 02:00 UTC is still 2025-12-31 in Toronto (UTC-5 in January).
  const now = new Date("2026-01-01T02:00:00Z");
  assert.equal(todayInZone("America/Toronto", now), "2025-12-31");
  assert.equal(todayInZone("UTC", now), "2026-01-01");
});

test("isPastDate rejects yesterday and earlier, never today or later", () => {
  const now = new Date("2026-08-15T12:00:00Z");
  assert.equal(isPastDate("2026-08-14", "UTC", now), true);
  assert.equal(isPastDate("2020-01-01", "UTC", now), true);
  assert.equal(isPastDate("2026-08-15", "UTC", now), false);
  assert.equal(isPastDate("2026-08-16", "UTC", now), false);
});

test("nextCalendarDate steps forward one calendar day, including across a month/year boundary", () => {
  assert.equal(nextCalendarDate("2026-08-24"), "2026-08-25");
  assert.equal(nextCalendarDate("2026-08-31"), "2026-09-01");
  assert.equal(nextCalendarDate("2026-12-31"), "2027-01-01");
});

test("previousCalendarDate is nextCalendarDate's inverse", () => {
  assert.equal(previousCalendarDate("2026-08-25"), "2026-08-24");
  assert.equal(previousCalendarDate("2026-09-01"), "2026-08-31");
  assert.equal(previousCalendarDate("2027-01-01"), "2026-12-31");
});

test("formatInstantDateAndTime splits the date and the time range apart", () => {
  // 22:00 UTC is 6pm in Toronto in August.
  const { date, time } = formatInstantDateAndTime({
    startsAt: "2026-08-20T22:00:00Z",
    endsAt: "2026-08-20T23:30:00Z",
    timeZone: "America/Toronto",
  });

  assert.equal(date, "Thu, Aug 20, 2026");
  assert.equal(time, "6:00 PM – 7:30 PM");
});

test("formatInstantDateAndTime falls back to UTC and says so on the date, not the time", () => {
  const { date, time } = formatInstantDateAndTime({
    startsAt: "2026-08-20T22:00:00Z",
    endsAt: "2026-08-20T23:30:00Z",
    timeZone: "Mars/Olympus_Mons",
  });

  assert.match(date, /\(UTC\)$/);
  assert.doesNotMatch(time, /UTC/);
  assert.equal(time, "10:00 PM – 11:30 PM");
});

test("formatInstantRange joins formatInstantDateAndTime's own date and time with a middot", () => {
  const args = {
    startsAt: "2026-08-20T22:00:00Z",
    endsAt: "2026-08-20T23:30:00Z",
    timeZone: "America/Toronto",
  };

  assert.equal(
    formatInstantRange(args),
    `${formatInstantDateAndTime(args).date} · ${formatInstantDateAndTime(args).time}`,
  );
});

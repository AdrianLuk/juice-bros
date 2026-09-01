import assert from "node:assert/strict";
import test from "node:test";

import {
  HOUR_TIMES,
  addHoursToTime,
  crossesMidnight,
  formatInstantDateAndTime,
  formatInstantRange,
  formatTimeLabel,
  imminenceLabel,
  isHourTime,
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

test("only on-the-hour boundaries are accepted", () => {
  assert.equal(isHourTime("18:00"), true);
  assert.equal(isHourTime("18:30"), false);
  assert.equal(isHourTime("18:15"), false);
  assert.equal(isHourTime("25:00"), false);
});

test("every hour slot in a day is offered, and only those", () => {
  assert.equal(HOUR_TIMES.length, 24);
  assert.equal(HOUR_TIMES[0], "00:00");
  assert.equal(HOUR_TIMES.at(-1), "23:00");
});

test("an hour slot renders as a 12-hour label", () => {
  assert.equal(formatTimeLabel("00:00"), "12:00 AM");
  assert.equal(formatTimeLabel("18:30"), "6:30 PM");
});

test("addHoursToTime lands on the hour a duration picker would show", () => {
  assert.equal(addHoursToTime("18:00", 1), "19:00");
  assert.equal(addHoursToTime("18:00", 3), "21:00");
  assert.equal(addHoursToTime("00:00", 23), "23:00");
});

test("addHoursToTime wraps a result past midnight into the next day", () => {
  assert.equal(addHoursToTime("21:00", 3), "00:00");
  assert.equal(addHoursToTime("22:00", 3), "01:00");
  assert.equal(addHoursToTime("23:00", 1), "00:00");
});

test("addHoursToTime refuses a count of a full day or more — a range can't lap its own start", () => {
  assert.equal(addHoursToTime("18:00", 24), null);
  assert.equal(addHoursToTime("18:00", 30), null);
});

test("addHoursToTime refuses a non-positive or fractional hour count", () => {
  assert.equal(addHoursToTime("18:00", 0), null);
  assert.equal(addHoursToTime("18:00", -1), null);
  assert.equal(addHoursToTime("18:00", 1.5), null);
});

test("crossesMidnight is true only when the end clock reads before the start", () => {
  assert.equal(crossesMidnight("21:00", "00:00"), true);
  assert.equal(crossesMidnight("22:00", "01:00"), true);
  assert.equal(crossesMidnight("18:00", "21:00"), false);
  assert.equal(crossesMidnight("18:00", "18:00"), false);
});

test("addHoursToTime refuses a start time that isn't on the hour grid", () => {
  assert.equal(addHoursToTime("18:30", 1), null);
  assert.equal(addHoursToTime("not a time", 1), null);
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

test("imminenceLabel cues Today, Tonight, Tomorrow, and nothing further out", () => {
  const now = new Date("2026-08-20T14:00:00");

  assert.equal(imminenceLabel(now, "2026-08-20T15:00:00"), "Today");
  assert.equal(imminenceLabel(now, "2026-08-20T19:00:00"), "Tonight");
  assert.equal(imminenceLabel(now, "2026-08-21T10:00:00"), "Tomorrow");
  assert.equal(imminenceLabel(now, "2026-08-22T10:00:00"), null);
  assert.equal(imminenceLabel(now, "2026-08-19T10:00:00"), null);
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

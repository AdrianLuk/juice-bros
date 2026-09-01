import assert from "node:assert/strict";
import test from "node:test";

import {
  addDays,
  addMonths,
  bookedDayHours,
  groupByLocalDay,
  hourFromOffset,
  isPastDay,
  isSameDay,
  layoutDayEvents,
  layoutMultiDaySpans,
  localDayKey,
  monthGridDays,
  notEndedBefore,
  startOfWeek,
  upcomingBookings,
  weekRangeLabel,
} from "./calendar.ts";

test("startOfWeek rewinds to the preceding Sunday, or stays put if already one", () => {
  // Wednesday 2026-08-19
  assert.equal(startOfWeek(new Date(2026, 7, 19)).getDate(), 16);
  // Sunday 2026-08-16 itself
  assert.equal(startOfWeek(new Date(2026, 7, 16)).getDate(), 16);
});

test("addMonths clamps into a shorter target month instead of rolling over (issue #67)", () => {
  // Oct 31 + 1 month should land in November, not roll into December.
  const forward = addMonths(new Date(2026, 9, 31), 1);
  assert.equal(forward.getMonth(), 10); // November
  assert.equal(forward.getDate(), 30); // November's last day

  // Mar 31 - 1 month should land in February, not roll into April.
  const backward = addMonths(new Date(2026, 2, 31), -1);
  assert.equal(backward.getMonth(), 1); // February
  assert.equal(backward.getDate(), 28); // 2026 is not a leap year
});

test("addMonths behaves as plain month addition when the day-of-month fits", () => {
  const result = addMonths(new Date(2026, 7, 15), 1);
  assert.ok(isSameDay(result, new Date(2026, 8, 15)));
});

test("monthGridDays returns 42 days, starting on the Sunday on or before the 1st", () => {
  const days = monthGridDays(new Date(2026, 7, 19)); // August 2026 — 1st is a Saturday
  assert.equal(days.length, 42);
  assert.ok(isSameDay(days[0], new Date(2026, 6, 26))); // preceding Sunday
  assert.ok(isSameDay(days[41], addDays(days[0], 41)));
});

test("layoutDayEvents: non-overlapping events each get column 0 of a 1-wide group", () => {
  const laidOut = layoutDayEvents([
    { startsAt: "2026-08-20T09:00:00Z", endsAt: "2026-08-20T10:00:00Z" },
    { startsAt: "2026-08-20T11:00:00Z", endsAt: "2026-08-20T12:00:00Z" },
  ]);

  assert.deepEqual(
    laidOut.map((entry) => ({ column: entry.column, columns: entry.columns })),
    [
      { column: 0, columns: 1 },
      { column: 0, columns: 1 },
    ],
  );
});

test("layoutDayEvents: two overlapping events sit side by side in a 2-wide group", () => {
  const laidOut = layoutDayEvents([
    { startsAt: "2026-08-20T09:00:00Z", endsAt: "2026-08-20T11:00:00Z" },
    { startsAt: "2026-08-20T10:00:00Z", endsAt: "2026-08-20T12:00:00Z" },
  ]);

  assert.deepEqual(
    laidOut.map((entry) => ({ column: entry.column, columns: entry.columns })),
    [
      { column: 0, columns: 2 },
      { column: 1, columns: 2 },
    ],
  );
});

test("layoutDayEvents: an event that ends before a third starts frees its column back up", () => {
  const laidOut = layoutDayEvents([
    { startsAt: "2026-08-20T09:00:00Z", endsAt: "2026-08-20T10:00:00Z" }, // column 0
    { startsAt: "2026-08-20T09:30:00Z", endsAt: "2026-08-20T09:45:00Z" }, // overlaps the first, column 1
    { startsAt: "2026-08-20T10:00:00Z", endsAt: "2026-08-20T10:30:00Z" }, // starts once the first has ended
  ]);

  assert.deepEqual(
    laidOut.map((entry) => entry.column),
    [0, 1, 0],
  );
});

test("upcomingBookings: past Bookings drop off, future ones sort soonest-first and respect the cap", () => {
  const now = new Date("2026-08-20T12:00:00Z");
  const result = upcomingBookings(
    [
      { id: "past", startsAt: "2026-08-19T12:00:00Z" },
      { id: "soonest", startsAt: "2026-08-20T13:00:00Z" },
      { id: "later", startsAt: "2026-08-25T13:00:00Z" },
      { id: "latest", startsAt: "2026-09-01T13:00:00Z" },
    ],
    now,
    2,
  );

  assert.deepEqual(
    result.map((booking) => booking.id),
    ["soonest", "later"],
  );
});

test("weekRangeLabel formats a same-month week compactly", () => {
  assert.equal(weekRangeLabel(new Date(2026, 7, 16)), "Aug 16 – 22, 2026");
});

test("weekRangeLabel names both months when the week crosses one", () => {
  assert.equal(weekRangeLabel(new Date(2026, 7, 30)), "Aug 30 – Sep 5, 2026");
});

test("localDayKey is stable across two Dates on the same local day, distinct across a midnight boundary", () => {
  assert.equal(localDayKey(new Date(2026, 7, 16, 0, 0)), localDayKey(new Date(2026, 7, 16, 23, 59)));
  assert.notEqual(localDayKey(new Date(2026, 7, 16, 23, 59)), localDayKey(new Date(2026, 7, 17, 0, 0)));
});

test("groupByLocalDay buckets items by local day, preserving each bucket's input order", () => {
  const items = [
    { id: "a", at: new Date(2026, 7, 16, 9) },
    { id: "b", at: new Date(2026, 7, 17, 9) },
    { id: "c", at: new Date(2026, 7, 16, 18) },
  ];

  const groups = groupByLocalDay(items, (item) => item.at);

  assert.deepEqual([...groups.keys()], ["2026-08-16", "2026-08-17"]);
  assert.deepEqual(
    groups.get("2026-08-16")?.map((item) => item.id),
    ["a", "c"],
  );
  assert.deepEqual(
    groups.get("2026-08-17")?.map((item) => item.id),
    ["b"],
  );
});

test("layoutMultiDaySpans: a span touches every day it crosses, not just the day it starts on", () => {
  const days = [
    new Date(2026, 7, 17),
    new Date(2026, 7, 18),
    new Date(2026, 7, 19),
    new Date(2026, 7, 20),
  ];

  // Aug 18 00:00 through Aug 20 00:00 (exclusive) — two full days, Aug 18 and Aug 19.
  const event = {
    startsAt: new Date(2026, 7, 18).toISOString(),
    endsAt: new Date(2026, 7, 20).toISOString(),
  };

  const spans = layoutMultiDaySpans(days, [event]);

  assert.deepEqual([...spans.keys()], ["2026-08-18", "2026-08-19"]);
  assert.deepEqual(spans.get("2026-08-18"), [{ event, isStart: true, isEnd: false }]);
  assert.deepEqual(spans.get("2026-08-19"), [{ event, isStart: false, isEnd: true }]);
});

test("layoutMultiDaySpans: a single-day span is both its own start and end", () => {
  const days = [new Date(2026, 7, 18), new Date(2026, 7, 19)];

  const event = {
    startsAt: new Date(2026, 7, 18, 18).toISOString(),
    endsAt: new Date(2026, 7, 18, 21).toISOString(),
  };

  const spans = layoutMultiDaySpans(days, [event]);

  assert.deepEqual([...spans.keys()], ["2026-08-18"]);
  assert.deepEqual(spans.get("2026-08-18"), [{ event, isStart: true, isEnd: true }]);
});

test("layoutMultiDaySpans: a day outside every event's range is left out of the map entirely", () => {
  const days = [new Date(2026, 7, 18)];

  const spans = layoutMultiDaySpans(days, [
    { startsAt: new Date(2026, 6, 1).toISOString(), endsAt: new Date(2026, 6, 2).toISOString() },
  ]);

  assert.deepEqual([...spans.keys()], []);
});

test("notEndedBefore: an item that ended before the floor is dropped, one still running or entirely ahead is kept", () => {
  const floor = new Date("2026-08-20T00:00:00Z");

  const result = notEndedBefore(
    [
      { id: "ended-yesterday", endsAt: "2026-08-19T23:00:00Z" },
      { id: "straddles-the-floor", endsAt: "2026-08-20T06:00:00Z" },
      { id: "later-today", endsAt: "2026-08-20T18:00:00Z" },
      { id: "next-week", endsAt: "2026-08-27T18:00:00Z" },
    ],
    floor,
  );

  assert.deepEqual(
    result.map((item) => item.id),
    ["straddles-the-floor", "later-today", "next-week"],
  );
});

test("notEndedBefore: an item ending exactly at the floor is dropped, not kept", () => {
  const floor = new Date("2026-08-20T00:00:00Z");

  const result = notEndedBefore(
    [{ id: "ends-exactly-at-floor", endsAt: "2026-08-20T00:00:00Z" }],
    floor,
  );

  assert.deepEqual(result, []);
});

test("hourFromOffset: floors to the hour band the offset lands in", () => {
  const hourHeight = 48;
  assert.equal(hourFromOffset(0, hourHeight), 0);
  assert.equal(hourFromOffset(47, hourHeight), 0); // just below one row height
  assert.equal(hourFromOffset(48, hourHeight), 1); // exactly one row height
  assert.equal(hourFromOffset(48 * 18 + 12, hourHeight), 18); // mid-evening
});

test("hourFromOffset: clamps to the 0–23 band range", () => {
  const hourHeight = 48;
  assert.equal(hourFromOffset(-10, hourHeight), 0); // above the grid
  assert.equal(hourFromOffset(48 * 24, hourHeight), 23); // exactly at the bottom edge
  assert.equal(hourFromOffset(48 * 100, hourHeight), 23); // far past the last hour
});

test("isPastDay: yesterday is past, any time today and tomorrow are not", () => {
  const now = new Date(2026, 7, 20, 14, 30); // Aug 20 2026, 2:30pm local
  assert.equal(isPastDay(new Date(2026, 7, 19, 23, 59), now), true);
  assert.equal(isPastDay(new Date(2026, 7, 20, 0, 0), now), false);
  assert.equal(isPastDay(new Date(2026, 7, 20, 23, 59), now), false);
  assert.equal(isPastDay(new Date(2026, 7, 21, 0, 0), now), false);
});

test("isPastDay: correct across a month boundary", () => {
  const now = new Date(2026, 8, 1, 9, 0); // Sep 1 2026
  assert.equal(isPastDay(new Date(2026, 7, 31, 20, 0), now), true); // Aug 31
  assert.equal(isPastDay(new Date(2026, 8, 1, 1, 0), now), false); // earlier today
});

test("isPastDay: correct across a year boundary", () => {
  const now = new Date(2027, 0, 1, 0, 30); // Jan 1 2027
  assert.equal(isPastDay(new Date(2026, 11, 31, 23, 30), now), true); // Dec 31 2026
  assert.equal(isPastDay(new Date(2027, 0, 1, 23, 0), now), false); // later today
});

test("bookedDayHours: an on-the-hour Booking claims exactly the bands it spans", () => {
  const day = new Date(2026, 7, 20);
  const hours = bookedDayHours(
    [{ startsAt: new Date(2026, 7, 20, 14).toISOString(), endsAt: new Date(2026, 7, 20, 16).toISOString() }],
    day,
  );
  assert.deepEqual([...hours].sort((a, b) => a - b), [14, 15]);
});

test("bookedDayHours: a part-hour Booking claims every band it touches", () => {
  const day = new Date(2026, 7, 20);
  const hours = bookedDayHours(
    [{ startsAt: new Date(2026, 7, 20, 14, 30).toISOString(), endsAt: new Date(2026, 7, 20, 15, 30).toISOString() }],
    day,
  );
  assert.deepEqual([...hours].sort((a, b) => a - b), [14, 15]);
});

test("bookedDayHours: a Booking on another day contributes nothing", () => {
  const day = new Date(2026, 7, 20);
  const hours = bookedDayHours(
    [{ startsAt: new Date(2026, 7, 21, 9).toISOString(), endsAt: new Date(2026, 7, 21, 11).toISOString() }],
    day,
  );
  assert.deepEqual([...hours], []);
});

test("bookedDayHours: a past-midnight Booking marks hour 23 on its start day and the early hours on the next", () => {
  const event = {
    startsAt: new Date(2026, 7, 20, 23).toISOString(),
    endsAt: new Date(2026, 7, 21, 1).toISOString(),
  };
  assert.deepEqual([...bookedDayHours([event], new Date(2026, 7, 20))], [23]);
  assert.deepEqual([...bookedDayHours([event], new Date(2026, 7, 21))].sort((a, b) => a - b), [0]);
});

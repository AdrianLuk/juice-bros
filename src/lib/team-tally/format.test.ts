import assert from "node:assert/strict";
import { test } from "node:test";

import { eventDateLabel, eventDateParts } from "./format.ts";

test("eventDateLabel reads a Team Event's date the way the Organizer does", () => {
  assert.equal(eventDateLabel("2026-10-13"), "Tue, Oct 13, 2026");
});

test("eventDateParts splits the date for the Organizer's list: weekday, day, month", () => {
  assert.deepEqual(eventDateParts("2026-10-13"), { weekday: "Tue", day: "13", month: "Oct" });
});

test("eventDateParts keeps the calendar day whatever the machine's time zone", () => {
  assert.deepEqual(eventDateParts("2027-01-01"), { weekday: "Fri", day: "1", month: "Jan" });
});

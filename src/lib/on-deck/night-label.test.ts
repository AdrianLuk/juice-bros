import assert from "node:assert/strict";
import test from "node:test";

import { nightLabel, nightLabelWithYear } from "./night-label.ts";

test("a night is named on the Club's own clock, not the server's", () => {
  // TO Pickleball Club's normal night: 18:00–20:00 in Toronto. The close is
  // 00:00 the next day in UTC, which is the whole reason the zone is stored.
  const closedAt = "2026-09-06T00:00:00.000Z"; // 20:00 Sat in Toronto
  assert.equal(
    nightLabel(closedAt, "America/Toronto"),
    "Saturday, September 5",
  );
  assert.equal(nightLabel(closedAt, "UTC"), "Sunday, September 6");
});

test("a winter 18:00 start is also the previous UTC day", () => {
  // 18:00 EST on 2026-01-10 is 23:00 UTC the same day; 19:00 is 00:00 the
  // next. Both are Saturday the 10th to the club.
  assert.equal(
    nightLabel("2026-01-11T00:00:00.000Z", "America/Toronto"),
    "Saturday, January 10",
  );
});

test("the year rides along on a single night's own page", () => {
  assert.equal(
    nightLabelWithYear("2026-09-06T00:00:00.000Z", "America/Toronto"),
    "Saturday, September 5, 2026",
  );
});

test("an unrenderable zone falls back to UTC rather than throwing", () => {
  // The numbers below the heading are why anyone opened the page; a wrong
  // date is bad, a page that will not render is worse.
  assert.equal(
    nightLabel("2026-09-05T17:00:00.000Z", "Mars/Olympus"),
    "Saturday, September 5",
  );
  assert.equal(nightLabel("2026-09-05T17:00:00.000Z", ""), "Saturday, September 5");
});

test("an unparseable timestamp reads as missing, never as Invalid Date", () => {
  assert.equal(nightLabel("not a date", "America/Toronto"), "");
  assert.equal(nightLabelWithYear("", "America/Toronto"), "");
});

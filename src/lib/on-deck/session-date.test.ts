import assert from "node:assert/strict";
import test from "node:test";

import { sessionDate, sessionDateWithYear } from "./session-date.ts";

test("a Session is dated on the Club's own clock, not the server's", () => {
  // TO Pickleball Club's normal night: 18:00-20:00 in Toronto. The close is
  // 00:00 the next day in UTC, which is the whole reason the zone is stored.
  const at = "2026-09-06T00:00:00.000Z"; // 20:00 Sat in Toronto
  assert.equal(
    sessionDate({ at, timeZone: "America/Toronto" }),
    "Saturday, September 5",
  );
  assert.equal(sessionDate({ at, timeZone: "UTC" }), "Sunday, September 6");
});

test("a winter 18:00 start is also the previous UTC day", () => {
  // 18:00 EST on 2026-01-10 is 23:00 UTC the same day; 19:00 is 00:00 the
  // next. Both are Saturday the 10th to the club.
  assert.equal(
    sessionDate({ at: "2026-01-11T00:00:00.000Z", timeZone: "America/Toronto" }),
    "Saturday, January 10",
  );
});

test("the year rides along on a single Session's own page", () => {
  assert.equal(
    sessionDateWithYear({
      at: "2026-09-06T00:00:00.000Z",
      timeZone: "America/Toronto",
    }),
    "Saturday, September 5, 2026",
  );
});

test("an unrenderable or absent zone falls back to UTC rather than throwing", () => {
  // The numbers below the heading are why anyone opened the page; a wrong
  // date is bad, a page that will not render is worse.
  const at = "2026-09-05T17:00:00.000Z";
  assert.equal(sessionDate({ at, timeZone: "Mars/Olympus" }), "Saturday, September 5");
  assert.equal(sessionDate({ at, timeZone: "" }), "Saturday, September 5");
  assert.equal(sessionDate({ at, timeZone: null }), "Saturday, September 5");
});

test("an unparseable timestamp reads as missing, never as Invalid Date", () => {
  assert.equal(sessionDate({ at: "not a date", timeZone: "America/Toronto" }), "");
  assert.equal(
    sessionDateWithYear({ at: "", timeZone: "America/Toronto" }),
    "",
  );
});

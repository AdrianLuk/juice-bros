import assert from "node:assert/strict";
import test from "node:test";

import { parseIcsFeed } from "./ics-feed.ts";

const TORONTO = "America/Toronto";

/** Wrap `VEVENT` bodies in a minimal `VCALENDAR`, CRLF-joined like a real feed. */
function feed(...vevents: string[]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CourtReserve//EN",
    ...vevents.flatMap((body) => ["BEGIN:VEVENT", body, "END:VEVENT"]),
    "END:VCALENDAR",
  ].join("\r\n");
}

function only(text: string) {
  const result = parseIcsFeed(text, { fallbackTimeZone: TORONTO });
  assert.equal(result.events.length, 1, "expected exactly one parsed event");
  return result.events[0];
}

test("a plain UTC VEVENT becomes one event with absolute instants", () => {
  const event = only(
    feed(
      [
        "UID:res-1@courtreserve.com",
        "SUMMARY:Reserved - Court 3",
        "LOCATION:Main Courts",
        "DESCRIPTION:Doubles play",
        "DTSTART:20260915T230000Z",
        "DTEND:20260916T000000Z",
        "SEQUENCE:2",
        "STATUS:CONFIRMED",
      ].join("\r\n"),
    ),
  );

  assert.deepEqual(event, {
    uid: "res-1@courtreserve.com",
    sequence: 2,
    summary: "Reserved - Court 3",
    location: "Main Courts",
    description: "Doubles play",
    start: "2026-09-15T23:00:00.000Z",
    end: "2026-09-16T00:00:00.000Z",
    status: "confirmed",
  });
});

test("a TZID datetime is resolved through that zone to a UTC instant", () => {
  // 19:00 in Toronto on 2026-09-15 is EDT (UTC-4) -> 23:00Z.
  const event = only(
    feed(
      [
        "UID:res-tz@courtreserve.com",
        "DTSTART;TZID=America/Toronto:20260915T190000",
        "DTEND;TZID=America/Toronto:20260915T200000",
      ].join("\r\n"),
    ),
  );

  assert.equal(event.start, "2026-09-15T23:00:00.000Z");
  assert.equal(event.end, "2026-09-16T00:00:00.000Z");
});

test("a TZID naming an unknown zone falls back to the caller's zone", () => {
  const result = parseIcsFeed(
    feed(
      [
        "UID:res-badzone@courtreserve.com",
        "DTSTART;TZID=Middle-earth/Shire:20260915T190000",
        "DTEND;TZID=Middle-earth/Shire:20260915T200000",
      ].join("\r\n"),
    ),
    { fallbackTimeZone: TORONTO },
  );

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].start, "2026-09-15T23:00:00.000Z");
});

test("a floating datetime is read in the caller's zone", () => {
  const event = only(
    feed(
      [
        "UID:res-floating@courtreserve.com",
        "DTSTART:20260915T190000",
        "DTEND:20260915T200000",
      ].join("\r\n"),
    ),
  );

  assert.equal(event.start, "2026-09-15T23:00:00.000Z");
});

test("a winter TZID datetime picks up the standard-time offset", () => {
  // 19:00 in Toronto on 2026-01-15 is EST (UTC-5) -> 00:00Z next day.
  const event = only(
    feed(
      [
        "UID:res-winter@courtreserve.com",
        "DTSTART;TZID=America/Toronto:20260115T190000",
        "DTEND;TZID=America/Toronto:20260115T200000",
      ].join("\r\n"),
    ),
  );

  assert.equal(event.start, "2026-01-16T00:00:00.000Z");
  assert.equal(event.end, "2026-01-16T01:00:00.000Z");
});

test("DURATION is used when DTEND is absent", () => {
  const event = only(
    feed(
      [
        "UID:res-duration@courtreserve.com",
        "DTSTART:20260915T230000Z",
        "DURATION:PT1H",
      ].join("\r\n"),
    ),
  );

  assert.equal(event.end, "2026-09-16T00:00:00.000Z");
});

test("RFC 5545 line folding is unfolded before parsing (the fold marker vanishes)", () => {
  // A real folder can break mid-token: the continuation's one lead space is
  // the fold marker and is removed, rejoining the value exactly.
  const folded =
    "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:res-fold@courtreserve.com\r\n" +
    "DESCRIPTION:Players: Amy Ace\\, Ben Backhand\\, Ca\r\n ra Court\r\n" +
    "DTSTART:20260915T230000Z\r\nDTEND:20260916T000000Z\r\nEND:VEVENT\r\nEND:VCALENDAR";

  const event = only(folded);
  assert.equal(event.description, "Players: Amy Ace, Ben Backhand, Cara Court");
});

test("bare-LF line endings and tab continuations are handled", () => {
  const bareLf =
    "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:res-lf@courtreserve.com\n" +
    "SUMMARY:Court 1\n\t (glass court)\n" +
    "DTSTART:20260915T230000Z\nDTEND:20260916T000000Z\nEND:VEVENT\nEND:VCALENDAR";

  const event = only(bareLf);
  assert.equal(event.summary, "Court 1 (glass court)");
});

test("text escapes are unescaped; a doubled backslash stays literal", () => {
  const event = only(
    feed(
      [
        "UID:res-esc@courtreserve.com",
        "DESCRIPTION:Line one\\nLine two\\; still two\\, more\\\\nnot a newline",
        "DTSTART:20260915T230000Z",
        "DTEND:20260916T000000Z",
      ].join("\r\n"),
    ),
  );

  assert.equal(
    event.description,
    "Line one\nLine two; still two, more\\nnot a newline",
  );
});

test("property parameters and quoted values are split off the value", () => {
  const event = only(
    feed(
      [
        "UID:res-param@courtreserve.com",
        'DTSTART;TZID="America/Toronto":20260915T190000',
        "DTEND;TZID=America/Toronto:20260915T200000",
        "SUMMARY;LANGUAGE=en-US:Court 5",
      ].join("\r\n"),
    ),
  );

  assert.equal(event.summary, "Court 5");
  assert.equal(event.start, "2026-09-15T23:00:00.000Z");
});

test("the VCALENDAR wrapper, VTIMEZONE, and a nested VALARM are ignored", () => {
  const text = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VTIMEZONE",
    "TZID:America/Toronto",
    "BEGIN:DAYLIGHT",
    "TZOFFSETTO:-0400",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    "UID:res-alarm@courtreserve.com",
    "DTSTART:20260915T230000Z",
    "DTEND:20260916T000000Z",
    "SUMMARY:Court 2",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder",
    "TRIGGER:-PT30M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const event = only(text);
  assert.equal(event.uid, "res-alarm@courtreserve.com");
  assert.equal(event.summary, "Court 2");
  // The VALARM's own DESCRIPTION must not leak into the event.
  assert.equal(event.description, "");
});

test("an all-day VALUE=DATE event yields no event but keeps its UID seen", () => {
  const result = parseIcsFeed(
    feed(
      [
        "UID:res-allday@courtreserve.com",
        "DTSTART;VALUE=DATE:20260915",
        "DTEND;VALUE=DATE:20260916",
        "SUMMARY:Facility closed",
      ].join("\r\n"),
    ),
    { fallbackTimeZone: TORONTO },
  );

  assert.deepEqual(result.events, []);
  // Kept seen: a feed that corrupts a real timed reservation into an all-day
  // span must not read as a cancellation on the next diff.
  assert.deepEqual(result.unreadableUids, ["res-allday@courtreserve.com"]);
});

test("an RRULE event is not expanded but keeps its UID seen", () => {
  const result = parseIcsFeed(
    feed(
      [
        "UID:res-weekly@courtreserve.com",
        "DTSTART:20260915T230000Z",
        "DTEND:20260916T000000Z",
        "RRULE:FREQ=WEEKLY;COUNT=10",
        "SUMMARY:Weekly clinic",
      ].join("\r\n"),
    ),
    { fallbackTimeZone: TORONTO },
  );

  assert.deepEqual(result.events, []);
  assert.deepEqual(result.unreadableUids, ["res-weekly@courtreserve.com"]);
});

test("an out-of-range date is malformed, not rolled forward into a real instant", () => {
  // Feb 30: DATE_TIME matches, but Date.UTC would silently roll it to Mar 2.
  const result = parseIcsFeed(
    feed(
      [
        "UID:res-feb30@courtreserve.com",
        "DTSTART:20260230T120000Z",
        "DTEND:20260230T130000Z",
      ].join("\r\n"),
    ),
    { fallbackTimeZone: TORONTO },
  );

  assert.deepEqual(result.events, []);
  assert.deepEqual(result.unreadableUids, ["res-feb30@courtreserve.com"]);
});

test("an out-of-range hour is malformed, not rolled into the next day", () => {
  const result = parseIcsFeed(
    feed(
      [
        "UID:res-hour25@courtreserve.com",
        "DTSTART:20260915T250000Z",
        "DTEND:20260915T260000Z",
      ].join("\r\n"),
    ),
    { fallbackTimeZone: TORONTO },
  );

  assert.deepEqual(result.events, []);
  assert.deepEqual(result.unreadableUids, ["res-hour25@courtreserve.com"]);
});

test("a non-hour start is reported as unreadable-but-seen, not dropped", () => {
  const result = parseIcsFeed(
    feed(
      [
        "UID:res-halfpast@courtreserve.com",
        "DTSTART:20260915T233000Z",
        "DTEND:20260916T003000Z",
        "SUMMARY:Court 3",
      ].join("\r\n"),
    ),
    { fallbackTimeZone: TORONTO },
  );

  assert.deepEqual(result.events, []);
  assert.deepEqual(result.unreadableUids, ["res-halfpast@courtreserve.com"]);
});

test("a Newfoundland Org makes an on-the-hour UTC feed time read as half past", () => {
  // 23:00Z in St. John's (UTC-3:30 in summer) is 19:30 local — not a bookable hour.
  const result = parseIcsFeed(
    feed(
      [
        "UID:res-nfld@courtreserve.com",
        "DTSTART:20260915T230000Z",
        "DTEND:20260916T000000Z",
      ].join("\r\n"),
    ),
    { fallbackTimeZone: "America/St_Johns" },
  );

  assert.deepEqual(result.events, []);
  assert.deepEqual(result.unreadableUids, ["res-nfld@courtreserve.com"]);
});

test("a malformed datetime keeps the event seen by UID", () => {
  const result = parseIcsFeed(
    feed(
      [
        "UID:res-baddate@courtreserve.com",
        "DTSTART:not-a-date",
        "DTEND:20260916T000000Z",
      ].join("\r\n"),
    ),
    { fallbackTimeZone: TORONTO },
  );

  assert.deepEqual(result.events, []);
  assert.deepEqual(result.unreadableUids, ["res-baddate@courtreserve.com"]);
});

test("a missing DTEND with no DURATION is unreadable-but-seen", () => {
  const result = parseIcsFeed(
    feed(
      ["UID:res-noend@courtreserve.com", "DTSTART:20260915T230000Z"].join("\r\n"),
    ),
    { fallbackTimeZone: TORONTO },
  );

  assert.deepEqual(result.unreadableUids, ["res-noend@courtreserve.com"]);
});

test("an end at or before the start is unreadable-but-seen", () => {
  const result = parseIcsFeed(
    feed(
      [
        "UID:res-backwards@courtreserve.com",
        "DTSTART:20260915T230000Z",
        "DTEND:20260915T230000Z",
      ].join("\r\n"),
    ),
    { fallbackTimeZone: TORONTO },
  );

  assert.deepEqual(result.unreadableUids, ["res-backwards@courtreserve.com"]);
});

test("a VEVENT with no UID is dropped silently", () => {
  const result = parseIcsFeed(
    feed(
      ["DTSTART:20260915T230000Z", "DTEND:20260916T000000Z", "SUMMARY:Court 3"].join(
        "\r\n",
      ),
    ),
    { fallbackTimeZone: TORONTO },
  );

  assert.deepEqual(result.events, []);
  assert.deepEqual(result.unreadableUids, []);
});

test("one bad event does not stop the good ones, and order is preserved", () => {
  const result = parseIcsFeed(
    feed(
      [
        "UID:good-1@courtreserve.com",
        "DTSTART:20260915T230000Z",
        "DTEND:20260916T000000Z",
      ].join("\r\n"),
      [
        "UID:bad@courtreserve.com",
        "DTSTART:garbage",
        "DTEND:20260916T000000Z",
      ].join("\r\n"),
      [
        "UID:good-2@courtreserve.com",
        "DTSTART:20260916T230000Z",
        "DTEND:20260917T000000Z",
      ].join("\r\n"),
    ),
    { fallbackTimeZone: TORONTO },
  );

  assert.deepEqual(
    result.events.map((event) => event.uid),
    ["good-1@courtreserve.com", "good-2@courtreserve.com"],
  );
  assert.deepEqual(result.unreadableUids, ["bad@courtreserve.com"]);
});

test("a UID that parses on one event is never also reported unreadable", () => {
  // Same UID twice — a clean occurrence and a malformed one. The clean parse wins.
  const result = parseIcsFeed(
    feed(
      [
        "UID:res-dup@courtreserve.com",
        "DTSTART:20260915T230000Z",
        "DTEND:20260916T000000Z",
      ].join("\r\n"),
      [
        "UID:res-dup@courtreserve.com",
        "DTSTART:nonsense",
        "DTEND:20260916T000000Z",
      ].join("\r\n"),
    ),
    { fallbackTimeZone: TORONTO },
  );

  assert.equal(result.events.length, 1);
  assert.deepEqual(result.unreadableUids, []);
});

test("STATUS:CANCELLED is carried through as a cancelled event", () => {
  const event = only(
    feed(
      [
        "UID:res-cancelled@courtreserve.com",
        "DTSTART:20260915T230000Z",
        "DTEND:20260916T000000Z",
        "STATUS:CANCELLED",
      ].join("\r\n"),
    ),
  );

  assert.equal(event.status, "cancelled");
});

test("an absent or unrecognised STATUS reads as confirmed", () => {
  const confirmed = only(
    feed(
      [
        "UID:res-nostatus@courtreserve.com",
        "DTSTART:20260915T230000Z",
        "DTEND:20260916T000000Z",
      ].join("\r\n"),
    ),
  );
  assert.equal(confirmed.status, "confirmed");

  const weird = only(
    feed(
      [
        "UID:res-weirdstatus@courtreserve.com",
        "DTSTART:20260915T230000Z",
        "DTEND:20260916T000000Z",
        "STATUS:NEEDS-ACTION",
      ].join("\r\n"),
    ),
  );
  assert.equal(weird.status, "confirmed");
});

test("a missing or non-numeric SEQUENCE defaults to 0", () => {
  const event = only(
    feed(
      [
        "UID:res-noseq@courtreserve.com",
        "DTSTART:20260915T230000Z",
        "DTEND:20260916T000000Z",
        "SEQUENCE:not-a-number",
      ].join("\r\n"),
    ),
  );
  assert.equal(event.sequence, 0);
});

test("absent SUMMARY / LOCATION / DESCRIPTION come back as empty strings", () => {
  const event = only(
    feed(
      [
        "UID:res-bare@courtreserve.com",
        "DTSTART:20260915T230000Z",
        "DTEND:20260916T000000Z",
      ].join("\r\n"),
    ),
  );
  assert.equal(event.summary, "");
  assert.equal(event.location, "");
  assert.equal(event.description, "");
});

test("an unusable fallback zone degrades to UTC rather than throwing", () => {
  const result = parseIcsFeed(
    feed(
      [
        "UID:res-badfallback@courtreserve.com",
        "DTSTART:20260915T230000",
        "DTEND:20260916T000000",
      ].join("\r\n"),
    ),
    { fallbackTimeZone: "not/a/zone" },
  );

  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].start, "2026-09-15T23:00:00.000Z");
});

test("empty input and non-calendar text yield an empty result, not an error", () => {
  for (const junk of ["", "hello world", "BEGIN:VCALENDAR\r\nEND:VCALENDAR"]) {
    const result = parseIcsFeed(junk, { fallbackTimeZone: TORONTO });
    assert.deepEqual(result, { events: [], unreadableUids: [] });
  }
});

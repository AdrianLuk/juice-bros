import assert from "node:assert/strict";
import test from "node:test";

import {
  COURT_LABEL_MAX_LENGTH,
  bookingWriteMessage,
  formatBookingWhen,
  isKnownTimeZone,
  parseNewBooking,
} from "./bookings.ts";

const VALID = {
  org_id: "aaaa0000-0000-0000-0000-000000000001",
  court_label: "Court 3",
  date: "2026-08-20",
  start_time: "18:00",
  end_time: "19:30",
  time_zone: "America/Toronto",
};

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

function parse(overrides: Partial<typeof VALID> = {}) {
  return parseNewBooking(form({ ...VALID, ...overrides }));
}

test("a court, a date and a window become a Booking", () => {
  assert.deepEqual(parse(), {
    orgId: VALID.org_id,
    courtLabel: "Court 3",
    // Handed to Postgres as a wall-clock time carrying its own zone, so the
    // DST-aware conversion happens there rather than in JavaScript.
    startsAt: "2026-08-20 18:00:00 America/Toronto",
    endsAt: "2026-08-20 19:30:00 America/Toronto",
    timeZone: "America/Toronto",
  });
});

test("surrounding space is trimmed off the court label", () => {
  const parsed = parse({ court_label: "  Court 3  " });
  assert.ok(!("error" in parsed));
  assert.equal(parsed.courtLabel, "Court 3");
});

test("a Booking with no Org is refused", () => {
  assert.ok("error" in parse({ org_id: "" }));
});

test("a blank court label is refused", () => {
  for (const court_label of ["", "   "]) {
    assert.ok("error" in parse({ court_label }));
  }
});

test("an over-long court label is refused before the database has to", () => {
  const parsed = parse({ court_label: "a".repeat(COURT_LABEL_MAX_LENGTH + 1) });
  assert.ok("error" in parsed);
  assert.match(parsed.error, new RegExp(String(COURT_LABEL_MAX_LENGTH)));
});

test("a date that isn't a date is refused", () => {
  for (const date of ["", "20/08/2026", "2026-8-20", "not a date", "2026-13-01"]) {
    assert.ok("error" in parse({ date }), `${date} should be refused`);
  }
});

test("a time that isn't a time is refused", () => {
  for (const time of ["", "6pm", "18", "25:00", "18:60"]) {
    assert.ok("error" in parse({ start_time: time }), `${time} should be refused`);
    assert.ok("error" in parse({ end_time: time }), `${time} should be refused`);
  }
});

test("a Booking cannot end before it starts, or at the moment it starts", () => {
  // The database refuses this too. Catching it here is what turns a raw
  // constraint violation into a sentence about the form the User just filled in.
  assert.ok("error" in parse({ start_time: "19:30", end_time: "18:00" }));
  assert.ok("error" in parse({ end_time: "18:00" }));
});

test("a missing or unrecognised time zone is refused rather than defaulted", () => {
  // Defaulting to the server's zone is exactly the bug `time_zone` exists to
  // prevent: in production that is UTC, which turns a 6pm court booking into
  // 10pm.
  assert.ok("error" in parse({ time_zone: "" }));
  assert.ok("error" in parse({ time_zone: "Mars/Olympus_Mons" }));
});

test("real IANA zones are recognised and invented ones are not", () => {
  assert.equal(isKnownTimeZone("America/Toronto"), true);
  assert.equal(isKnownTimeZone("UTC"), true);
  assert.equal(isKnownTimeZone("Mars/Olympus_Mons"), false);
  assert.equal(isKnownTimeZone(""), false);
});

test("a Booking is rendered in its own time zone, not the server's", () => {
  // 22:00 UTC is 6pm in Toronto in August. Rendering it as 10pm is the failure
  // this column was added to prevent, and it is invisible until someone shows
  // up four hours late.
  const when = formatBookingWhen({
    startsAt: "2026-08-20T22:00:00Z",
    endsAt: "2026-08-20T23:30:00Z",
    timeZone: "America/Toronto",
  });

  assert.match(when, /6:00/);
  assert.match(when, /7:30/);
  assert.doesNotMatch(when, /10:00/);
  assert.match(when, /Aug 20, 2026/);
});

test("the same instant reads differently in a different zone", () => {
  const when = formatBookingWhen({
    startsAt: "2026-08-20T22:00:00Z",
    endsAt: "2026-08-20T23:30:00Z",
    timeZone: "America/Vancouver",
  });

  assert.match(when, /3:00/);
});

test("an unrenderable zone falls back to UTC and says so", () => {
  // The trigger refuses a zone Postgres doesn't know, so a row like this should
  // not exist — but a list that throws while rendering one Booking takes the
  // whole page down, and that is a worse answer than an honest fallback.
  const when = formatBookingWhen({
    startsAt: "2026-08-20T22:00:00Z",
    endsAt: "2026-08-20T23:30:00Z",
    timeZone: "Mars/Olympus_Mons",
  });

  assert.match(when, /10:00/);
  assert.match(when, /UTC/);
});

test("a Booking under someone else's Org reads as the rule that rejected it", () => {
  // Raised by the assert_booking_coherent trigger.
  assert.match(bookingWriteMessage({ code: "23514" }), /your own|belongs/i);
});

test("an unexplained failure still says what was being attempted", () => {
  assert.match(bookingWriteMessage({ code: "08006" }), /booking/i);
});

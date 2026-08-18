import assert from "node:assert/strict";
import test from "node:test";

import {
  COURT_LABEL_MAX_LENGTH,
  HOUR_TIMES,
  bookingWriteMessage,
  formatBookingWhen,
  formatCourtLabel,
  formatTimeLabel,
  parseNewBooking,
  stripCourtLabelPrefix,
} from "./bookings.ts";

const VALID = {
  org_id: "aaaa0000-0000-0000-0000-000000000001",
  court_label: "Court 3",
  date: "2026-08-20",
  start_time: "18:00",
  end_time: "19:00",
};

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

function parse(overrides: Partial<typeof VALID & { format: string }> = {}) {
  return parseNewBooking(form({ ...VALID, ...overrides }));
}

test("a court, a date and a window become a Booking", () => {
  // No zone here — the Booking's zone comes from its Org, resolved by the
  // Server Action, not from this form (issue #20).
  assert.deepEqual(parse(), {
    orgId: VALID.org_id,
    courtLabel: "Court 3",
    date: "2026-08-20",
    startTime: "18:00",
    endTime: "19:00",
    format: "doubles",
  });
});

test("a singles format is carried through", () => {
  const parsed = parse({ format: "singles" });
  assert.ok(!("error" in parsed));
  assert.equal(parsed.format, "singles");
});

test("a missing or unrecognized format defaults to doubles rather than refusing the form", () => {
  assert.ok(!("error" in parse()));
  const parsed = parse({ format: "mixed doubles" });
  assert.ok(!("error" in parsed));
  assert.equal(parsed.format, "doubles");
});

test("surrounding space is trimmed off the court label", () => {
  const parsed = parse({ court_label: "  Court 3  " });
  assert.ok(!("error" in parsed));
  assert.equal(parsed.courtLabel, "Court 3");
});

test("a Booking with no Org is refused", () => {
  assert.ok("error" in parse({ org_id: "" }));
});

test("a court is optional — a blank or omitted label becomes null, not an error", () => {
  for (const court_label of ["", "   "]) {
    const parsed = parse({ court_label });
    assert.ok(!("error" in parsed));
    assert.equal(parsed.courtLabel, null);
  }

  const withoutCourt = { ...VALID };
  delete (withoutCourt as Partial<typeof VALID>).court_label;
  const parsed = parseNewBooking(form(withoutCourt));
  assert.ok(!("error" in parsed));
  assert.equal(parsed.courtLabel, null);
});

test("a court label renders as 'Court <label>', and a missing one as a plain fallback", () => {
  assert.equal(formatCourtLabel("3"), "Court 3");
  assert.equal(formatCourtLabel(null), "No court noted");
});

test("a leading 'Court' word is stripped from a CourtReserve email's own court text", () => {
  assert.equal(stripCourtLabelPrefix("Court #6 - Hard"), "#6 - Hard");
  assert.equal(stripCourtLabelPrefix("Court 3"), "3");
  assert.equal(stripCourtLabelPrefix("COURT 3"), "3");
});

test("court text with no leading 'Court' word is left as-is", () => {
  assert.equal(stripCourtLabelPrefix("#6 - Hard"), "#6 - Hard");
});

test("a null or blank-after-stripping court label stays null", () => {
  assert.equal(stripCourtLabelPrefix(null), null);
  assert.equal(stripCourtLabelPrefix("Court"), null);
  assert.equal(stripCourtLabelPrefix("Court  "), null);
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

test("a time off the hour grid is refused", () => {
  // Courts are booked in hour-long chunks. The `<select>` in the UI physically
  // can't produce one of these, but a hand-built request could.
  for (const time of ["18:30", "18:15", "18:45", "18:01", "18:29"]) {
    assert.ok("error" in parse({ start_time: time }), `${time} should be refused`);
  }
});

test("every hour slot in a day is offered, and only those", () => {
  assert.equal(HOUR_TIMES.length, 24);
  assert.equal(HOUR_TIMES[0], "00:00");
  assert.equal(HOUR_TIMES[1], "01:00");
  assert.equal(HOUR_TIMES.at(-1), "23:00");
  for (const time of HOUR_TIMES.slice(0, -1)) {
    assert.ok(!("error" in parse({ start_time: time, end_time: "23:00" })), time);
  }
});

test("a time renders as a 12-hour label", () => {
  assert.equal(formatTimeLabel("00:00"), "12:00 AM");
  assert.equal(formatTimeLabel("06:30"), "6:30 AM");
  assert.equal(formatTimeLabel("12:00"), "12:00 PM");
  assert.equal(formatTimeLabel("18:30"), "6:30 PM");
  assert.equal(formatTimeLabel("23:30"), "11:30 PM");
});

test("a Booking cannot end before it starts, or at the moment it starts", () => {
  // The database refuses this too. Catching it here is what turns a raw
  // constraint violation into a sentence about the form the User just filled in.
  assert.ok("error" in parse({ start_time: "19:00", end_time: "18:00" }));
  assert.ok("error" in parse({ end_time: "18:00" }));
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
  // An Org's zone is guarded by its own trigger, so a row like this should not
  // exist — but a list that throws while rendering one Booking takes the whole
  // page down, and that is a worse answer than an honest fallback.
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
  assert.match(
    bookingWriteMessage({
      code: "23514",
      message: "a booking can only sit under one of your own orgs",
    }),
    /your own|belongs/i,
  );
});

test("an unexplained failure still says what was being attempted", () => {
  assert.match(bookingWriteMessage({ code: "08006" }), /booking/i);
});

test("the database's own past-time rejection (same-day, already-passed hour) reads as a friendly message", () => {
  // createBooking's own past-date check (isPastDate) is calendar-day-only,
  // so this is the one 23514 cause it cannot pre-empt itself.
  assert.match(
    bookingWriteMessage({ code: "23514", message: "a booking cannot start in the past" }),
    /already passed/,
  );
});

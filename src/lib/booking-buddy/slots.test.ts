import assert from "node:assert/strict";
import test from "node:test";

import { formatSlotWhen, parseNewSlotProposal, slotWriteMessage } from "./slots.ts";

const VALID = {
  date: "2026-08-20",
  start_time: "09:00",
  end_time: "10:00",
};

// Fixed rather than `new Date()`, so "2026-08-20" stays a valid future date
// for VALID no matter when this suite actually runs.
const NOW = new Date("2026-08-01T12:00:00Z");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

function parse(
  overrides: Partial<
    typeof VALID & { time_zone: string; division: string; org_id: string }
  > = {},
  now: Date = NOW,
) {
  return parseNewSlotProposal(form({ ...VALID, ...overrides }), now);
}

test("a date and a window become a bare-proposal Slot, defaulted to Toronto", () => {
  // No Org exists yet to read a zone off, and every early User is in
  // Toronto — the same default `parseHandNamedOrg` uses.
  assert.deepEqual(parse(), {
    date: "2026-08-20",
    startTime: "09:00",
    endTime: "10:00",
    timeZone: "America/Toronto",
    division: "open",
    orgId: null,
  });
});

test("an intended facility is honoured when picked", () => {
  const parsed = parse({ org_id: "11111111-1111-1111-1111-111111111111" });
  assert.ok(!("error" in parsed));
  assert.equal(parsed.orgId, "11111111-1111-1111-1111-111111111111");
});

test("no facility picked leaves the Slot a bare proposal, not an error", () => {
  const parsed = parse({ org_id: "" });
  assert.ok(!("error" in parsed));
  assert.equal(parsed.orgId, null);
});

test("a real division is honoured", () => {
  const parsed = parse({ division: "mixed" });
  assert.ok(!("error" in parsed));
  assert.equal(parsed.division, "mixed");
});

test("a stray or missing division falls back to open, not an error", () => {
  const parsed = parse({ division: "coed" });
  assert.ok(!("error" in parsed));
  assert.equal(parsed.division, "open");
});

test("an explicit time zone is honoured over the default", () => {
  const parsed = parse({ time_zone: "America/Vancouver" });
  assert.ok(!("error" in parsed));
  assert.equal(parsed.timeZone, "America/Vancouver");
});

test("an unknown time zone is refused before the database has to", () => {
  assert.ok("error" in parse({ time_zone: "Mars/Olympus_Mons" }));
});

test("a date that isn't a date is refused", () => {
  for (const date of ["", "20/08/2026", "2026-8-20", "2026-13-01"]) {
    assert.ok("error" in parse({ date }), `${date} should be refused`);
  }
});

test("a time off the hour grid is refused", () => {
  for (const time of ["09:30", "09:15", "09:45"]) {
    assert.ok("error" in parse({ start_time: time }), `${time} should be refused`);
  }
});

test("a Slot cannot end before it starts, or at the moment it starts", () => {
  assert.ok("error" in parse({ start_time: "10:00", end_time: "09:00" }));
  assert.ok("error" in parse({ end_time: "09:00" }));
});

test("a date already in the past is refused", () => {
  assert.ok("error" in parse({ date: "2026-07-31" }));
  assert.ok("error" in parse({ date: "2020-01-01" }));
});

test("today and later are not in the past", () => {
  assert.ok(!("error" in parse({ date: "2026-08-01" })));
  assert.ok(!("error" in parse({ date: "2026-08-20" })));
});

test("the past-date check reads the date in the resolved zone, not UTC", () => {
  // At 2026-08-01T02:00Z, it's still 2026-07-31 in Toronto (UTC-4 in
  // August) — so "2026-07-31" is today there, not yesterday.
  const earlyUtc = new Date("2026-08-01T02:00:00Z");
  assert.ok(
    !(
      "error" in
      parse({ date: "2026-07-31", start_time: "22:00", end_time: "23:00" }, earlyUtc)
    ),
  );
});

test("a check-constraint failure reads as a generic mismatch, since the form already refuses every known cause it can", () => {
  assert.match(slotWriteMessage({ code: "23514" }), /doesn't add up/);
});

test("the database's own past-time rejection (same-day, already-passed hour) reads as a friendly message", () => {
  // parseNewSlotProposal's own check is calendar-day-only, so this is the
  // one 23514 cause it cannot pre-empt itself.
  assert.match(
    slotWriteMessage({ code: "23514", message: "a slot cannot be proposed in the past" }),
    /already passed/,
  );
});

test("an unexplained failure still says what was being attempted", () => {
  assert.match(slotWriteMessage({ code: "08006" }), /slot/i);
});

test("a Slot renders in its own time zone, not the server's", () => {
  const when = formatSlotWhen({
    proposedStart: "2026-08-20T13:00:00Z",
    proposedEnd: "2026-08-20T14:30:00Z",
    timeZone: "America/Toronto",
  });

  assert.match(when, /9:00/);
  assert.match(when, /10:30/);
  assert.doesNotMatch(when, /13:00|1:00 PM/);
});

test("an unrenderable zone falls back to UTC and says so", () => {
  const when = formatSlotWhen({
    proposedStart: "2026-08-20T13:00:00Z",
    proposedEnd: "2026-08-20T14:30:00Z",
    timeZone: "Mars/Olympus_Mons",
  });

  assert.match(when, /1:00 PM/);
  assert.match(when, /UTC/);
});

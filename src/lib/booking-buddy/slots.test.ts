import assert from "node:assert/strict";
import test from "node:test";

import { formatSlotWhen, parseNewSlotProposal, slotWriteMessage } from "./slots.ts";

const VALID = {
  date: "2026-08-20",
  start_time: "09:00",
  end_time: "10:30",
};

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

function parse(overrides: Partial<typeof VALID & { time_zone: string }> = {}) {
  return parseNewSlotProposal(form({ ...VALID, ...overrides }));
}

test("a date and a window become a bare-proposal Slot, defaulted to Toronto", () => {
  // No Org exists yet to read a zone off, and every early User is in
  // Toronto — the same default `parseHandNamedOrg` uses.
  assert.deepEqual(parse(), {
    date: "2026-08-20",
    startTime: "09:00",
    endTime: "10:30",
    timeZone: "America/Toronto",
  });
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

test("a time off the half-hour grid is refused", () => {
  for (const time of ["09:15", "09:45"]) {
    assert.ok("error" in parse({ start_time: time }), `${time} should be refused`);
  }
});

test("a Slot cannot end before it starts, or at the moment it starts", () => {
  assert.ok("error" in parse({ start_time: "10:30", end_time: "09:00" }));
  assert.ok("error" in parse({ end_time: "09:00" }));
});

test("a check-constraint failure reads as a generic mismatch, since the form already refuses both known causes", () => {
  assert.match(slotWriteMessage({ code: "23514" }), /doesn't add up/);
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

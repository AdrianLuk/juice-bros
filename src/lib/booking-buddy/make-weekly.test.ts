import assert from "node:assert/strict";
import test from "node:test";

import {
  makeWeeklyHref,
  parseWeeklyPrefill,
  weeklyPrefillFromSlot,
  weeklyPrefillKey,
  type WeeklyPrefill,
} from "./make-weekly.ts";

const OWNER = "aaaaaaaa-0000-4000-8000-000000000000";
const BEN = "bbbbbbbb-0000-4000-8000-000000000001";
const CAL = "cccccccc-0000-4000-8000-000000000002";
const DEE = "dddddddd-0000-4000-8000-000000000003";
const ORG = "eeeeeeee-0000-4000-8000-000000000004";

// Tue Oct 13 2026, 8pm to 10pm in Toronto (EDT, UTC-4).
const TUESDAY_GAME = {
  proposedStart: "2026-10-14T00:00:00Z",
  proposedEnd: "2026-10-14T02:00:00Z",
  timeZone: "America/Toronto",
  division: "mixed" as const,
  intendedOrgId: ORG,
  notes: "Bring a paddle",
  rotationBuffer: 2,
  reminderOffsetMinutes: 120,
};

test("a Tuesday 8pm game in Toronto becomes a Tuesday 8pm to 10pm weekly game, not the UTC Wednesday", () => {
  const prefill = weeklyPrefillFromSlot(TUESDAY_GAME, [], OWNER);
  assert.equal(prefill.weekday, 2);
  assert.equal(prefill.startTime, "20:00");
  assert.equal(prefill.endTime, "22:00");
});

test("the weekly game keeps the game's division, facility, notes, rotation buffer and reminder", () => {
  const prefill = weeklyPrefillFromSlot(TUESDAY_GAME, [], OWNER);
  assert.equal(prefill.division, "mixed");
  assert.equal(prefill.orgId, ORG);
  assert.equal(prefill.notes, "Bring a paddle");
  assert.equal(prefill.rotationBuffer, 2);
  assert.equal(prefill.reminderOffsetMinutes, 120);
});

test("regulars are the Users who said yes: not maybes, not noes, not Guests, not the organizer", () => {
  const prefill = weeklyPrefillFromSlot(
    TUESDAY_GAME,
    [
      { userId: BEN, answer: "yes" },
      { userId: CAL, answer: "maybe" },
      { userId: DEE, answer: "no" },
      { userId: null, answer: "yes" },
      { userId: OWNER, answer: "yes" },
    ],
    OWNER,
  );
  assert.deepEqual(prefill.regularIds, [BEN]);
});

test("a game that runs past midnight keeps its late end", () => {
  // Fri Oct 16 2026, 10pm to 1am in Toronto.
  const prefill = weeklyPrefillFromSlot(
    { ...TUESDAY_GAME, proposedStart: "2026-10-17T02:00:00Z", proposedEnd: "2026-10-17T05:00:00Z" },
    [],
    OWNER,
  );
  assert.equal(prefill.weekday, 5);
  assert.equal(prefill.startTime, "22:00");
  assert.equal(prefill.endTime, "01:00");
});

const PREFILL: WeeklyPrefill = {
  weekday: 2,
  startTime: "20:00",
  endTime: "22:00",
  division: "mixed",
  orgId: ORG,
  notes: "Bring a paddle & balls",
  rotationBuffer: 2,
  reminderOffsetMinutes: 120,
  regularIds: [BEN, CAL],
};

function paramsOf(href: string): Record<string, string> {
  const url = new URL(href, "https://example.test");
  return Object.fromEntries(url.searchParams.entries());
}

const KNOWN = { orgIds: [ORG], friendIds: [BEN, CAL, DEE] };

test("the link opens the Post a game form", () => {
  const url = new URL(makeWeeklyHref(PREFILL), "https://example.test");
  assert.equal(url.pathname, "/booking-buddy/slots");
  assert.equal(url.hash, "#post-a-game");
});

test("the link's search params read back as the same prefill", () => {
  assert.deepEqual(parseWeeklyPrefill(paramsOf(makeWeeklyHref(PREFILL)), KNOWN), PREFILL);
});

test("an ordinary visit or a Find a time link is not a weekly prefill", () => {
  assert.equal(parseWeeklyPrefill({}, KNOWN), null);
  assert.equal(parseWeeklyPrefill({ date: "2026-10-13", start: "20:00", end: "22:00" }, KNOWN), null);
});

test("a weekly link with no usable day or hours is ignored", () => {
  const params = paramsOf(makeWeeklyHref(PREFILL));
  assert.equal(parseWeeklyPrefill({ ...params, weekday: "7" }, KNOWN), null);
  assert.equal(parseWeeklyPrefill({ ...params, start: "20:30" }, KNOWN), null);
  assert.equal(parseWeeklyPrefill({ ...params, end: "20:00" }, KNOWN), null);
});

test("regulars who are no longer friends, and facilities that aren't yours, drop out of the prefill", () => {
  const prefill = parseWeeklyPrefill(paramsOf(makeWeeklyHref(PREFILL)), {
    orgIds: [],
    friendIds: [CAL],
  });
  assert.equal(prefill?.orgId, null);
  assert.deepEqual(prefill?.regularIds, [CAL]);
});

test("a tampered division, buffer or reminder falls back to the form's defaults", () => {
  const params = paramsOf(makeWeeklyHref(PREFILL));
  const prefill = parseWeeklyPrefill(
    { ...params, division: "pairs", buffer: "99", reminder: "-5" },
    KNOWN,
  );
  assert.equal(prefill?.division, "open");
  assert.equal(prefill?.rotationBuffer, 0);
  assert.equal(prefill?.reminderOffsetMinutes, 60);
});

test("two different games give two different form keys", () => {
  assert.notEqual(weeklyPrefillKey(PREFILL), weeklyPrefillKey({ ...PREFILL, weekday: 4 }));
  assert.notEqual(weeklyPrefillKey(PREFILL), weeklyPrefillKey({ ...PREFILL, regularIds: [BEN] }));
  assert.equal(weeklyPrefillKey(PREFILL), weeklyPrefillKey({ ...PREFILL }));
});

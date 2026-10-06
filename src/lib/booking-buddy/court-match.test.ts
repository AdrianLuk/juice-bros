import assert from "node:assert/strict";
import test from "node:test";

import {
  courtMatches,
  type MatchableBooking,
  type MatchableSlot,
} from "./court-match.ts";

// Tue Oct 13 2026, 8pm to 10pm in Toronto (EDT, UTC-4).
function tuesday8pm(overrides: Partial<MatchableSlot> = {}): MatchableSlot {
  return {
    standingGameId: "sg-1",
    intendedOrgId: "org-kanata",
    proposedStart: "2026-10-14T00:00:00.000Z",
    proposedEnd: "2026-10-14T02:00:00.000Z",
    hasBooking: false,
    ...overrides,
  };
}

function booking(overrides: Partial<MatchableBooking> & { id: string }): MatchableBooking {
  return {
    orgId: "org-kanata",
    startsAt: "2026-10-14T00:00:00.000Z",
    endsAt: "2026-10-14T02:00:00.000Z",
    attached: false,
    ...overrides,
  };
}

const ids = (matches: readonly { id: string }[]) => matches.map((match) => match.id);

test("an unattached Booking at the same Org over the same hours is offered", () => {
  assert.deepEqual(ids(courtMatches(tuesday8pm(), [booking({ id: "court-3" })])), ["court-3"]);
});

test("a Booking ending right as the game starts, or starting right as it ends, is not this game's court", () => {
  const before = booking({ id: "6-to-8", startsAt: "2026-10-13T22:00:00.000Z", endsAt: "2026-10-14T00:00:00.000Z" });
  const after = booking({ id: "10-to-11", startsAt: "2026-10-14T02:00:00.000Z", endsAt: "2026-10-14T03:00:00.000Z" });
  assert.deepEqual(courtMatches(tuesday8pm(), [before, after]), []);
});

test("a Booking overlapping only part of the game still matches", () => {
  const sevenToNine = booking({ id: "7-to-9", startsAt: "2026-10-13T23:00:00.000Z", endsAt: "2026-10-14T01:00:00.000Z" });
  const nineThirtyToEleven = booking({ id: "9:30-to-11", startsAt: "2026-10-14T01:30:00.000Z", endsAt: "2026-10-14T03:00:00.000Z" });
  assert.deepEqual(ids(courtMatches(tuesday8pm(), [sevenToNine, nineThirtyToEleven])), ["7-to-9", "9:30-to-11"]);
});

test("a game running past midnight matches a Booking on the next calendar day", () => {
  // Tue 10pm to Wed 1am in Toronto.
  const lateGame = tuesday8pm({ proposedStart: "2026-10-14T02:00:00.000Z", proposedEnd: "2026-10-14T05:00:00.000Z" });
  const afterMidnight = booking({ id: "wed-12-to-1", startsAt: "2026-10-14T04:00:00.000Z", endsAt: "2026-10-14T05:00:00.000Z" });
  const wednesdayNight = booking({ id: "wed-10pm", startsAt: "2026-10-15T02:00:00.000Z", endsAt: "2026-10-15T04:00:00.000Z" });
  assert.deepEqual(ids(courtMatches(lateGame, [afterMidnight, wednesdayNight])), ["wed-12-to-1"]);
});

test("a Booking at a different Org is not offered", () => {
  assert.deepEqual(courtMatches(tuesday8pm(), [booking({ id: "elsewhere", orgId: "org-nepean" })]), []);
});

test("a Booking already attached to another game is not offered", () => {
  assert.deepEqual(courtMatches(tuesday8pm(), [booking({ id: "taken", attached: true })]), []);
});

test("a game that already has a Booking gets no suggestion", () => {
  assert.deepEqual(courtMatches(tuesday8pm({ hasBooking: true }), [booking({ id: "court-3" })]), []);
});

test("a game with no Intended Org gets no suggestion", () => {
  assert.deepEqual(courtMatches(tuesday8pm({ intendedOrgId: null }), [booking({ id: "court-3" })]), []);
});

test("a one-off game gets no suggestion, only a Standing Game's posted game", () => {
  assert.deepEqual(courtMatches(tuesday8pm({ standingGameId: null }), [booking({ id: "court-3" })]), []);
});

test("several matches are all offered, soonest first, with the taken one left out", () => {
  const matches = courtMatches(tuesday8pm(), [
    booking({ id: "court-4-at-9", startsAt: "2026-10-14T01:00:00.000Z" }),
    booking({ id: "court-2-taken", attached: true }),
    booking({ id: "court-3-at-8" }),
  ]);
  assert.deepEqual(ids(matches), ["court-3-at-8", "court-4-at-9"]);
});

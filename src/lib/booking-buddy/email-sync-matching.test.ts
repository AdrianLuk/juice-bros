import assert from "node:assert/strict";
import test from "node:test";

import {
  isDuplicateBooking,
  isPastConfirmation,
  matchOrgByExactName,
  matchPlayerNamesToConnections,
} from "./email-sync-matching.ts";

test("an exact facility-name match resolves to that Org's id", () => {
  const orgs = [
    { orgId: "org-1", displayName: "PicklePlex Downsview" },
    { orgId: "org-2", displayName: "Vaughan Pickleball" },
  ];

  assert.equal(matchOrgByExactName("PicklePlex Downsview", orgs), "org-1");
});

test("a facility name that only differs in case is not a match — exact, not case-folded", () => {
  const orgs = [{ orgId: "org-1", displayName: "PicklePlex Downsview" }];
  assert.equal(matchOrgByExactName("pickleplex downsview", orgs), null);
});

test("a facility name with no matching Org resolves to null", () => {
  const orgs = [{ orgId: "org-1", displayName: "PicklePlex Downsview" }];
  assert.equal(matchOrgByExactName("Some Other Club", orgs), null);
});

test("surrounding whitespace on either side doesn't defeat an otherwise-exact match", () => {
  const orgs = [{ orgId: "org-1", displayName: "  PicklePlex Downsview  " }];
  assert.equal(matchOrgByExactName("PicklePlex Downsview", orgs), "org-1");
});

const SAME_SLOT = { orgId: "org-1", courtLabel: "Court 3", date: "2026-09-15", startTime: "18:00" };

test("a candidate matching Org + court + date/time on an existing Booking is a duplicate", () => {
  assert.equal(isDuplicateBooking(SAME_SLOT, [SAME_SLOT]), true);
});

test("a different court is not a duplicate, even at the same Org/date/time", () => {
  const existing = { ...SAME_SLOT, courtLabel: "Court 4" };
  assert.equal(isDuplicateBooking(SAME_SLOT, [existing]), false);
});

test("a different date is not a duplicate", () => {
  const existing = { ...SAME_SLOT, date: "2026-09-16" };
  assert.equal(isDuplicateBooking(SAME_SLOT, [existing]), false);
});

test("a different start time is not a duplicate", () => {
  const existing = { ...SAME_SLOT, startTime: "19:00" };
  assert.equal(isDuplicateBooking(SAME_SLOT, [existing]), false);
});

test("a different Org is not a duplicate, even with everything else matching", () => {
  const existing = { ...SAME_SLOT, orgId: "org-2" };
  assert.equal(isDuplicateBooking(SAME_SLOT, [existing]), false);
});

test("a null courtLabel on both sides still counts as matching, not as two different unlabeled courts", () => {
  const candidate = { ...SAME_SLOT, courtLabel: null };
  const existing = { ...SAME_SLOT, courtLabel: null };
  assert.equal(isDuplicateBooking(candidate, [existing]), true);
});

test("no existing Bookings at all is never a duplicate", () => {
  assert.equal(isDuplicateBooking(SAME_SLOT, []), false);
});

test("a listed player matching a Connection's display name resolves to their user id", () => {
  const connections = [{ userId: "user-1", displayName: "Ben Backhand" }];
  const result = matchPlayerNamesToConnections(["Amy Ace", "Ben Backhand"], connections);

  assert.deepEqual(result, [
    { name: "Amy Ace", userId: null },
    { name: "Ben Backhand", userId: "user-1" },
  ]);
});

test("matching is case-insensitive and trims whitespace, since email formatting isn't the Connection's own", () => {
  const connections = [{ userId: "user-1", displayName: "Ben Backhand" }];
  const result = matchPlayerNamesToConnections(["  ben backhand  "], connections);

  assert.deepEqual(result, [{ name: "  ben backhand  ", userId: "user-1" }]);
});

test("an empty player list produces an empty result, not an error", () => {
  assert.deepEqual(matchPlayerNamesToConnections([], [{ userId: "user-1", displayName: "Ben" }]), []);
});

test("two Connections sharing a display name resolve a matching name to the first, not a crash", () => {
  const connections = [
    { userId: "user-1", displayName: "Amy Ace" },
    { userId: "user-2", displayName: "Amy Ace" },
  ];
  const result = matchPlayerNamesToConnections(["Amy Ace"], connections);

  assert.deepEqual(result, [{ name: "Amy Ace", userId: "user-1" }]);
});

test("a confirmation dated before today in its own zone is past", () => {
  const now = new Date("2026-09-20T12:00:00Z");
  assert.equal(isPastConfirmation({ date: "2026-09-15" }, "America/Toronto", now), true);
});

test("a confirmation dated today or later is not past", () => {
  const now = new Date("2026-09-15T12:00:00Z");
  assert.equal(isPastConfirmation({ date: "2026-09-15" }, "America/Toronto", now), false);
  assert.equal(isPastConfirmation({ date: "2026-09-16" }, "America/Toronto", now), false);
});

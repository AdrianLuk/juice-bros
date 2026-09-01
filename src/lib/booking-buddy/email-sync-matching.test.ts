import assert from "node:assert/strict";
import test from "node:test";

import {
  diffBookingPlayers,
  matchCancellationToBooking,
  matchOrgByName,
  matchPlayerNamesToConnections,
  matchUpdateToBooking,
  reconcileCourtReserveEvents,
  type ReconciliationEvent,
} from "./email-sync-matching.ts";

test("an exact facility-name match resolves to that Org's id", () => {
  const orgs = [
    { orgId: "org-1", displayName: "PicklePlex Downsview" },
    { orgId: "org-2", displayName: "Vaughan Pickleball" },
  ];

  assert.equal(matchOrgByName("PicklePlex Downsview", orgs), "org-1");
});

test("a facility name that only differs in case still matches — case-folded", () => {
  const orgs = [{ orgId: "org-1", displayName: "PicklePlex Downsview" }];
  assert.equal(matchOrgByName("pickleplex downsview", orgs), "org-1");
});

test("a facility name that only differs by a separator (hyphen vs space) still matches", () => {
  const orgs = [{ orgId: "org-1", displayName: "HISPORTS Stouffville" }];
  assert.equal(matchOrgByName("HISPORTS - Stouffville", orgs), "org-1");
});

test("extra or repeated punctuation/whitespace doesn't defeat a match", () => {
  const orgs = [{ orgId: "org-1", displayName: "HISPORTS Stouffville" }];
  assert.equal(matchOrgByName("HISPORTS  --  Stouffville,", orgs), "org-1");
});

test("a facility name with no matching Org resolves to null", () => {
  const orgs = [{ orgId: "org-1", displayName: "PicklePlex Downsview" }];
  assert.equal(matchOrgByName("Some Other Club", orgs), null);
});

test("surrounding whitespace on either side doesn't defeat an otherwise-exact match", () => {
  const orgs = [{ orgId: "org-1", displayName: "  PicklePlex Downsview  " }];
  assert.equal(matchOrgByName("PicklePlex Downsview", orgs), "org-1");
});

// `isDuplicateBooking` / `isPastConfirmation` moved to
// `import-candidate-shaping.ts` (#288); their tests moved with them to
// `import-candidate-shaping.test.ts`.

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

test("two Connections sharing a display name resolve the matching name unlinked, not guessed at (ADR 0011)", () => {
  const connections = [
    { userId: "user-1", displayName: "Amy Ace" },
    { userId: "user-2", displayName: "Amy Ace" },
  ];
  const result = matchPlayerNamesToConnections(["Amy Ace"], connections);

  assert.deepEqual(result, [{ name: "Amy Ace", userId: null }]);
});

test("a name that still appears among the existing Players is kept — its row untouched, no match needed", () => {
  const existing = [{ id: "row-1", name: "Amy Ace", userId: "user-1" }];
  const result = diffBookingPlayers(["Amy Ace"], existing);

  assert.deepEqual(result, { keepIds: ["row-1"], toMatch: [], removeIds: [] });
});

test("a name with no matching existing Player is new or edited, and needs matching", () => {
  const result = diffBookingPlayers(["Cal Crosscourt"], []);

  assert.deepEqual(result, { keepIds: [], toMatch: ["Cal Crosscourt"], removeIds: [] });
});

test("an existing Player dropped from the submitted list is marked for removal", () => {
  const existing = [
    { id: "row-1", name: "Amy Ace", userId: "user-1" },
    { id: "row-2", name: "Ben Backhand", userId: "user-2" },
  ];
  const result = diffBookingPlayers(["Amy Ace"], existing);

  assert.deepEqual(result, { keepIds: ["row-1"], toMatch: [], removeIds: ["row-2"] });
});

test("an unlinked existing Player's row is still just kept when its name is unchanged, not re-matched", () => {
  const existing = [{ id: "row-1", name: "Amy Ace", userId: null }];
  const result = diffBookingPlayers(["Amy Ace"], existing);

  assert.deepEqual(result, { keepIds: ["row-1"], toMatch: [], removeIds: [] });
});

test("a mix of unchanged, new and dropped names sorts into the right groups", () => {
  const existing = [
    { id: "row-1", name: "Amy Ace", userId: "user-1" },
    { id: "row-2", name: "Ben Backhand", userId: null },
  ];
  const result = diffBookingPlayers(["Amy Ace", "Cal Crosscourt"], existing);

  assert.deepEqual(result, {
    keepIds: ["row-1"],
    toMatch: ["Cal Crosscourt"],
    removeIds: ["row-2"],
  });
});

test("duplicate names pair off one-for-one with existing rows, in the order given — extras need matching, not the same link twice", () => {
  const existing = [{ id: "row-1", name: "Amy Ace", userId: "user-1" }];
  const result = diffBookingPlayers(["Amy Ace", "Amy Ace"], existing);

  assert.deepEqual(result, { keepIds: ["row-1"], toMatch: ["Amy Ace"], removeIds: [] });
});

test("a submitted list shorter than the existing duplicates keeps the earliest-ordered rows and removes the rest", () => {
  const existing = [
    { id: "row-1", name: "Amy Ace", userId: "user-1" },
    { id: "row-2", name: "Amy Ace", userId: null },
  ];
  const result = diffBookingPlayers(["Amy Ace"], existing);

  assert.deepEqual(result, { keepIds: ["row-1"], toMatch: [], removeIds: ["row-2"] });
});

test("an empty submitted list needs no matching and marks every existing Player for removal", () => {
  const existing = [{ id: "row-1", name: "Amy Ace", userId: "user-1" }];
  const result = diffBookingPlayers([], existing);

  assert.deepEqual(result, { keepIds: [], toMatch: [], removeIds: ["row-1"] });
});

const CANCELLED_SLOT = { orgId: "org-1", date: "2026-09-15", startTime: "18:00" };

test("a cancellation matching Org + date/time on an existing Booking resolves to that Booking's id", () => {
  const existing = { ...CANCELLED_SLOT, id: "booking-1" };
  assert.equal(matchCancellationToBooking(CANCELLED_SLOT, [existing]), "booking-1");
});

test("a cancellation matches even when the existing Booking has a real court label — courtLabel isn't part of the match", () => {
  const existing = { ...CANCELLED_SLOT, id: "booking-1", courtLabel: "3" };
  assert.equal(matchCancellationToBooking(CANCELLED_SLOT, [existing]), "booking-1");
});

test("a different date is not a match", () => {
  const existing = { ...CANCELLED_SLOT, date: "2026-09-16", id: "booking-1" };
  assert.equal(matchCancellationToBooking(CANCELLED_SLOT, [existing]), null);
});

test("a different start time is not a match", () => {
  const existing = { ...CANCELLED_SLOT, startTime: "19:00", id: "booking-1" };
  assert.equal(matchCancellationToBooking(CANCELLED_SLOT, [existing]), null);
});

test("a different Org is not a match, even with everything else matching", () => {
  const existing = { ...CANCELLED_SLOT, orgId: "org-2", id: "booking-1" };
  assert.equal(matchCancellationToBooking(CANCELLED_SLOT, [existing]), null);
});

test("no existing Bookings at all resolves to no match", () => {
  assert.equal(matchCancellationToBooking(CANCELLED_SLOT, []), null);
});

test("two Bookings at the same Org/date/start-time (different courts) resolve to no match, not a guess", () => {
  const existing = [
    { ...CANCELLED_SLOT, id: "booking-1", courtLabel: "3" },
    { ...CANCELLED_SLOT, id: "booking-2", courtLabel: "4" },
  ];
  assert.equal(matchCancellationToBooking(CANCELLED_SLOT, existing), null);
});

test("an update matching Org + date/time on an existing Booking resolves to that Booking's id, even when its own court label differs — a genuine court change is still applicable", () => {
  const existing = { ...CANCELLED_SLOT, id: "booking-1", courtLabel: "3" };
  assert.equal(matchUpdateToBooking({ ...CANCELLED_SLOT }, [existing]), "booking-1");
});

test("an update with a different date is not a match", () => {
  const existing = { ...CANCELLED_SLOT, date: "2026-09-16", id: "booking-1" };
  assert.equal(matchUpdateToBooking(CANCELLED_SLOT, [existing]), null);
});

test("an update with a different Org is not a match, even with everything else matching", () => {
  const existing = { ...CANCELLED_SLOT, orgId: "org-2", id: "booking-1" };
  assert.equal(matchUpdateToBooking(CANCELLED_SLOT, [existing]), null);
});

test("no existing Bookings at all resolves an update to no match", () => {
  assert.equal(matchUpdateToBooking(CANCELLED_SLOT, []), null);
});

test("two Bookings at the same Org/date/start-time (different courts) resolve an update to no match, not a guess", () => {
  const existing = [
    { ...CANCELLED_SLOT, id: "booking-1", courtLabel: "3" },
    { ...CANCELLED_SLOT, id: "booking-2", courtLabel: "4" },
  ];
  assert.equal(matchUpdateToBooking(CANCELLED_SLOT, existing), null);
});

const SLOT = { facilityName: "HISPORTS - Stouffville", date: "2026-08-21", startTime: "18:00" };

function confirmEvent(
  gmailMessageId: string,
  receivedAt: number,
  players: string[],
): ReconciliationEvent<{ playerNames: string[] }> {
  return { kind: "confirmation", gmailMessageId, receivedAt, ...SLOT, confirmation: { playerNames: players } };
}

function cancelEvent(gmailMessageId: string, receivedAt: number): ReconciliationEvent<{ playerNames: string[] }> {
  return { kind: "cancellation", gmailMessageId, receivedAt, ...SLOT, courtLabel: null };
}

function updateEvent(
  gmailMessageId: string,
  receivedAt: number,
  players: string[],
): ReconciliationEvent<{ playerNames: string[] }> {
  return { kind: "update", gmailMessageId, receivedAt, ...SLOT, update: { playerNames: players } };
}

test("a lone confirmation with nothing to net against survives reconciliation untouched", () => {
  const result = reconcileCourtReserveEvents([confirmEvent("confirm-1", 1, ["Amy"])]);
  assert.equal(result.confirmations.length, 1);
  assert.equal(result.confirmations[0].gmailMessageId, "confirm-1");
  assert.deepEqual(result.cancellations, []);
});

test("a lone cancellation with nothing to net against falls through untouched", () => {
  const result = reconcileCourtReserveEvents([cancelEvent("cancel-1", 1)]);
  assert.deepEqual(result.confirmations, []);
  assert.equal(result.cancellations.length, 1);
  assert.equal(result.cancellations[0].gmailMessageId, "cancel-1");
});

test("a confirm immediately followed by its own cancel nets to nothing", () => {
  const result = reconcileCourtReserveEvents([confirmEvent("confirm-1", 1, ["Amy"]), cancelEvent("cancel-1", 2)]);
  assert.deepEqual(result.confirmations, []);
  assert.deepEqual(result.cancellations, []);
});

test("a real confirm/cancel/confirm/cancel/confirm chain nets down to the final confirmation only", () => {
  // The exact shape a User's own reservation edits produce: every add/remove
  // of a player resends a cancellation and a fresh confirmation for the same
  // slot. Deliberately passed out of chronological order — reconciliation
  // sorts by `receivedAt`, not array order.
  const events = [
    confirmEvent("confirm-3", 5, ["Alice", "Sam", "Adrian", "Janice", "Calvin"]),
    cancelEvent("cancel-1", 2),
    confirmEvent("confirm-1", 1, ["Alice", "Adrian", "Sam", "Calvin"]),
    confirmEvent("confirm-2", 3, ["Alice", "Sam", "Adrian", "Calvin"]),
    cancelEvent("cancel-2", 4),
  ];

  const result = reconcileCourtReserveEvents(events);

  assert.equal(result.confirmations.length, 1);
  assert.equal(result.confirmations[0].gmailMessageId, "confirm-3");
  assert.deepEqual(result.confirmations[0].confirmation.playerNames, [
    "Alice",
    "Sam",
    "Adrian",
    "Janice",
    "Calvin",
  ]);
  assert.deepEqual(result.cancellations, []);
});

test("a cancellation with two equally plausible active confirmations doesn't guess which one to net", () => {
  const events = [confirmEvent("confirm-1", 1, ["Amy"]), confirmEvent("confirm-2", 2, ["Ben"]), cancelEvent("cancel-1", 3)];

  const result = reconcileCourtReserveEvents(events);

  assert.equal(result.confirmations.length, 2);
  assert.equal(result.cancellations.length, 1);
  assert.equal(result.cancellations[0].gmailMessageId, "cancel-1");
});

test("a lone update with nothing to net against falls through untouched, same posture as a lone cancellation", () => {
  const result = reconcileCourtReserveEvents([updateEvent("update-1", 1, ["Amy"])]);
  assert.deepEqual(result.confirmations, []);
  assert.deepEqual(result.cancellations, []);
  assert.equal(result.updates.length, 1);
  assert.equal(result.updates[0].gmailMessageId, "update-1");
});

test("an update immediately following its own confirmation nets into a single confirmation carrying the update's own fields and message id", () => {
  const result = reconcileCourtReserveEvents([
    confirmEvent("confirm-1", 1, ["Amy"]),
    updateEvent("update-1", 2, ["Amy", "Ben"]),
  ]);

  assert.equal(result.confirmations.length, 1);
  assert.equal(result.confirmations[0].gmailMessageId, "update-1");
  assert.deepEqual(result.confirmations[0].confirmation.playerNames, ["Amy", "Ben"]);
  assert.deepEqual(result.cancellations, []);
  assert.deepEqual(result.updates, []);
});

test("a confirm/update/update chain nets down to the last update's own fields only", () => {
  const result = reconcileCourtReserveEvents([
    confirmEvent("confirm-1", 1, ["Amy"]),
    updateEvent("update-1", 2, ["Amy", "Ben"]),
    updateEvent("update-2", 3, ["Amy", "Ben", "Cara"]),
  ]);

  assert.equal(result.confirmations.length, 1);
  assert.equal(result.confirmations[0].gmailMessageId, "update-2");
  assert.deepEqual(result.confirmations[0].confirmation.playerNames, ["Amy", "Ben", "Cara"]);
  assert.deepEqual(result.updates, []);
});

test("an update with two equally plausible active confirmations doesn't guess which one to net, same refusal a cancellation already has", () => {
  const events = [confirmEvent("confirm-1", 1, ["Amy"]), confirmEvent("confirm-2", 2, ["Ben"]), updateEvent("update-1", 3, ["Cara"])];

  const result = reconcileCourtReserveEvents(events);

  assert.equal(result.confirmations.length, 2);
  assert.equal(result.updates.length, 1);
  assert.equal(result.updates[0].gmailMessageId, "update-1");
});

test("an update with zero active confirmations (already confirmed in an earlier sync) is left for the caller's own matching, not silently dropped", () => {
  const result = reconcileCourtReserveEvents([updateEvent("update-1", 1, ["Amy", "Ben"])]);
  assert.equal(result.updates.length, 1);
  assert.deepEqual(result.updates[0].update.playerNames, ["Amy", "Ben"]);
});

test("a different date/time is its own group, entirely unaffected by another slot's chain", () => {
  const otherSlot = { ...SLOT, startTime: "20:00" };
  const events: ReconciliationEvent<{ playerNames: string[] }>[] = [
    confirmEvent("confirm-1", 1, ["Amy"]),
    cancelEvent("cancel-1", 2),
    { kind: "confirmation", gmailMessageId: "confirm-2", receivedAt: 1, ...otherSlot, confirmation: { playerNames: ["Ben"] } },
  ];

  const result = reconcileCourtReserveEvents(events);

  assert.equal(result.confirmations.length, 1);
  assert.equal(result.confirmations[0].gmailMessageId, "confirm-2");
  assert.deepEqual(result.cancellations, []);
});

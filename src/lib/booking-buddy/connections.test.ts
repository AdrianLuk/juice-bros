import assert from "node:assert/strict";
import test from "node:test";

import { groupConnections, personLabel, type ConnectionRow } from "./connections.ts";

const ME = "11111111-1111-1111-1111-111111111111";
const AMY = "22222222-2222-2222-2222-222222222222";
const BEN = "33333333-3333-3333-3333-333333333333";

function row(overrides: Partial<ConnectionRow>): ConnectionRow {
  return {
    id: "c-1",
    requester_id: ME,
    addressee_id: AMY,
    status: "pending",
    created_at: "2026-08-14T00:00:00Z",
    ...overrides,
  };
}

test("an accepted Connection is a friend whichever side asked", () => {
  const iAsked = row({ id: "c-1", status: "accepted" });
  const theyAsked = row({
    id: "c-2",
    status: "accepted",
    requester_id: BEN,
    addressee_id: ME,
  });

  const grouped = groupConnections([iAsked, theyAsked], ME);

  assert.deepEqual(
    grouped.friends.map((entry) => entry.otherUserId).sort(),
    [AMY, BEN].sort(),
  );
  assert.equal(grouped.received.length, 0);
  assert.equal(grouped.sent.length, 0);
});

test("a pending request I received is separate from one I sent", () => {
  const grouped = groupConnections(
    [
      row({ id: "sent", requester_id: ME, addressee_id: AMY }),
      row({ id: "received", requester_id: BEN, addressee_id: ME }),
    ],
    ME,
  );

  assert.deepEqual(
    grouped.sent.map((entry) => entry.connectionId),
    ["sent"],
  );
  assert.deepEqual(
    grouped.received.map((entry) => entry.connectionId),
    ["received"],
  );
});

test("a Connection the viewer is not party to is dropped", () => {
  // RLS should never hand one over (see the connections migration), so this is
  // belt-and-braces: a bug there must not surface someone else's friendships.
  const grouped = groupConnections(
    [row({ requester_id: AMY, addressee_id: BEN, status: "accepted" })],
    ME,
  );

  assert.deepEqual(grouped, { friends: [], received: [], sent: [] });
});

test("each bucket is newest first", () => {
  const grouped = groupConnections(
    [
      row({ id: "old", addressee_id: AMY, created_at: "2026-08-01T00:00:00Z" }),
      row({ id: "new", addressee_id: BEN, created_at: "2026-08-13T00:00:00Z" }),
    ],
    ME,
  );

  assert.deepEqual(
    grouped.sent.map((entry) => entry.connectionId),
    ["new", "old"],
  );
});

test("a person is labelled by display name when they have one", () => {
  assert.equal(personLabel({ displayName: "Amy Ace", username: "amyace" }), "Amy Ace");
});

test("a person with no display name falls back to their username", () => {
  // Every User gets a username at signup, so this is the normal magic-link
  // case rather than an edge case.
  assert.equal(personLabel({ displayName: null, username: "amyace" }), "amyace");
});

test("a person with neither is still named, never blank", () => {
  assert.equal(personLabel({ displayName: null, username: null }), "A Booking Buddy user");
});

test("a blank display name is treated as absent", () => {
  assert.equal(personLabel({ displayName: "   ", username: "amyace" }), "amyace");
});

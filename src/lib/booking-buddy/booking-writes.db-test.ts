import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { applyBookingUpdate, editBooking, insertBooking, removeBooking } from "./booking-writes.ts";
import type { NewBooking } from "./bookings.ts";
import {
  connect,
  createOrg,
  createTestUser,
  dateInDays,
  deleteTestUser,
  type TestUser,
} from "./db-test-support.ts";

let owner: TestUser;
let friend: TestUser;
let orgId: string;

before(async () => {
  owner = await createTestUser("Settle Owner");
  friend = await createTestUser("Ben Johns");
  await connect(owner, friend);
  orgId = await createOrg(owner, "America/Toronto");
});

after(async () => {
  await Promise.all([owner && deleteTestUser(owner), friend && deleteTestUser(friend)]);
});

function booking(overrides: Partial<NewBooking> = {}): NewBooking {
  return {
    orgId,
    courtLabel: "#9",
    name: "Doubles",
    notes: null,
    date: dateInDays(30),
    startTime: "18:00",
    endTime: "20:00",
    format: "doubles",
    players: [],
    ...overrides,
  };
}

test("inserting a Booking writes it in the Org's own zone", async () => {
  const date = dateInDays(31);
  const result = await insertBooking(owner.supabase, owner.userId, booking({ date }));
  assert.ok("bookingId" in result, JSON.stringify(result));
  assert.equal(result.playersError, null);

  const { data } = await owner.supabase
    .from("bookings")
    .select("org_id, court_label, starts_at, ends_at, format, name")
    .eq("id", result.bookingId)
    .single();

  assert.equal(data?.org_id, orgId);
  assert.equal(data?.court_label, "#9");
  assert.equal(data?.format, "doubles");
  // 18:00 in Toronto is 22:00 UTC in daylight time, 23:00 in standard time.
  const startsAt = new Date(data?.starts_at);
  const endsAt = new Date(data?.ends_at);
  assert.ok([22, 23].includes(startsAt.getUTCHours()), data?.starts_at);
  assert.equal(endsAt.getTime() - startsAt.getTime(), 2 * 60 * 60 * 1000);
});

async function playersOf(bookingId: string) {
  const { data } = await owner.supabase
    .from("booking_players")
    .select("name, connection_user_id")
    .eq("booking_id", bookingId)
    .order("name");
  return data ?? [];
}

test("a Player named like one of the caller's Connections is linked to them", async () => {
  const result = await insertBooking(
    owner.supabase,
    owner.userId,
    booking({ date: dateInDays(32), players: ["Ben Johns", "Anna Leigh Waters"] }),
  );
  assert.ok("bookingId" in result, JSON.stringify(result));

  assert.deepEqual(await playersOf(result.bookingId), [
    { name: "Anna Leigh Waters", connection_user_id: null },
    { name: "Ben Johns", connection_user_id: friend.userId },
  ]);
});

test("a session past midnight ends on the next calendar day", async () => {
  const result = await insertBooking(
    owner.supabase,
    owner.userId,
    booking({ date: dateInDays(33), startTime: "22:00", endTime: "01:00" }),
  );
  assert.ok("bookingId" in result, JSON.stringify(result));

  const { data } = await owner.supabase
    .from("bookings")
    .select("starts_at, ends_at")
    .eq("id", result.bookingId)
    .single();
  const hours = (new Date(data?.ends_at).getTime() - new Date(data?.starts_at).getTime()) / 3_600_000;
  assert.equal(hours, 3);
});

test("a Booking under someone else's Org is refused", async () => {
  const theirOrg = await createOrg(friend);
  const result = await insertBooking(owner.supabase, owner.userId, booking({ orgId: theirOrg }));
  assert.deepEqual(result, { error: "Pick one of your own places." });
});

test("a Booking on a date already past is refused", async () => {
  const result = await insertBooking(owner.supabase, owner.userId, booking({ date: dateInDays(-3) }));
  assert.deepEqual(result, { error: "That date has already passed. Pick a date in the future." });
});

test("editing a Booking rewrites it and keeps an unchanged Player's link", async () => {
  const created = await insertBooking(
    owner.supabase,
    owner.userId,
    booking({ date: dateInDays(34), players: ["Ben Johns"] }),
  );
  assert.ok("bookingId" in created, JSON.stringify(created));

  const edited = await editBooking(
    owner.supabase,
    owner.userId,
    created.bookingId,
    booking({ date: dateInDays(34), courtLabel: "#4", name: "Rematch", players: ["Ben Johns", "Tyson McGuffin"] }),
  );
  assert.deepEqual(edited, { bookingId: created.bookingId, playersError: null });

  const { data } = await owner.supabase
    .from("bookings")
    .select("court_label, name")
    .eq("id", created.bookingId)
    .single();
  assert.deepEqual(data, { court_label: "#4", name: "Rematch" });
  assert.deepEqual(await playersOf(created.bookingId), [
    { name: "Ben Johns", connection_user_id: friend.userId },
    { name: "Tyson McGuffin", connection_user_id: null },
  ]);
});

test("applying an update with no Players leaves the Booking's Players alone", async () => {
  const created = await insertBooking(
    owner.supabase,
    owner.userId,
    booking({ date: dateInDays(35), players: ["Ben Johns"] }),
  );
  assert.ok("bookingId" in created, JSON.stringify(created));

  const applied = await applyBookingUpdate(owner.supabase, owner.userId, {
    bookingId: created.bookingId,
    courtLabel: "#2",
    notes: null,
    date: dateInDays(35),
    startTime: "19:00",
    endTime: "21:00",
    format: "singles",
    players: [],
  });
  assert.deepEqual(applied, { bookingId: created.bookingId, playersError: null });

  const { data } = await owner.supabase
    .from("bookings")
    .select("court_label, format")
    .eq("id", created.bookingId)
    .single();
  assert.deepEqual(data, { court_label: "#2", format: "singles" });
  assert.equal((await playersOf(created.bookingId)).length, 1);
});

test("removing a Booking deletes it, and removing it again is an error", async () => {
  const created = await insertBooking(owner.supabase, owner.userId, booking({ date: dateInDays(36) }));
  assert.ok("bookingId" in created, JSON.stringify(created));

  assert.deepEqual(await removeBooking(owner.supabase, created.bookingId), { ok: true });
  assert.deepEqual(await removeBooking(owner.supabase, created.bookingId), {
    error: "Couldn't remove that booking. Try again.",
  });
});

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { serviceRoleClient } from "../../db-test-support.ts";
import { createTestUser, dateInDays, deleteTestUser, type TestUser } from "../db-test-support.ts";
import {
  bookingWindowReminderLog,
  pruneSubscription,
  slotUserChannelLog,
  supabaseAddressLookup,
} from "./supabase-adapters.ts";

// The adapters run with the admin client in production (the `*_sends` tables
// are service_role-only), so they do here too. The test Users only seed.
const admin = serviceRoleClient();

let ben: TestUser;
let slotId: string;

before(async () => {
  ben = await createTestUser("Ben Johns");
  const date = dateInDays(20);
  const { data, error } = await ben.supabase
    .from("slots")
    .insert({
      owner_id: ben.userId,
      proposed_start: `${date}T23:00:00Z`,
      proposed_end: `${date}T23:59:00Z`,
      time_zone: "America/Toronto",
    })
    .select("id")
    .single();
  assert.equal(error, null);
  slotId = data!.id;
});

after(async () => {
  if (ben) {
    await deleteTestUser(ben);
  }
});

for (const table of ["reminder_sends", "weekly_invite_sends"] as const) {
  test(`${table}: the first mark records the send, a second comes back as already sent (23505)`, async () => {
    const markSent = slotUserChannelLog(admin, table);
    const send = { channel: "email" as const, slotId, userId: ben.userId };

    assert.equal(await markSent(send), null);
    assert.equal((await markSent(send))?.code, "23505");
    // A different channel is its own send.
    assert.equal(await markSent({ ...send, channel: "push" }), null);

    const { data } = await admin
      .from(table)
      .select("channel")
      .eq("slot_id", slotId)
      .eq("user_id", ben.userId)
      .order("channel");
    assert.deepEqual(data, [{ channel: "email" }, { channel: "push" }]);
  });
}

test("booking_window_reminder_sends: one row per Slot, a second mark is already sent (23505)", async () => {
  const markSent = bookingWindowReminderLog(admin);

  assert.equal(await markSent({ slotId }), null);
  assert.equal((await markSent({ slotId }))?.code, "23505");
});

test("pruning a gone device deletes its push_subscriptions row and no other", async () => {
  const { data: rows, error } = await ben.supabase
    .from("push_subscriptions")
    .insert(
      ["old-tablet", "phone"].map((name) => ({
        user_id: ben.userId,
        endpoint: `https://push.example/${ben.userId}/${name}`,
        p256dh: "p256dh",
        auth: "auth",
      })),
    )
    .select("id, endpoint");
  assert.equal(error, null);
  const gone = rows!.find((row) => row.endpoint.endsWith("old-tablet"))!;

  await pruneSubscription(admin, gone.id);

  const { data: left } = await admin
    .from("push_subscriptions")
    .select("endpoint")
    .eq("user_id", ben.userId);
  assert.deepEqual(
    left?.map((row) => row.endpoint),
    [`https://push.example/${ben.userId}/phone`],
  );
});

test("the address lookup finds a User's email through the admin API", async () => {
  const lookup = supabaseAddressLookup(admin);

  assert.match((await lookup(ben.userId)) ?? "", /^db-test-.+@example\.com$/);
});

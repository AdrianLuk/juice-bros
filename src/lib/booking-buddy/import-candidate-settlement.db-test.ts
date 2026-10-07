import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { after, before, test } from "node:test";

import type { NewBooking } from "./bookings.ts";
import { createOrg, createTestUser, dateInDays, deleteTestUser, type TestUser } from "./db-test-support.ts";
import { confirmCandidate, dismissCandidate } from "./import-candidate-settlement.ts";
import type { ImportCandidate } from "./import-candidate-token.ts";

let owner: TestUser;
let orgId: string;

before(async () => {
  owner = await createTestUser("Settle Owner");
  orgId = await createOrg(owner, "America/Toronto");
});

after(async () => {
  if (owner) await deleteTestUser(owner);
});

/** A fresh reservation, on its own day so no two tests share a slot. */
let nextDay = 20;
function reservation() {
  const date = dateInDays(nextDay++);
  const booking: NewBooking = {
    orgId,
    courtLabel: "#9 - Hard",
    name: "Doubles",
    notes: null,
    date,
    startTime: "18:00",
    endTime: "20:00",
    format: "doubles",
    players: ["Anna Leigh Waters"],
  };
  const slot = { orgId, date, startTime: "18:00", courtLabel: "#9 - Hard" };
  const feed = {
    orgId,
    uid: `evt-${randomUUID()}@courtreserve`,
    sequence: 1,
    startsAt: new Date(`${date}T22:00:00.000Z`).toISOString(),
  };
  const messageId = `msg-${randomUUID()}`;
  return { booking, slot, feed, messageId };
}

type Reservation = ReturnType<typeof reservation>;

/** The three import sources a card can carry, and what each one's ledger says once it is settled. */
const SOURCES = {
  email: {
    candidate: (r: Reservation): ImportCandidate => ({ kind: "import", messageId: r.messageId, feed: null, slot: r.slot }),
    provider: "google",
  },
  feed: {
    candidate: (r: Reservation): ImportCandidate => ({ kind: "import", messageId: null, feed: r.feed, slot: r.slot }),
    provider: null,
  },
  merged: {
    candidate: (r: Reservation): ImportCandidate => ({ kind: "import", messageId: r.messageId, feed: r.feed, slot: r.slot }),
    provider: "microsoft",
  },
} as const;

async function bookingsOn(date: string) {
  // 18:00 in Toronto is 22:00 or 23:00 UTC, the same UTC calendar day.
  const { data } = await owner.supabase
    .from("bookings")
    .select("id")
    .gte("starts_at", `${date}T00:00:00Z`)
    .lte("starts_at", `${date}T23:59:59Z`);
  return (data ?? []).map((row) => row.id);
}

/** Every ledger row the reservation's sources left, in one comparable shape. */
async function ledger(r: Reservation) {
  const [messages, feedEvents, slots] = await Promise.all([
    owner.supabase
      .from("processed_messages")
      .select("provider, outcome, booking_id")
      .eq("provider_message_id", r.messageId),
    owner.supabase
      .from("org_feed_events")
      .select("org_id, sequence, starts_at, status, booking_id")
      .eq("uid", r.feed.uid),
    owner.supabase
      .from("dismissed_reservations")
      .select("org_id, slot_date, slot_start_time, court_label")
      .eq("slot_date", r.slot.date),
  ]);
  return {
    messages: messages.data ?? [],
    feedEvents: (feedEvents.data ?? []).map((row) => ({ ...row, starts_at: new Date(row.starts_at).toISOString() })),
    slots: slots.data ?? [],
  };
}

function expectedLedger(
  source: keyof typeof SOURCES,
  r: Reservation,
  settled: { outcome: "confirmed" | "dismissed"; bookingId: string | null },
) {
  const hasEmail = source !== "feed";
  const hasFeed = source !== "email";
  return {
    messages: hasEmail
      ? [{ provider: SOURCES[source].provider, outcome: settled.outcome, booking_id: settled.bookingId }]
      : [],
    feedEvents: hasFeed
      ? [
          {
            org_id: orgId,
            sequence: r.feed.sequence,
            starts_at: r.feed.startsAt,
            status: settled.outcome === "confirmed" ? "imported" : "dismissed",
            booking_id: settled.bookingId,
          },
        ]
      : [],
    slots:
      settled.outcome === "dismissed"
        ? [{ org_id: orgId, slot_date: r.slot.date, slot_start_time: "18:00:00", court_label: "#9 - Hard" }]
        : [],
  };
}

const LABEL = { email: "an email", feed: "a feed", merged: "a merged" };

for (const source of Object.keys(SOURCES) as (keyof typeof SOURCES)[]) {
  const { candidate, provider } = SOURCES[source];

  test(`confirming ${LABEL[source]} candidate creates one Booking and settles its sources against it`, async () => {
    const r = reservation();
    const outcome = await confirmCandidate(owner.supabase, {
      ownerId: owner.userId,
      candidate: candidate(r),
      booking: r.booking,
      provider,
    });

    assert.ok(outcome.status === "settled", JSON.stringify(outcome));
    assert.equal(outcome.playersError, null);
    assert.deepEqual(await bookingsOn(r.booking.date), [outcome.bookingId]);
    assert.deepEqual(
      await ledger(r),
      expectedLedger(source, r, { outcome: "confirmed", bookingId: outcome.bookingId }),
    );
  });

  test(`confirming ${LABEL[source]} candidate a Booking already covers links it instead of inserting`, async () => {
    const r = reservation();
    // Already on file from the other source, which writes the court as "#9".
    const onFile = await confirmCandidate(owner.supabase, {
      ownerId: owner.userId,
      candidate: { kind: "import", messageId: `msg-${randomUUID()}`, feed: null, slot: r.slot },
      booking: { ...r.booking, courtLabel: "#9", players: [] },
      provider: "google",
    });
    assert.ok(onFile.status === "settled", JSON.stringify(onFile));

    const outcome = await confirmCandidate(owner.supabase, {
      ownerId: owner.userId,
      candidate: candidate(r),
      booking: r.booking,
      provider,
    });

    assert.deepEqual(outcome, { status: "duplicate", bookingId: onFile.bookingId });
    assert.deepEqual(await bookingsOn(r.booking.date), [onFile.bookingId]);
    assert.deepEqual(
      await ledger(r),
      expectedLedger(source, r, { outcome: "confirmed", bookingId: onFile.bookingId }),
    );
  });

  test(`confirming ${LABEL[source]} candidate twice makes one Booking and one set of rows`, async () => {
    const r = reservation();
    const input = { ownerId: owner.userId, candidate: candidate(r), booking: r.booking, provider };
    const first = await confirmCandidate(owner.supabase, input);
    const second = await confirmCandidate(owner.supabase, input);

    assert.ok(first.status === "settled", JSON.stringify(first));
    assert.deepEqual(second, { status: "duplicate", bookingId: first.bookingId });
    assert.deepEqual(await bookingsOn(r.booking.date), [first.bookingId]);
    assert.deepEqual(
      await ledger(r),
      expectedLedger(source, r, { outcome: "confirmed", bookingId: first.bookingId }),
    );
  });

  test(`dismissing ${LABEL[source]} candidate records its sources and its slot, and no Booking`, async () => {
    const r = reservation();
    const outcome = await dismissCandidate(owner.supabase, {
      ownerId: owner.userId,
      candidate: candidate(r),
      provider,
    });

    assert.deepEqual(outcome, { status: "settled" });
    assert.deepEqual(await bookingsOn(r.booking.date), []);
    assert.deepEqual(await ledger(r), expectedLedger(source, r, { outcome: "dismissed", bookingId: null }));
  });

  test(`dismissing ${LABEL[source]} candidate twice is still settled`, async () => {
    const r = reservation();
    const input = { ownerId: owner.userId, candidate: candidate(r), provider };
    assert.deepEqual(await dismissCandidate(owner.supabase, input), { status: "settled" });
    assert.deepEqual(await dismissCandidate(owner.supabase, input), { status: "settled" });

    const { messages, feedEvents } = await ledger(r);
    const expected = expectedLedger(source, r, { outcome: "dismissed", bookingId: null });
    assert.deepEqual({ messages, feedEvents }, { messages: expected.messages, feedEvents: expected.feedEvents });
  });
}

test("dismissing an email whose facility matched no Org records the message and no slot", async () => {
  const r = reservation();
  const outcome = await dismissCandidate(owner.supabase, {
    ownerId: owner.userId,
    candidate: { kind: "import", messageId: r.messageId, feed: null, slot: null },
    provider: "google",
  });

  assert.deepEqual(outcome, { status: "settled" });
  const { messages, slots } = await ledger(r);
  assert.deepEqual(messages, [{ provider: "google", outcome: "dismissed", booking_id: null }]);
  assert.deepEqual(slots, []);
});

// Postgres only lets a feed event link to a Booking in its own Org, so the row
// follows the Booking when the User changed the card's Facility select.
test("a feed event confirmed under another Facility is recorded under that Facility, linked", async () => {
  const r = reservation();
  const otherOrg = await createOrg(owner);
  const outcome = await confirmCandidate(owner.supabase, {
    ownerId: owner.userId,
    candidate: SOURCES.feed.candidate(r),
    booking: { ...r.booking, orgId: otherOrg },
    provider: null,
  });

  assert.ok(outcome.status === "settled", JSON.stringify(outcome));
  const { feedEvents } = await ledger(r);
  assert.deepEqual(
    feedEvents.map((row) => ({ org_id: row.org_id, booking_id: row.booking_id })),
    [{ org_id: otherOrg, booking_id: outcome.bookingId }],
  );
});

test("confirming a candidate whose Booking fields are refused writes nothing", async () => {
  const r = reservation();
  const outcome = await confirmCandidate(owner.supabase, {
    ownerId: owner.userId,
    candidate: SOURCES.merged.candidate(r),
    booking: { ...r.booking, date: dateInDays(-2) },
    provider: "google",
  });

  assert.deepEqual(outcome, {
    status: "error",
    message: "That date has already passed. Pick a date in the future.",
  });
  assert.deepEqual(await ledger(r), { messages: [], feedEvents: [], slots: [] });
});

/* -------------------------------------------------------------------------- */
/* Cancellations, updates and Keep booking (issue #609)                        */
/* -------------------------------------------------------------------------- */

/** A Booking on file for the reservation, confirmed from the given sources the way a sync would leave it. */
async function confirmedFrom(r: Reservation, sources: { email?: boolean; feed?: boolean }) {
  const outcome = await confirmCandidate(owner.supabase, {
    ownerId: owner.userId,
    candidate: {
      kind: "import",
      messageId: sources.email ? r.messageId : null,
      feed: sources.feed ? r.feed : null,
      slot: r.slot,
    },
    booking: r.booking,
    provider: sources.email ? "google" : null,
  });
  assert.ok(outcome.status === "settled", JSON.stringify(outcome));
  return outcome.bookingId;
}

type MessageRow = { provider_message_id: string; provider: string; outcome: string; booking_id: string | null };

function byMessageId(a: MessageRow, b: MessageRow) {
  return a.provider_message_id < b.provider_message_id ? -1 : 1;
}

/** Every `processed_messages` row for these message ids, in a comparable order. */
async function messagesFor(...messageIds: string[]) {
  const { data } = await owner.supabase
    .from("processed_messages")
    .select("provider_message_id, provider, outcome, booking_id")
    .in("provider_message_id", messageIds);
  return ((data ?? []) as MessageRow[]).sort(byMessageId);
}

/** These message ids, each recorded `cancelled` under Google with no Booking. */
function cancelledMessages(...messageIds: string[]) {
  return messageIds
    .map((id): MessageRow => ({ provider_message_id: id, provider: "google", outcome: "cancelled", booking_id: null }))
    .sort(byMessageId);
}

async function feedEventFor(r: Reservation) {
  const { data } = await owner.supabase
    .from("org_feed_events")
    .select("status, booking_id, sequence")
    .eq("uid", r.feed.uid)
    .maybeSingle();
  return data;
}

test("confirming an email cancellation removes the Booking and records it and the confirmation as cancelled", async () => {
  const r = reservation();
  const bookingId = await confirmedFrom(r, { email: true });
  const cancellationId = `msg-${randomUUID()}`;

  const outcome = await confirmCandidate(owner.supabase, {
    ownerId: owner.userId,
    candidate: { kind: "cancellation", messageId: cancellationId, feed: null, bookingId },
    provider: "google",
  });

  assert.deepEqual(outcome, { status: "settled", bookingId, playersError: null });
  assert.deepEqual(await bookingsOn(r.booking.date), []);
  assert.deepEqual(
    await messagesFor(r.messageId, cancellationId),
    cancelledMessages(r.messageId, cancellationId),
  );
});

// The cancellation gap, email side: the feed still listing the event must not
// offer it again as an import once the Booking is gone.
test("confirming an email cancellation also dismisses the feed event linked to the Booking", async () => {
  const r = reservation();
  const bookingId = await confirmedFrom(r, { email: true, feed: true });

  const outcome = await confirmCandidate(owner.supabase, {
    ownerId: owner.userId,
    candidate: { kind: "cancellation", messageId: `msg-${randomUUID()}`, feed: null, bookingId },
    provider: "google",
  });

  assert.equal(outcome.status, "settled");
  assert.deepEqual(await feedEventFor(r), { status: "dismissed", booking_id: null, sequence: r.feed.sequence });
});

function feedCancellation(r: Reservation, bookingId: string) {
  return {
    kind: "cancellation" as const,
    messageId: null,
    feed: { orgId: r.feed.orgId, uid: r.feed.uid, startsAt: r.feed.startsAt },
    bookingId,
  };
}

test("confirming a feed cancellation removes the Booking and dismisses the feed event", async () => {
  const r = reservation();
  const bookingId = await confirmedFrom(r, { feed: true });

  const outcome = await confirmCandidate(owner.supabase, {
    ownerId: owner.userId,
    candidate: feedCancellation(r, bookingId),
    provider: null,
  });

  assert.deepEqual(outcome, { status: "settled", bookingId, playersError: null });
  assert.deepEqual(await bookingsOn(r.booking.date), []);
  assert.deepEqual(await feedEventFor(r), { status: "dismissed", booking_id: null, sequence: r.feed.sequence });
});

// The cancellation gap, feed side: deleting the Booking cascades the email's
// `confirmed` row away, and without a fresh record the next email sync would
// offer the confirmation again.
test("confirming a feed cancellation keeps the email's confirmation suppressed", async () => {
  const r = reservation();
  const bookingId = await confirmedFrom(r, { email: true, feed: true });

  const outcome = await confirmCandidate(owner.supabase, {
    ownerId: owner.userId,
    candidate: feedCancellation(r, bookingId),
    provider: null,
  });

  assert.equal(outcome.status, "settled");
  assert.deepEqual(await messagesFor(r.messageId), cancelledMessages(r.messageId));
});

test("a feed cancellation whose event is no longer linked to that Booking removes nothing", async () => {
  const r = reservation();
  const bookingId = await confirmedFrom(r, { feed: true });
  const other = reservation();
  const otherBookingId = await confirmedFrom(other, { email: true });

  const outcome = await confirmCandidate(owner.supabase, {
    ownerId: owner.userId,
    candidate: feedCancellation(r, otherBookingId),
    provider: null,
  });

  assert.deepEqual(outcome, { status: "error", message: "That booking has already changed. Sync again." });
  assert.deepEqual(await bookingsOn(r.booking.date), [bookingId]);
  assert.deepEqual(await bookingsOn(other.booking.date), [otherBookingId]);
  assert.deepEqual(await feedEventFor(r), { status: "imported", booking_id: bookingId, sequence: r.feed.sequence });
});

/**
 * The caller's real client, except that every read of `table` fails the way a
 * dropped connection or a timeout would. Writes and every other table go to
 * the database as usual.
 */
function withFailingReads(supabase: SupabaseClient, table: string): SupabaseClient {
  const failed = { data: null, error: { message: `reading ${table} failed (test)`, code: "57014" } };
  const failedQuery: object = new Proxy(() => {}, {
    get: (_target, prop) =>
      prop === "then"
        ? (resolve: (value: typeof failed) => unknown) => Promise.resolve(failed).then(resolve)
        : () => failedQuery,
  });

  return new Proxy(supabase, {
    get(target, prop, receiver) {
      if (prop !== "from") {
        return Reflect.get(target, prop, receiver);
      }
      return (name: string) => {
        const builder = target.from(name);
        if (name !== table) {
          return builder;
        }
        return new Proxy(builder, {
          get: (inner, innerProp, innerReceiver) =>
            innerProp === "select" ? () => failedQuery : Reflect.get(inner, innerProp, innerReceiver),
        });
      };
    },
  });
}

// Each source's record of the Booking is read before the delete because the
// delete breaks the links. A read that fails can't say which records to
// settle, so the Booking stays and the User is asked to try again.
for (const table of ["processed_messages", "org_feed_events"]) {
  test(`a cancellation whose ${table} read fails keeps the Booking`, async () => {
    const r = reservation();
    const bookingId = await confirmedFrom(r, { email: true, feed: true });

    const outcome = await confirmCandidate(withFailingReads(owner.supabase, table), {
      ownerId: owner.userId,
      candidate: { kind: "cancellation", messageId: `msg-${randomUUID()}`, feed: null, bookingId },
      provider: "google",
    });

    assert.deepEqual(outcome, { status: "error", message: "Couldn't remove that booking. Try again." });
    assert.deepEqual(await bookingsOn(r.booking.date), [bookingId]);
  });
}

/** The Booking as an update would rewrite it: slot in Toronto wall-clock, court, format and Players. */
async function bookingAsUpdated(bookingId: string) {
  const [{ data: booking }, { data: players }] = await Promise.all([
    owner.supabase.from("bookings").select("starts_at, ends_at, court_label, format").eq("id", bookingId).single(),
    owner.supabase.from("booking_players").select("name").eq("booking_id", bookingId),
  ]);
  const clock = (instant: string) =>
    new Date(instant).toLocaleTimeString("en-GB", { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit" });
  return {
    startTime: clock(booking!.starts_at),
    endTime: clock(booking!.ends_at),
    courtLabel: booking!.court_label,
    format: booking!.format,
    players: (players ?? []).map((row) => row.name).sort(),
  };
}

for (const match of ["exact", "suggested"] as const) {
  test(`applying an update to its ${match} match rewrites the Booking and records the email against it`, async () => {
    const r = reservation();
    const bookingId = await confirmedFrom(r, { email: true });
    const updateId = `msg-${randomUUID()}`;
    // An exact match keeps the start time it was matched on; a suggested match
    // is the update that moved it.
    const startTime = match === "exact" ? "18:00" : "19:00";

    const outcome = await confirmCandidate(owner.supabase, {
      ownerId: owner.userId,
      candidate: { kind: "update", messageId: updateId },
      update: {
        bookingId,
        courtLabel: "#4 - Clay",
        notes: null,
        date: r.booking.date,
        startTime,
        endTime: "21:00",
        format: "singles",
        players: ["Ben Johns"],
      },
      provider: "google",
    });

    assert.deepEqual(outcome, { status: "settled", bookingId, playersError: null });
    assert.deepEqual(await bookingAsUpdated(bookingId), {
      startTime,
      endTime: "21:00",
      courtLabel: "#4 - Clay",
      format: "singles",
      players: ["Ben Johns"],
    });
    assert.deepEqual(await messagesFor(updateId), [
      { provider_message_id: updateId, provider: "google", outcome: "updated", booking_id: bookingId },
    ]);
  });
}

test("an update for a Booking that is gone records nothing", async () => {
  const r = reservation();
  const updateId = `msg-${randomUUID()}`;

  const outcome = await confirmCandidate(owner.supabase, {
    ownerId: owner.userId,
    candidate: { kind: "update", messageId: updateId },
    update: { ...r.booking, bookingId: randomUUID() },
    provider: "google",
  });

  assert.deepEqual(outcome, { status: "error", message: "Couldn't update that booking. Try again." });
  assert.deepEqual(await messagesFor(updateId), []);
});

// "Keep booking" means keep the Booking: every one of these leaves it standing
// and records no slot, so a future import of that slot is still offered.
const KEPT = {
  "an email cancellation": (r: Reservation, bookingId: string, messageId: string) => ({
    kind: "cancellation" as const,
    messageId,
    feed: null,
    bookingId,
  }),
  "an email cancellation that matched no Booking": (_r: Reservation, _bookingId: string, messageId: string) => ({
    kind: "cancellation" as const,
    messageId,
    feed: null,
    bookingId: null,
  }),
  "an email update": (_r: Reservation, _bookingId: string, messageId: string) => ({
    kind: "update" as const,
    messageId,
  }),
};

for (const [label, candidate] of Object.entries(KEPT)) {
  test(`dismissing ${label} records the message, keeps the Booking and records no slot`, async () => {
    const r = reservation();
    const bookingId = await confirmedFrom(r, { feed: true });
    const messageId = `msg-${randomUUID()}`;

    const outcome = await dismissCandidate(owner.supabase, {
      ownerId: owner.userId,
      candidate: candidate(r, bookingId, messageId),
      provider: "google",
    });

    assert.deepEqual(outcome, { status: "settled" });
    assert.deepEqual(await bookingsOn(r.booking.date), [bookingId]);
    assert.deepEqual(await messagesFor(messageId), [
      { provider_message_id: messageId, provider: "google", outcome: "dismissed", booking_id: null },
    ]);
    assert.deepEqual((await ledger(r)).slots, []);
  });
}

test("Keep booking on a feed cancellation dismisses the feed event, keeps the Booking and records no slot", async () => {
  const r = reservation();
  const bookingId = await confirmedFrom(r, { feed: true });

  const outcome = await dismissCandidate(owner.supabase, {
    ownerId: owner.userId,
    candidate: feedCancellation(r, bookingId),
    provider: null,
  });

  assert.deepEqual(outcome, { status: "settled" });
  assert.deepEqual(await bookingsOn(r.booking.date), [bookingId]);
  assert.deepEqual(await feedEventFor(r), { status: "dismissed", booking_id: null, sequence: r.feed.sequence });
  assert.deepEqual((await ledger(r)).slots, []);
});

// A row can be gone by the time the User answers (the prune, or the Facility's
// feed URL cleared and re-pasted). The dismissal still has to land, or the
// next sync flags the same vanished event again.
test("Keep booking on a feed cancellation whose event row is gone still records it dismissed", async () => {
  const r = reservation();
  const bookingId = await confirmedFrom(r, { email: true });

  const outcome = await dismissCandidate(owner.supabase, {
    ownerId: owner.userId,
    candidate: feedCancellation(r, bookingId),
    provider: null,
  });

  assert.deepEqual(outcome, { status: "settled" });
  assert.deepEqual(await bookingsOn(r.booking.date), [bookingId]);
  assert.deepEqual(
    (await ledger(r)).feedEvents,
    [{ org_id: orgId, sequence: 0, starts_at: r.feed.startsAt, status: "dismissed", booking_id: null }],
  );
});

test("an email candidate with no provider to record it under is refused", async () => {
  const r = reservation();
  const input = { ownerId: owner.userId, candidate: SOURCES.email.candidate(r), provider: null };

  assert.deepEqual(await confirmCandidate(owner.supabase, { ...input, booking: r.booking }), {
    status: "error",
    message: "Couldn't confirm that booking. Try again.",
  });
  assert.deepEqual(await dismissCandidate(owner.supabase, input), {
    status: "error",
    message: "Couldn't dismiss that. Try again.",
  });
  assert.deepEqual(await bookingsOn(r.booking.date), []);
});

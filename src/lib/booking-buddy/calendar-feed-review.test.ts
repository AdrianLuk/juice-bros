import assert from "node:assert/strict";
import test from "node:test";

import type { CourtReserveFeedEvent } from "./courtreserve-feed.ts";
import {
  reviewCalendarFeed,
  type ExistingBookingForFeedReview,
  type SeenFeedEvent,
} from "./calendar-feed-review.ts";

const ORG = { id: "org-1", timeZone: "America/Toronto" };

/** A future-dated doubles reservation on Court #6, 6-8pm Toronto on 2026-10-01. */
function feedEvent(overrides: Partial<CourtReserveFeedEvent> = {}): CourtReserveFeedEvent {
  return {
    uid: "vevent-1",
    sequence: 0,
    startsAt: "2026-10-01T22:00:00Z", // 18:00 America/Toronto (EDT, UTC-4)
    endsAt: "2026-10-02T00:00:00Z", // 20:00 America/Toronto
    format: "doubles",
    name: "Doubles",
    courtLabel: "Court #6",
    facilityName: "Vaughan Pickleball",
    playerNames: [],
    cancelled: false,
    ...overrides,
  };
}

const NOW = new Date("2026-09-15T12:00:00Z");

/** A `pending` seen-event row (defaults line up with `feedEvent()`). */
function seen(overrides: Partial<SeenFeedEvent> = {}): SeenFeedEvent {
  return {
    uid: "vevent-1",
    status: "pending",
    startsAt: "2026-10-01T22:00:00Z",
    bookingId: null,
    ...overrides,
  };
}

test("a future-dated, unmatched, non-dismissed event becomes an import candidate", () => {
  const { items, autoLinked } = reviewCalendarFeed({
    events: [feedEvent()],
    org: ORG,
    existingBookings: [],
    seenEvents: [],
    now: NOW,
  });

  assert.equal(autoLinked.length, 0);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], {
    kind: "import",
    orgId: "org-1",
    feedEventUid: "vevent-1",
    sequence: 0,
    facilityName: "Vaughan Pickleball",
    startsAt: "2026-10-01T22:00:00.000Z",
    date: "2026-10-01",
    startTime: "18:00",
    endTime: "20:00",
    courtLabel: "#6",
    notes: null,
    format: "doubles",
    name: "Doubles",
  });
});

test("a past-dated event is filtered out, never surfaced", () => {
  const { items } = reviewCalendarFeed({
    events: [
      feedEvent({
        uid: "old",
        startsAt: "2026-08-01T22:00:00Z",
        endsAt: "2026-08-02T00:00:00Z",
      }),
    ],
    org: ORG,
    existingBookings: [],
    seenEvents: [],
    now: NOW,
  });

  assert.equal(items.length, 0);
});

test("an event matching an existing Booking is auto-linked, not offered", () => {
  const existing: ExistingBookingForFeedReview[] = [
    { id: "booking-9", orgId: "org-1", courtLabel: "#6", date: "2026-10-01", startTime: "18:00" },
  ];

  const { items, autoLinked } = reviewCalendarFeed({
    events: [feedEvent({ sequence: 3 })],
    org: ORG,
    existingBookings: existing,
    seenEvents: [],
    now: NOW,
  });

  assert.equal(items.length, 0);
  assert.deepEqual(autoLinked, [
    {
      feedEventUid: "vevent-1",
      sequence: 3,
      bookingId: "booking-9",
      startsAt: "2026-10-01T22:00:00.000Z",
    },
  ]);
});

test("the auto-link fires however the Booking was created — a hand-entered Booking on a different court is not a match", () => {
  const existing: ExistingBookingForFeedReview[] = [
    { id: "booking-x", orgId: "org-1", courtLabel: "#7", date: "2026-10-01", startTime: "18:00" },
  ];

  const { items, autoLinked } = reviewCalendarFeed({
    events: [feedEvent()],
    org: ORG,
    existingBookings: existing,
    seenEvents: [],
    now: NOW,
  });

  assert.equal(autoLinked.length, 0);
  assert.equal(items.length, 1);
});

test("a dismissed feed event is skipped on later syncs", () => {
  const { items } = reviewCalendarFeed({
    events: [feedEvent()],
    org: ORG,
    existingBookings: [],
    seenEvents: [seen({ status: "dismissed" })],
    now: NOW,
  });

  assert.equal(items.length, 0);
});

test("a dismissed event that later matches a Booking is NOT auto-linked (stays dismissed)", () => {
  const existing: ExistingBookingForFeedReview[] = [
    { id: "booking-h", orgId: "org-1", courtLabel: "#6", date: "2026-10-01", startTime: "18:00" },
  ];

  const { items, autoLinked } = reviewCalendarFeed({
    events: [feedEvent()],
    org: ORG,
    existingBookings: existing,
    seenEvents: [seen({ status: "dismissed" })],
    now: NOW,
  });

  assert.equal(items.length, 0);
  assert.equal(autoLinked.length, 0);
});

test("a cancelled event is never an import candidate (the diff's job, not this slice's)", () => {
  const { items, autoLinked } = reviewCalendarFeed({
    events: [feedEvent({ cancelled: true })],
    org: ORG,
    existingBookings: [],
    seenEvents: [],
    now: NOW,
  });

  assert.equal(items.length, 0);
  assert.equal(autoLinked.length, 0);
});

test("an overlong court label folds into notes and blanks the label", () => {
  const long = `Court ${"A".repeat(60)}`;
  const { items } = reviewCalendarFeed({
    events: [feedEvent({ courtLabel: long })],
    org: ORG,
    existingBookings: [],
    seenEvents: [],
    now: NOW,
  });

  assert.equal(items[0].courtLabel, null);
  assert.equal(items[0].notes, "A".repeat(60));
});

test("candidates come back earliest slot first", () => {
  const { items } = reviewCalendarFeed({
    events: [
      feedEvent({ uid: "b", startsAt: "2026-10-05T22:00:00Z", endsAt: "2026-10-06T00:00:00Z" }),
      feedEvent({ uid: "a", startsAt: "2026-10-01T22:00:00Z", endsAt: "2026-10-02T00:00:00Z" }),
    ],
    org: ORG,
    existingBookings: [],
    seenEvents: [],
    now: NOW,
  });

  assert.deepEqual(
    items.map((item) => item.feedEventUid),
    ["a", "b"],
  );
});

/* -------------------------------------------------------------------------- */
/* Feed-diff cancellation + the four safety rails (issue #296)               */
/* -------------------------------------------------------------------------- */

/** A second future event that keeps the feed non-empty and sets rail 2's floor early. */
function anchorEvent(overrides: Partial<CourtReserveFeedEvent> = {}): CourtReserveFeedEvent {
  return feedEvent({
    uid: "anchor",
    startsAt: "2026-09-20T22:00:00Z",
    endsAt: "2026-09-21T00:00:00Z",
    ...overrides,
  });
}

test("a Booking-linked event that vanished from the feed becomes a cancellation candidate", () => {
  const { cancellations, feedLooksWrong } = reviewCalendarFeed({
    events: [anchorEvent()],
    org: ORG,
    existingBookings: [],
    seenEvents: [
      seen({ uid: "gone", status: "imported", bookingId: "booking-1" }),
      seen({ uid: "anchor", status: "imported", bookingId: "booking-2", startsAt: "2026-09-20T22:00:00Z" }),
    ],
    now: NOW,
  });

  assert.equal(feedLooksWrong, false);
  assert.deepEqual(cancellations, [
    {
      kind: "cancellation",
      orgId: "org-1",
      feedEventUid: "gone",
      bookingId: "booking-1",
      startsAt: "2026-10-01T22:00:00.000Z",
      date: "2026-10-01",
      startTime: "18:00",
      reason: "vanished",
    },
  ]);
});

test("an event still in the feed with an explicit cancelled status is flagged regardless of the window (rail 3)", () => {
  const { cancellations } = reviewCalendarFeed({
    // The cancelled event's own start is in the past — rail 2 would exclude a
    // vanish, but an explicit status is unconditional.
    events: [anchorEvent(), feedEvent({ uid: "cx", cancelled: true, startsAt: "2026-08-01T22:00:00Z", endsAt: "2026-08-02T00:00:00Z" })],
    org: ORG,
    existingBookings: [],
    seenEvents: [
      seen({ uid: "cx", status: "imported", bookingId: "booking-c", startsAt: "2026-08-01T22:00:00Z" }),
    ],
    now: NOW,
  });

  assert.deepEqual(
    cancellations.map((c) => [c.feedEventUid, c.reason]),
    [["cx", "cancelled"]],
  );
});

test("the cancellation link works for a hand-entered / email-imported Booking (matched via the seen-event booking_id)", () => {
  // No `existingBookings` entry and no feed-import history for this UID — the
  // only thing tying it to a Booking is the seen row's `bookingId`.
  const { cancellations } = reviewCalendarFeed({
    events: [anchorEvent()],
    org: ORG,
    existingBookings: [],
    seenEvents: [seen({ uid: "hand", status: "imported", bookingId: "hand-booking" })],
    now: NOW,
  });

  assert.equal(cancellations.length, 1);
  assert.equal(cancellations[0].bookingId, "hand-booking");
});

test("a UID whose start has passed since the last sync is pruned, never flagged (rail 2)", () => {
  const { cancellations } = reviewCalendarFeed({
    events: [anchorEvent()],
    org: ORG,
    existingBookings: [],
    seenEvents: [
      seen({ uid: "past", status: "imported", bookingId: "b-past", startsAt: "2026-09-01T22:00:00Z" }),
    ],
    now: NOW,
  });

  assert.equal(cancellations.length, 0);
});

test("a vanished UID older than the earliest event still in the feed is not flagged (rail 2 floor)", () => {
  const { cancellations } = reviewCalendarFeed({
    // Feed's earliest event is 2026-10-10; the vanished one started 2026-10-01,
    // before the window the feed now shows.
    events: [feedEvent({ uid: "far", startsAt: "2026-10-10T22:00:00Z", endsAt: "2026-10-11T00:00:00Z" })],
    org: ORG,
    existingBookings: [],
    seenEvents: [
      seen({ uid: "early", status: "imported", bookingId: "b-early", startsAt: "2026-10-01T22:00:00Z" }),
    ],
    now: NOW,
  });

  assert.equal(cancellations.length, 0);
});

test("a pending (never-imported) seen row that vanishes is not a cancellation — nothing to remove", () => {
  const { cancellations } = reviewCalendarFeed({
    events: [anchorEvent()],
    org: ORG,
    existingBookings: [],
    seenEvents: [seen({ uid: "pending-gone", status: "pending", bookingId: null })],
    now: NOW,
  });

  assert.equal(cancellations.length, 0);
});

test("an unreadable UID this sync is treated as still present, not a vanish", () => {
  const { cancellations } = reviewCalendarFeed({
    events: [anchorEvent()],
    org: ORG,
    existingBookings: [],
    seenEvents: [
      seen({ uid: "blip", status: "imported", bookingId: "b-blip" }),
    ],
    unreadableUids: ["blip"],
    now: NOW,
  });

  assert.equal(cancellations.length, 0);
});

test("the sanity cap suppresses the candidates and sets feedLooksWrong past the absolute cap (rail 4)", () => {
  const seenEvents: SeenFeedEvent[] = [];
  for (let i = 0; i < 5; i++) {
    seenEvents.push(
      seen({
        uid: `gone-${i}`,
        status: "imported",
        bookingId: `b-${i}`,
        startsAt: `2026-10-0${i + 1}T22:00:00Z`,
      }),
    );
  }

  const { cancellations, feedLooksWrong } = reviewCalendarFeed({
    events: [anchorEvent()],
    org: ORG,
    existingBookings: [],
    seenEvents,
    now: NOW,
  });

  assert.equal(feedLooksWrong, true);
  assert.equal(cancellations.length, 0);
});

test("a lone cancellation always comes through, even at 100% of a one-Booking feed (rail 4)", () => {
  const { cancellations, feedLooksWrong } = reviewCalendarFeed({
    events: [anchorEvent()],
    org: ORG,
    existingBookings: [],
    seenEvents: [
      seen({ uid: "only", status: "imported", bookingId: "b-only", startsAt: "2026-10-01T22:00:00Z" }),
    ],
    now: NOW,
  });

  assert.equal(feedLooksWrong, false);
  assert.equal(cancellations.length, 1);
});

test("2 of 3 tracked Bookings vanishing at once trips the >50% guard (rail 4)", () => {
  const { cancellations, feedLooksWrong } = reviewCalendarFeed({
    events: [anchorEvent()],
    org: ORG,
    existingBookings: [],
    seenEvents: [
      seen({ uid: "g1", status: "imported", bookingId: "b1", startsAt: "2026-10-01T22:00:00Z" }),
      seen({ uid: "g2", status: "imported", bookingId: "b2", startsAt: "2026-10-02T22:00:00Z" }),
      seen({ uid: "anchor", status: "imported", bookingId: "b3", startsAt: "2026-09-20T22:00:00Z" }),
    ],
    now: NOW,
  });

  assert.equal(feedLooksWrong, true);
  assert.equal(cancellations.length, 0);
});

test("2 of 4 tracked Bookings vanishing (exactly 50%) does not trip rail 4 — both come through", () => {
  const { cancellations, feedLooksWrong } = reviewCalendarFeed({
    // Two events (k1, anchor) still present, two seen rows (g1, g2) vanished.
    events: [
      anchorEvent(),
      feedEvent({ uid: "k1", startsAt: "2026-09-21T22:00:00Z", endsAt: "2026-09-22T00:00:00Z" }),
    ],
    org: ORG,
    existingBookings: [],
    seenEvents: [
      seen({ uid: "g1", status: "imported", bookingId: "b1", startsAt: "2026-10-01T22:00:00Z" }),
      seen({ uid: "g2", status: "imported", bookingId: "b2", startsAt: "2026-10-02T22:00:00Z" }),
      seen({ uid: "k1", status: "imported", bookingId: "b3", startsAt: "2026-09-21T22:00:00Z" }),
      seen({ uid: "anchor", status: "imported", bookingId: "b4", startsAt: "2026-09-20T22:00:00Z" }),
    ],
    now: NOW,
  });

  assert.equal(feedLooksWrong, false);
  assert.equal(cancellations.length, 2);
});

test("a stale past event lingering in the feed does not disable rail 2's floor", () => {
  // `stale` is still in the feed but started in the past; `anchor` is the only
  // future present event, so the floor is `anchor`'s start. `early` vanished
  // and started before that floor → not flagged.
  const { cancellations } = reviewCalendarFeed({
    events: [
      anchorEvent({ startsAt: "2026-10-05T22:00:00Z", endsAt: "2026-10-06T00:00:00Z" }),
      feedEvent({ uid: "stale", startsAt: "2026-08-01T22:00:00Z", endsAt: "2026-08-02T00:00:00Z" }),
    ],
    org: ORG,
    existingBookings: [],
    seenEvents: [
      seen({ uid: "early", status: "imported", bookingId: "b-early", startsAt: "2026-10-01T22:00:00Z" }),
    ],
    now: NOW,
  });

  assert.equal(cancellations.length, 0);
});

test("a re-synced event that now matches its Booking is left alone — no cancellation for a still-present UID", () => {
  const { cancellations } = reviewCalendarFeed({
    events: [feedEvent()],
    org: ORG,
    existingBookings: [],
    seenEvents: [seen({ uid: "vevent-1", status: "imported", bookingId: "b-ok" })],
    now: NOW,
  });

  assert.equal(cancellations.length, 0);
});

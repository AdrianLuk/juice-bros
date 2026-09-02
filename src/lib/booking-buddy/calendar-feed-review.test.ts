import assert from "node:assert/strict";
import test from "node:test";

import type { CourtReserveFeedEvent } from "./courtreserve-feed.ts";
import {
  reviewCalendarFeed,
  type ExistingBookingForFeedReview,
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
    seenEvents: [{ uid: "vevent-1", status: "dismissed" }],
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
    seenEvents: [{ uid: "vevent-1", status: "dismissed" }],
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

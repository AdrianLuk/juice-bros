import assert from "node:assert/strict";
import test from "node:test";

import { FEED_EVENT_RETENTION_DAYS, feedEventPruneCutoff } from "./feed-events.ts";

/** What the prune's two `.lt()` filters come to, so a case reads as one answer. */
function pruned(row: { startsAt: string; lastSeenAt: string }, now: string): boolean {
  const cutoff = feedEventPruneCutoff(new Date(now));
  return row.startsAt < cutoff && row.lastSeenAt < cutoff;
}

test("the cutoff sits a full retention behind now, to the millisecond (#452)", () => {
  // Absolute instants, unlike `dismissalPruneCutoff` — `starts_at` and
  // `last_seen_at` are timestamptz, not a wall-clock date in an Org's zone, so
  // there is no calendar day of slack to add.
  assert.equal(feedEventPruneCutoff(new Date("2026-10-01T00:00:00.000Z")), "2026-07-03T00:00:00.000Z");
  assert.equal(feedEventPruneCutoff(new Date("2026-10-01T17:45:30.500Z")), "2026-07-03T17:45:30.500Z");
});

test("an ordinary settled row goes once its reservation is a retention old", () => {
  // A sync stops bumping `last_seen_at` the moment an event's date passes —
  // the review drops a past-dated event before the candidate or the auto-link
  // that would re-upsert it — so on the rows that make up the table's bulk the
  // two columns move together and the second condition just says what the
  // first one means.
  const row = { startsAt: "2026-06-01T22:00:00.000Z", lastSeenAt: "2026-06-01T09:00:00.000Z" };

  assert.equal(pruned(row, "2026-08-01T00:00:00.000Z"), false);
  assert.equal(pruned(row, "2026-10-01T00:00:00.000Z"), true);
});

test("a row the feed still shows survives, however old its start (#452)", () => {
  // The case the second condition is there for at all. A reservation long past
  // whose row is somehow still being touched — an unreadable UID a sync keeps
  // bumping — is not something to forget while the feed is still handing it to
  // us.
  const stillTouched = { startsAt: "2020-01-01T18:00:00.000Z", lastSeenAt: "2026-09-30T12:00:00.000Z" };

  assert.equal(pruned(stillTouched, "2026-10-01T00:00:00.000Z"), false);
});

test("a settled row whose starts_at is the epoch is kept by its last sighting", () => {
  // `confirmFeedCandidate` / `dismissFeedCandidate` record the epoch when the
  // posted `starts_at` is missing or unparseable. Pruning on `starts_at` alone
  // would forget that decision on the very next sync and offer the event
  // again; `last_seen_at` is the honest column on such a row.
  const settledNow = { startsAt: "1970-01-01T00:00:00.000Z", lastSeenAt: "2026-09-30T12:00:00.000Z" };

  assert.equal(pruned(settledNow, "2026-10-01T00:00:00.000Z"), false);
  // And it does go, a retention after the decision rather than after a start
  // instant that never meant anything.
  assert.equal(pruned(settledNow, "2027-01-15T00:00:00.000Z"), true);
});

test("the retention is long enough that no live feed window reaches it", () => {
  // Pinned so a future edit has to argue with the number rather than nudge it:
  // the count of surviving rows is rail 4's denominator, and a short retention
  // would move a Facility's "this feed looks wrong" threshold as a side effect
  // of housekeeping.
  assert.equal(FEED_EVENT_RETENTION_DAYS, 90);
});

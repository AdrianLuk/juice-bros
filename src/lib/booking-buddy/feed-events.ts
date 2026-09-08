/**
 * The `org_feed_events` writes that aren't a sync's own bulk upsert: the
 * single-row upsert shared by the Calendar Feed's confirm/dismiss actions
 * (`actions/calendar-feed.ts`) and the merged email+feed confirm
 * (`actions/email-sync.ts`, issue #348) — both settle the feed side of an
 * import the same way, one mutable row per seen VEVENT UID keyed on
 * `(owner_id, org_id, uid)`, carrying its `status` and the `booking_id` it
 * settled to — and the age-out prune each sync run makes (issue #452).
 *
 * Takes the Supabase client as a parameter and imports nothing from Next.js —
 * a `"use server"` module can't export a non-action helper, so the caller owns
 * its own `revalidatePath`. `last_seen_at` is stamped here so a manual
 * confirm/dismiss counts as "seen this sync" for the cancellation diff's
 * in-window check.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type FeedEventUpsert = {
  orgId: string;
  uid: string;
  sequence: number;
  /** Start instant, ISO 8601. */
  startsAt: string;
  status: "pending" | "imported" | "dismissed";
  bookingId: string | null;
};

/** Upsert one `org_feed_events` row. Returns the Supabase error (or `null`). */
export async function upsertFeedEventRow(
  supabase: SupabaseClient,
  ownerId: string,
  event: FeedEventUpsert,
): Promise<{ error: unknown }> {
  const { error } = await supabase.from("org_feed_events").upsert(
    {
      owner_id: ownerId,
      org_id: event.orgId,
      uid: event.uid,
      sequence: event.sequence,
      starts_at: event.startsAt,
      status: event.status,
      booking_id: event.bookingId,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,org_id,uid" },
  );

  return { error };
}

/**
 * How long a seen-event row outlives the reservation it describes (issue
 * #452).
 *
 * Nothing reads a row whose event has been and gone. The review skips a
 * past-dated event before it consults this table at all
 * (`isPastConfirmation`), and rail 2 of the cancellation diff only ever flags
 * a vanished UID whose start is still in the future. So the retention is not
 * chosen to keep the diff working — it already works with none of these rows
 * — but to keep the prune from being sharper than the thing it tidies:
 *
 *  - **Rail 4 counts rows.** The sanity cap's proportional trigger measures
 *    this sync's cancellations against `linkedSeen.length`, every `imported`,
 *    Booking-linked row on file. Unpruned, that denominator grows forever,
 *    which is what has made the proportional half of the rail inert on an old
 *    account; bounding it is a real change, in the direction ADR-0019 meant
 *    ("more than ~50% of an Org's feed-tracked Bookings" — a reservation that
 *    has been and gone is not one) but never got.
 *
 *    It has a user-visible half, and it is intended rather than tolerated: on
 *    a quiet Facility, cancelling two of three upcoming reservations at once
 *    now shows "this feed looks wrong — check the URL" where it used to offer
 *    both as cancellation candidates, so those two Bookings have to be removed
 *    by hand. That is the rail doing its job — half a Facility's reservations
 *    disappearing from a feed in one sync is what it was written to refuse to
 *    act on — and it was only ever silent because the denominator had drifted.
 *    A quarter of a year's retention is what keeps the change gradual rather
 *    than a Facility's threshold lurching on one sync.
 *
 *    Scoping the denominator to *future* rows instead would make this prune
 *    inert, and was not done: it lands the same shift harder and at once,
 *    since the future-only count is smaller still than a retained one.
 *  - **A row is the only record that a UID was decided.** A `dismissed` row is
 *    never re-upserted by a sync, so forgetting one re-offers its event if the
 *    feed still carries it. Ninety days past the start is long past the point
 *    where a feed still shows a reservation.
 */
export const FEED_EVENT_RETENTION_DAYS = 90;

/**
 * The instant a prune deletes *below* — `FEED_EVENT_RETENTION_DAYS` behind
 * `now`, as an ISO 8601 string, since `starts_at` and `last_seen_at` are both
 * absolute instants rather than wall-clock dates.
 *
 * That is the difference from `dismissalPruneCutoff`
 * (`dismissed-reservations.ts`), which has to step a whole calendar day back
 * to cover every zone on Earth: `dismissed_reservations.slot_date` is
 * wall-clock in the Org's own zone, and these two columns are not.
 *
 * Takes `now` rather than reading the clock, like every other date decision in
 * this app, so the rule is testable and one sync shares one "now".
 */
export function feedEventPruneCutoff(now: Date): string {
  return new Date(now.getTime() - FEED_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Delete this User's seen-event rows for reservations long past (issue #452),
 * run once per "Sync facilities" run.
 *
 * The table had described itself as pruned this way since it was created, in
 * CONTEXT.md, in ADR-0019 and in its own table comment, and nothing did it:
 * the only deletes were the whole-feed purges when a Facility's feed URL
 * changes or is cleared. So it grew one row per VEVENT the feed had ever
 * shown, per feed, for good — faster than `dismissed_reservations` grew before
 * #447, since it records every event rather than only the ones a User said no
 * to.
 *
 * **Two conditions, not one.** A row goes when its reservation is
 * `FEED_EVENT_RETENTION_DAYS` past *and* nothing has touched it in that long.
 * `starts_at` alone would be enough for an ordinary row — a sync stops bumping
 * `last_seen_at` the moment an event's date passes, because the review drops a
 * past-dated event before either the candidate or the auto-link that would
 * re-upsert it — so on the rows that make up the table's bulk the second
 * condition changes nothing and simply says what the first one means. Where it
 * earns its place is the row whose `starts_at` is not the reservation's start
 * at all: a confirm or dismiss whose form carried no readable `starts_at`
 * records the epoch (`actions/calendar-feed.ts`), and pruning on `starts_at`
 * alone would forget that decision on the very next sync and offer the event
 * again. `last_seen_at` is honest on every row, so pairing them makes the rule
 * "gone once both the reservation and our last sight of it are 90 days old".
 *
 * Where it runs, and why there: the feed sync is the only thing that reads
 * this table, so an unread row costs nothing until one runs — and when one
 * does, this is one delete seeking the same `owner_id` index the sync's own
 * reads already seek. A cron route would mean a new schedule and a new auth
 * surface for a table that tidies itself at the moment of use. The corollary
 * is that a User who stops syncing keeps whatever rows they had; those still
 * leave with the Facility, and a User who has stopped syncing is not being
 * charged for them.
 *
 * Owner-wide rather than per-Org, so a single-Facility sync tidies the rest
 * too and the loop in `runFeedSync` doesn't repeat a delete that already found
 * everything. Ahead of the review's own read, so one sync sees one state of
 * the table.
 *
 * Never fails the sync it runs inside — a prune that didn't happen leaves the
 * table exactly as tidy as it was before, and the next sync retries.
 */
export async function pruneExpiredFeedEvents(
  supabase: SupabaseClient,
  ownerId: string,
  now: Date,
): Promise<void> {
  const cutoff = feedEventPruneCutoff(now);

  try {
    const { error } = await supabase
      .from("org_feed_events")
      .delete()
      .eq("owner_id", ownerId)
      .lt("starts_at", cutoff)
      .lt("last_seen_at", cutoff);

    if (error) {
      console.error("booking-buddy: pruning expired feed events failed", error);
    }
  } catch (thrown) {
    console.error("booking-buddy: pruning expired feed events threw", thrown);
  }
}

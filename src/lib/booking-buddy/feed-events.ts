/**
 * The one `org_feed_events` upsert, shared by the Calendar Feed's own confirm/
 * dismiss actions (`actions/calendar-feed.ts`) and the merged email+feed
 * confirm (`actions/email-sync.ts`, issue #348) — both settle the feed side of
 * an import the same way: one mutable row per seen VEVENT UID, keyed on
 * `(owner_id, org_id, uid)`, carrying its `status` and the `booking_id` it
 * settled to.
 *
 * Takes the Supabase client as a parameter and imports nothing from Next.js —
 * a `"use server"` module can't export a non-action helper, so the caller owns
 * its own `revalidatePath`. `last_seen_at` is stamped here so a manual
 * confirm/dismiss counts as "seen this sync" for the cancellation diff's
 * in-window pruning.
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

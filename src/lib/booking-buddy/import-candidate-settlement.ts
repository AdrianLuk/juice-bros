/**
 * Settling an Import Candidate (CONTEXT.md's **Settle**, issue #606): taking
 * it to its final state for every source it came from.
 *
 * One module owns the whole rule, which used to be spread over five Server
 * Actions with three copies of the duplicate guard:
 *
 *  - **Confirm** (`settleCandidate`): the confirm-time duplicate guard, then
 *    the Booking insert, then one ledger row per source, all tied to the
 *    Booking: `processed_messages` `confirmed` for an email, `org_feed_events`
 *    `imported` for a feed event. A merged card writes both.
 *  - **Dismiss** (`dismissCandidate`): no Booking. `processed_messages`
 *    `dismissed` and/or `org_feed_events` `dismissed`, then the slot in
 *    `dismissed_reservations` (issue #437) when the candidate carries one.
 *
 * Takes the caller's `SupabaseClient`, so every write is RLS-scoped to the
 * caller's own rows, and returns an outcome rather than revalidating: the
 * Server Actions in front of it (`actions/import-candidates.ts`) own the
 * session, the email sync entitlement, analytics and `revalidatePath`.
 * Relative imports only, so `npm run test:db` runs it against local Supabase.
 *
 * Cancellations, updates and "Keep booking" join in issue #609.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { insertBooking } from "./booking-writes.ts";
import type { NewBooking } from "./bookings.ts";
import { clockInZone, todayInZone } from "./datetime.ts";
import { recordDismissedSlot } from "./dismissed-reservations.ts";
import { upsertFeedEventRow } from "./feed-events.ts";
import { findSameReservation } from "./import-candidate-shaping.ts";
import type { Candidate } from "./import-candidate-token.ts";
import type { MailboxProvider } from "./mailbox-provider.ts";
import { isKnownTimeZone } from "./timezone.ts";

export type SettleOutcome =
  /** A new Booking was created. `playersError` is set when it committed but its Players didn't. */
  | { status: "settled"; bookingId: string; playersError: string | null }
  /** A Booking already covered this reservation; the sources were linked to it and nothing new was made. */
  | { status: "duplicate"; bookingId: string }
  | { status: "error"; message: string };

export type DismissOutcome = { status: "settled" } | { status: "error"; message: string };

type SettleInput = {
  ownerId: string;
  candidate: Candidate;
  /**
   * Which provider an email source's `processed_messages` row is recorded
   * under (the email sync entitlement's answer). Null for a feed-only
   * candidate, which has no such row.
   */
  provider: MailboxProvider | null;
};

const CONFIRM_FAILED = "Couldn't confirm that booking. Try again.";
const DISMISS_FAILED = "Couldn't dismiss that. Try again.";

/**
 * The Booking already on file for this reservation, if any: the confirm-time
 * duplicate guard (issue #294, ADR-0019).
 *
 * The review list already drops a candidate that duplicates a Booking when
 * it's shaped, but that ran before anything on this screen was confirmed.
 * Confirming a feed card and then an email card for the same slot (or the
 * same card in two tabs) would otherwise make a second Booking.
 *
 * Read in the Org's own zone, UTC when Postgres somehow holds a zone `Intl`
 * won't take. Cross-source, so court is compared by number, not by text: the
 * Booking covering this slot may have come from the other source, which
 * writes `"#9"` where this one says `"#9 - Hard"` (issue #432). A failed read
 * finds nothing, and the insert goes ahead as it would have before the guard.
 */
async function findBookingOnFile(
  supabase: SupabaseClient,
  ownerId: string,
  booking: NewBooking,
): Promise<{ id: string } | undefined> {
  const [{ data: org }, { data: rows }] = await Promise.all([
    supabase
      .from("orgs")
      .select("time_zone")
      .eq("id", booking.orgId)
      .eq("owner_id", ownerId)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select("id, org_id, court_label, starts_at")
      .eq("owner_id", ownerId)
      .eq("org_id", booking.orgId),
  ]);

  const zone = org?.time_zone && isKnownTimeZone(org.time_zone) ? org.time_zone : "UTC";

  return findSameReservation(
    booking,
    (rows ?? []).map((row) => ({
      id: row.id as string,
      orgId: row.org_id as string,
      courtLabel: row.court_label as string | null,
      date: todayInZone(zone, new Date(row.starts_at)),
      startTime: clockInZone(zone, new Date(row.starts_at)),
    })),
  );
}

/**
 * Write the ledger row for each source the candidate carries. Returns whether
 * any of them failed; each failure is logged here.
 *
 * A `processed_messages` unique violation is not a failure: the message was
 * already settled (a double-submit, another tab), and "this is handled" is
 * already true. `org_feed_events` is an upsert on its own key, so a repeat is
 * simply the same row again.
 *
 * A confirmed feed row is keyed on the Booking's Org, which is the feed's own
 * unless the User changed the card's Facility select: Postgres only lets a
 * feed event link to a Booking in its own Org. A dismissed one has no Booking
 * and stays under the feed's Org.
 */
async function recordSources(
  supabase: SupabaseClient,
  ownerId: string,
  input: SettleInput,
  settlement:
    | { outcome: "confirmed"; bookingId: string; bookingOrgId: string }
    | { outcome: "dismissed"; bookingId: null },
): Promise<{ failed: boolean }> {
  const { candidate, provider } = input;
  let failed = false;

  if (candidate.messageId !== null && provider !== null) {
    const { error } = await supabase.from("processed_messages").insert({
      owner_id: ownerId,
      provider,
      provider_message_id: candidate.messageId,
      outcome: settlement.outcome,
      // Ties a confirmed message to its Booking (issue #286): the FK cascades,
      // so deleting that Booking later removes this row and the next sync
      // re-offers the email. A null here on a confirm would suppress the
      // email for good.
      booking_id: settlement.bookingId,
    });
    if (error && (error as { code?: string }).code !== "23505") {
      console.error("booking-buddy: recording a settled mailbox message failed", error);
      failed = true;
    }
  }

  if (candidate.feed !== null) {
    const { error } = await upsertFeedEventRow(supabase, ownerId, {
      orgId: settlement.outcome === "confirmed" ? settlement.bookingOrgId : candidate.feed.orgId,
      uid: candidate.feed.uid,
      sequence: candidate.feed.sequence,
      startsAt: candidate.feed.startsAt,
      status: settlement.outcome === "confirmed" ? "imported" : "dismissed",
      bookingId: settlement.bookingId,
    });
    if (error) {
      console.error("booking-buddy: recording a settled feed event failed", error);
      failed = true;
    }
  }

  return { failed };
}

/**
 * Confirm an Import Candidate: one Booking for the reservation, and every
 * source the candidate came from settled against it.
 *
 * When a Booking already covers the slot, nothing new is made and the sources
 * are linked to that one, exactly as if this confirm had created it.
 *
 * A ledger write that fails here is logged, not reported: the Booking is real
 * either way, and a later sync's own duplicate check recognises the
 * reservation against it.
 */
export async function settleCandidate(
  supabase: SupabaseClient,
  input: SettleInput & { booking: NewBooking; now?: Date },
): Promise<SettleOutcome> {
  if (input.candidate.messageId !== null && input.provider === null) {
    return { status: "error", message: CONFIRM_FAILED };
  }

  const onFile = await findBookingOnFile(supabase, input.ownerId, input.booking);

  let outcome: SettleOutcome;
  if (onFile) {
    outcome = { status: "duplicate", bookingId: onFile.id };
  } else {
    const written = await insertBooking(supabase, input.ownerId, input.booking, input.now);
    if ("error" in written) {
      return { status: "error", message: written.error };
    }
    outcome = { status: "settled", bookingId: written.bookingId, playersError: written.playersError };
  }

  await recordSources(supabase, input.ownerId, input, {
    outcome: "confirmed",
    bookingId: outcome.bookingId,
    bookingOrgId: input.booking.orgId,
  });

  return outcome;
}

/**
 * Dismiss an Import Candidate. Never touches a Booking (CONTEXT.md's Import
 * Candidate entry): it records each source as `dismissed`, so a later sync
 * skips the message or the still-listed feed event, and then the slot, so
 * neither source offers the reservation again (issue #437).
 *
 * The slot is redundant while both source rows land, and it is what still
 * holds if a source hands the reservation back under a new key: a re-issued
 * VEVENT UID, or a message id this sync never saw. It is written only once
 * the source rows have, and its own failure is logged, not reported (see
 * `recordDismissedSlot`). A source row that fails is reported, so the User can
 * try again.
 */
export async function dismissCandidate(
  supabase: SupabaseClient,
  input: SettleInput,
): Promise<DismissOutcome> {
  if (input.candidate.messageId !== null && input.provider === null) {
    return { status: "error", message: DISMISS_FAILED };
  }

  const { failed } = await recordSources(supabase, input.ownerId, input, {
    outcome: "dismissed",
    bookingId: null,
  });
  if (failed) {
    return { status: "error", message: DISMISS_FAILED };
  }

  if (input.candidate.slot !== null) {
    await recordDismissedSlot(supabase, input.ownerId, input.candidate.slot);
  }

  return { status: "settled" };
}

/**
 * Settling an Import Candidate (CONTEXT.md's **Settle**, issue #606): taking
 * it to its final state for every source it came from.
 *
 * One module owns the whole rule, which used to be spread over eleven Server
 * Actions with three copies of the duplicate guard:
 *
 *  - **Confirm** (`confirmCandidate`), by kind:
 *     - an import: the confirm-time duplicate guard, then the Booking insert,
 *       then one ledger row per source, all tied to the Booking:
 *       `processed_messages` `confirmed` for an email, `org_feed_events`
 *       `imported` for a feed event. A merged card writes both.
 *     - a cancellation: the Booking is removed and **every** source's record
 *       of it is settled, not only the one that reported the cancellation
 *       (issue #609): each email linked to it is re-recorded `cancelled`, each
 *       feed event linked to it is marked `dismissed`.
 *     - an update: the Booking is edited in place and the email recorded
 *       `updated`, tied to it.
 *  - **Dismiss** (`dismissCandidate`): no Booking. Each source is recorded
 *    `dismissed`, and an import's slot goes in `dismissed_reservations` (issue
 *    #437). A cancellation's or an update's Dismiss ("Keep booking" on a feed
 *    cancellation) records no slot: it means keep the Booking, not "I don't
 *    want this reservation".
 *
 * Takes the caller's `SupabaseClient`, so every write is RLS-scoped to the
 * caller's own rows, and returns an outcome rather than revalidating: the
 * Server Actions in front of it (`actions/import-candidates.ts`) own the
 * session, the email sync entitlement, analytics and `revalidatePath`.
 * Relative imports only, so `npm run test:db` runs it against local Supabase.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { applyBookingUpdate, insertBooking, removeBooking } from "./booking-writes.ts";
import { REMOVE_FAILED, UPDATE_FAILED, type BookingUpdateApplication, type NewBooking } from "./bookings.ts";
import { clockInZone, todayInZone } from "./datetime.ts";
import { recordDismissedSlot } from "./dismissed-reservations.ts";
import { upsertFeedEventRow } from "./feed-events.ts";
import { findSameReservation } from "./import-candidate-shaping.ts";
import type {
  CancellationCandidate,
  Candidate,
  ImportCandidate,
  KnownFeedEvent,
  UpdateCandidate,
} from "./import-candidate-token.ts";
import type { MailboxProvider } from "./mailbox-provider.ts";
import { isKnownTimeZone } from "./timezone.ts";

export type ConfirmOutcome =
  /**
   * The candidate's Booking was created, removed or updated. `playersError` is
   * set when an insert or update committed but its Players didn't.
   */
  | { status: "settled"; bookingId: string; playersError: string | null }
  /** A Booking already covered this reservation; the sources were linked to it and nothing new was made. */
  | { status: "duplicate"; bookingId: string }
  /**
   * Nothing to show for it but `message`, for the User. That includes a feed
   * cancellation whose event is no longer linked to the Booking it names,
   * which writes nothing.
   */
  | { status: "error"; message: string };

export type DismissOutcome = { status: "settled" } | { status: "error"; message: string };

type Caller = {
  ownerId: string;
  /**
   * Which provider an email source's `processed_messages` row is recorded
   * under (the email sync entitlement's answer). Null for a feed-only
   * candidate, which has no such row.
   */
  provider: MailboxProvider | null;
};

/**
 * What confirming each kind needs besides the candidate: the Booking fields an
 * import or an update re-validated. `kind` repeats `candidate.kind` because
 * TypeScript narrows a union only by a discriminant at its own top level, so
 * a switch on `candidate.kind` would leave `booking` and `update` out of reach.
 */
export type ConfirmRequest =
  | { kind: "import"; candidate: ImportCandidate; booking: NewBooking }
  | { kind: "cancellation"; candidate: CancellationCandidate }
  | { kind: "update"; candidate: UpdateCandidate; update: BookingUpdateApplication };

/** What a confirm or a dismiss says when it can't go ahead. The Server Actions say the same for a post that doesn't decode. */
export const CONFIRM_FAILED = "Couldn't confirm that booking. Try again.";
export const DISMISS_FAILED = "Couldn't dismiss that. Try again.";
const LINK_CHANGED = "That booking has already changed. Sync again.";

const CONFIRM_FAILED_BY_KIND: Record<Candidate["kind"], string> = {
  import: CONFIRM_FAILED,
  cancellation: REMOVE_FAILED,
  update: UPDATE_FAILED,
};

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}

/**
 * Record one mailbox message settled, in `processed_messages`. Returns whether
 * the write failed; a failure is logged here.
 *
 * A unique violation is not a failure: the message was already settled (a
 * double-submit, another tab), and "this is handled" is already true.
 *
 * `bookingId` ties a confirmed or updated message to its Booking (issue #286):
 * the FK cascades, so deleting that Booking later removes this row and the
 * next sync re-offers the email. A null there would suppress the email for
 * good, which is only right for a dismissal.
 */
async function recordMessage(
  supabase: SupabaseClient,
  caller: Caller & { provider: MailboxProvider },
  messageId: string,
  settled: { outcome: "confirmed" | "updated" | "dismissed"; bookingId: string | null },
): Promise<{ failed: boolean }> {
  const { error } = await supabase.from("processed_messages").insert({
    owner_id: caller.ownerId,
    provider: caller.provider,
    provider_message_id: messageId,
    outcome: settled.outcome,
    booking_id: settled.bookingId,
  });
  if (error && !isUniqueViolation(error)) {
    console.error(`booking-buddy: recording a mailbox message ${settled.outcome} failed`, error);
    return { failed: true };
  }
  return { failed: false };
}

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
 * Write the ledger row for each source an import carries. Returns whether
 * any of them failed; each failure is logged here.
 *
 * A repeat is safe for both: `recordMessage` takes an email already on file
 * as handled, and `org_feed_events` is an upsert on its own key, so a repeat
 * is simply the same row again.
 *
 * A confirmed feed row is keyed on the Booking's Org, which is the feed's own
 * unless the User changed the card's Facility select: Postgres only lets a
 * feed event link to a Booking in its own Org. A dismissed one has no Booking
 * and stays under the feed's Org.
 */
async function recordImportSources(
  supabase: SupabaseClient,
  caller: Caller,
  candidate: ImportCandidate,
  settlement:
    | { outcome: "confirmed"; bookingId: string; bookingOrgId: string }
    | { outcome: "dismissed"; bookingId: null },
): Promise<{ failed: boolean }> {
  let failed = false;

  if (candidate.messageId !== null && caller.provider !== null) {
    failed = (
      await recordMessage(supabase, { ...caller, provider: caller.provider }, candidate.messageId, settlement)
    ).failed;
  }

  if (candidate.feed !== null) {
    const { error } = await upsertFeedEventRow(supabase, caller.ownerId, {
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
 * Leave one feed event a sync already recorded `dismissed` and unlinked, so a
 * later sync neither offers a still-listed event as an import nor diffs a
 * vanished one as a cancellation. Returns the write's error, or null.
 *
 * An update first, not an upsert: the row is one a sync wrote, and its
 * `sequence` stays as that sync recorded it rather than being overwritten with
 * a number this card never knew. Only when no row matched (pruned, or purged
 * with the Facility's feed URL since the review) is a fresh one inserted, with
 * the column's default `sequence` and the start the card carried. A sync that
 * writes the row between the two leaves a unique violation, and the update is
 * simply run again against its row. `last_seen_at` is stamped as every manual
 * settle stamps it.
 */
async function dismissFeedEvent(
  supabase: SupabaseClient,
  ownerId: string,
  event: KnownFeedEvent,
): Promise<unknown> {
  const dismissed = { status: "dismissed", booking_id: null, last_seen_at: new Date().toISOString() };
  const update = () =>
    supabase
      .from("org_feed_events")
      .update(dismissed)
      .eq("owner_id", ownerId)
      .eq("org_id", event.orgId)
      .eq("uid", event.uid)
      .select("uid");

  const updated = await update();
  if (updated.error || updated.data.length > 0) {
    return updated.error;
  }

  const { error } = await supabase.from("org_feed_events").insert({
    owner_id: ownerId,
    org_id: event.orgId,
    uid: event.uid,
    starts_at: event.startsAt,
    ...dismissed,
  });
  if (!isUniqueViolation(error)) {
    return error;
  }
  return (await update()).error;
}

/**
 * Dismiss each feed event (`dismissFeedEvent`). Returns whether any write
 * failed; each failure is logged here.
 */
async function dismissFeedEvents(
  supabase: SupabaseClient,
  ownerId: string,
  events: readonly KnownFeedEvent[],
): Promise<{ failed: boolean }> {
  const errors = (
    await Promise.all(events.map((event) => dismissFeedEvent(supabase, ownerId, event)))
  ).filter(Boolean);

  for (const error of errors) {
    console.error("booking-buddy: dismissing a settled feed event failed", error);
  }
  return { failed: errors.length > 0 };
}

/**
 * Confirm an import: one Booking for the reservation, and every source the
 * candidate came from settled against it.
 *
 * When a Booking already covers the slot, nothing new is made and the sources
 * are linked to that one, exactly as if this confirm had created it.
 *
 * A ledger write that fails here is logged, not reported: the Booking is real
 * either way, and a later sync's own duplicate check recognises the
 * reservation against it.
 */
async function confirmImport(
  supabase: SupabaseClient,
  caller: Caller,
  candidate: ImportCandidate,
  booking: NewBooking,
  now: Date | undefined,
): Promise<ConfirmOutcome> {
  const onFile = await findBookingOnFile(supabase, caller.ownerId, booking);

  let outcome: ConfirmOutcome & { bookingId: string };
  if (onFile) {
    outcome = { status: "duplicate", bookingId: onFile.id };
  } else {
    const written = await insertBooking(supabase, caller.ownerId, booking, now);
    if ("error" in written) {
      return { status: "error", message: written.error };
    }
    outcome = { status: "settled", bookingId: written.bookingId, playersError: written.playersError };
  }

  await recordImportSources(supabase, caller, candidate, {
    outcome: "confirmed",
    bookingId: outcome.bookingId,
    bookingOrgId: booking.orgId,
  });

  return outcome;
}

/**
 * Confirm a cancellation: remove the Booking it was matched to (issue #65,
 * #296), and settle every source that reservation came from, whichever one
 * reported the cancellation (issue #609).
 *
 * A feed cancellation's link is re-checked first rather than trusted from the
 * card: only a feed event still `imported` and linked to this same Booking is
 * one the review matched. A link that has moved since is an error that says
 * so, and nothing is written.
 *
 * Each source's record of the Booking is read before the delete, while the
 * links still hold, because the delete breaks them:
 *
 *  - `processed_messages.booking_id` cascades, which is right when the User
 *    deletes a Booking from the Bookings page (that email should be offered
 *    again) and wrong here: the reservation is cancelled, not something to
 *    re-import. So each linked message is re-recorded `cancelled`, alongside
 *    the cancellation email itself. `processed_messages` is insert-only, so
 *    these are fresh rows where the cascade removed the old ones.
 *  - `org_feed_events.booking_id` is set null, which would leave the event
 *    `imported` with no link, and a feed still listing it offers it again as
 *    an import. So each linked event, and the feed cancellation's own, is
 *    marked `dismissed`.
 *
 * A read that fails stops the cancellation before the delete, reported as the
 * same failure as a delete that didn't happen: the Booking is still there, and
 * trying again reads afresh.
 *
 * A record that fails after the delete is logged, not reported: the Booking is
 * gone, which is what the User asked for. The worst case is that source
 * offering the reservation once more, for one Dismiss to settle.
 */
async function confirmCancellation(
  supabase: SupabaseClient,
  caller: Caller,
  candidate: CancellationCandidate,
): Promise<ConfirmOutcome> {
  const { bookingId } = candidate;
  if (bookingId === null) {
    return { status: "error", message: REMOVE_FAILED };
  }

  if (candidate.feed !== null) {
    const { data: seenRow } = await supabase
      .from("org_feed_events")
      .select("status, booking_id")
      .eq("owner_id", caller.ownerId)
      .eq("org_id", candidate.feed.orgId)
      .eq("uid", candidate.feed.uid)
      .maybeSingle();

    if (!seenRow || seenRow.status !== "imported" || seenRow.booking_id !== bookingId) {
      return { status: "error", message: LINK_CHANGED };
    }
  }

  const [
    { data: linkedMessages, error: messagesError },
    { data: linkedFeedEvents, error: feedEventsError },
  ] = await Promise.all([
    supabase
      .from("processed_messages")
      .select("provider, provider_message_id")
      .eq("owner_id", caller.ownerId)
      .eq("booking_id", bookingId),
    supabase
      .from("org_feed_events")
      .select("org_id, uid, starts_at")
      .eq("owner_id", caller.ownerId)
      .eq("booking_id", bookingId),
  ]);

  // Without both lists there is no knowing which records the delete is about
  // to break, so nothing is deleted: the User tries again.
  if (messagesError || feedEventsError) {
    console.error(
      "booking-buddy: reading a cancelled Booking's sources failed",
      messagesError ?? feedEventsError,
    );
    return { status: "error", message: REMOVE_FAILED };
  }

  const removed = await removeBooking(supabase, bookingId);
  if ("error" in removed) {
    return { status: "error", message: removed.error };
  }

  const messages = [
    ...(candidate.messageId !== null && caller.provider !== null
      ? [{ provider: caller.provider, provider_message_id: candidate.messageId }]
      : []),
    ...(linkedMessages ?? []),
  ];
  if (messages.length > 0) {
    const { error } = await supabase.from("processed_messages").insert(
      messages.map((message) => ({
        owner_id: caller.ownerId,
        provider: message.provider,
        provider_message_id: message.provider_message_id,
        outcome: "cancelled" as const,
      })),
    );
    if (error) {
      console.error("booking-buddy: recording a cancelled mailbox message failed", error);
    }
  }

  // The feed cancellation's own event is among the linked ones (its link was
  // just checked), so the keys are de-duplicated rather than written twice.
  const feedEvents = new Map<string, KnownFeedEvent>();
  for (const event of [
    ...(candidate.feed !== null ? [candidate.feed] : []),
    ...(linkedFeedEvents ?? []).map((row) => ({
      orgId: row.org_id as string,
      uid: row.uid as string,
      startsAt: row.starts_at as string,
    })),
  ]) {
    feedEvents.set(`${event.orgId}\n${event.uid}`, event);
  }
  await dismissFeedEvents(supabase, caller.ownerId, [...feedEvents.values()]);

  return { status: "settled", bookingId, playersError: null };
}

/**
 * Confirm an update: apply it to the Booking the card names (issue #91,
 * widened by #458), then record the email `updated`, tied to that Booking
 * (issue #286), so deleting the Booking later re-offers the email.
 *
 * Recorded even when the Booking committed and only its Players didn't, the
 * same as an import: the update is applied, and the Players-only failure is
 * reported for the User to fix from Edit Booking.
 */
async function applyUpdate(
  supabase: SupabaseClient,
  caller: Caller & { provider: MailboxProvider },
  candidate: UpdateCandidate,
  update: BookingUpdateApplication,
  now: Date | undefined,
): Promise<ConfirmOutcome> {
  const written = await applyBookingUpdate(supabase, caller.ownerId, update, now);
  if ("error" in written) {
    return { status: "error", message: written.error };
  }

  await recordMessage(supabase, caller, candidate.messageId, {
    outcome: "updated",
    bookingId: written.bookingId,
  });

  return { status: "settled", bookingId: written.bookingId, playersError: written.playersError };
}

/**
 * Confirm an Import Candidate of any kind: "Add to my bookings", "Remove
 * booking", "Apply update" (or a suggested match's "Yes, update it").
 */
export async function confirmCandidate(
  supabase: SupabaseClient,
  input: Caller & ConfirmRequest & { now?: Date },
): Promise<ConfirmOutcome> {
  const { ownerId, provider } = input;
  if (input.candidate.messageId !== null && provider === null) {
    return { status: "error", message: CONFIRM_FAILED_BY_KIND[input.kind] };
  }

  switch (input.kind) {
    case "import":
      return confirmImport(supabase, { ownerId, provider }, input.candidate, input.booking, input.now);
    case "cancellation":
      return confirmCancellation(supabase, { ownerId, provider }, input.candidate);
    case "update":
      // An update always has an email source, so the guard above already
      // refused this; checked again here so the type says so too.
      if (provider === null) {
        return { status: "error", message: UPDATE_FAILED };
      }
      return applyUpdate(supabase, { ownerId, provider }, input.candidate, input.update, input.now);
  }
}

/**
 * Dismiss a cancellation or an update ("Keep booking" on a feed
 * cancellation): record its source `dismissed` and leave the Booking as it
 * is. No slot: dismissing one means keep this Booking, not "I don't want this
 * reservation", and suppressing a future import of a slot the User is still
 * playing would be the opposite of what they asked for (issue #437).
 *
 * A feed event's link is cleared too: the feed no longer tracks this
 * reservation, so a later sync doesn't flag the same vanished event again.
 */
async function keepBooking(
  supabase: SupabaseClient,
  caller: Caller,
  candidate: CancellationCandidate | UpdateCandidate,
): Promise<{ failed: boolean }> {
  let failed = false;

  if (candidate.messageId !== null && caller.provider !== null) {
    failed = (
      await recordMessage(supabase, { ...caller, provider: caller.provider }, candidate.messageId, {
        outcome: "dismissed",
        bookingId: null,
      })
    ).failed;
  }

  if (candidate.kind === "cancellation" && candidate.feed !== null) {
    failed = (await dismissFeedEvents(supabase, caller.ownerId, [candidate.feed])).failed || failed;
  }

  return { failed };
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
  input: Caller & { candidate: Candidate },
): Promise<DismissOutcome> {
  const { candidate, ownerId, provider } = input;
  if (candidate.messageId !== null && provider === null) {
    return { status: "error", message: DISMISS_FAILED };
  }

  if (candidate.kind !== "import") {
    const { failed } = await keepBooking(supabase, { ownerId, provider }, candidate);
    return failed ? { status: "error", message: DISMISS_FAILED } : { status: "settled" };
  }

  const { failed } = await recordImportSources(supabase, { ownerId, provider }, candidate, {
    outcome: "dismissed",
    bookingId: null,
  });
  if (failed) {
    return { status: "error", message: DISMISS_FAILED };
  }

  if (candidate.slot !== null) {
    await recordDismissedSlot(supabase, ownerId, candidate.slot);
  }

  return { status: "settled" };
}

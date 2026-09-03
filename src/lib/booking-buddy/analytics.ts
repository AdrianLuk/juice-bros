import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { track } from "@vercel/analytics/server";

import { createClient } from "./supabase/server.ts";
import type { MailboxProvider } from "./mailbox-provider.ts";

/**
 * The onboarding-funnel events (issue #179). Emitted server-side — every one
 * is gated on a database check ("is this the caller's first Facility?") that
 * can't be trusted from the client — via `@vercel/analytics/server`, which
 * reads the current request's context for session attribution.
 *
 * Fire each of these from inside `after()` so a slow or failing analytics
 * round trip never delays the action it's measuring. Payloads carry no PII
 * (issue #179's scope) — the funnel read joins events by visitor session in
 * the Vercel Analytics console, not by anything in the payload.
 *
 * `bb_onboarding_intent` (`{ intent }`) is deliberately absent: it needs the
 * intent selector #176 adds to the Onboarding modal, and is wired there. See
 * `booking-buddy/docs/adr/0014-onboarding-funnel-analytics.md`.
 */
export type FunnelEvent =
  | "bb_signup"
  | "bb_first_facility"
  | "bb_first_booking"
  | "bb_first_slot"
  | "bb_first_friend"
  | "bb_slot_first_response";

/**
 * "Sync from Email" events (spec #280). Not funnel steps — these measure how
 * the mailbox integration itself is used, and every one carries a `provider`
 * dimension (`google` / `microsoft`) so the Gmail and Outlook paths can be
 * compared. `bb_email_sync_run` fires once per successful sync (with the
 * candidate count); `bb_email_sync_import` fires when a candidate is
 * confirmed into a Booking. Emitted server-side like the funnel events, for
 * the same "can't be trusted from the client" reason.
 */
export type EmailSyncEvent = "bb_email_sync_run" | "bb_email_sync_import";

/**
 * "Sync facilities" (Calendar Feed) events (issue #294, ADR-0019). The feed
 * counterpart of `EmailSyncEvent` — a separate, independent import source, so
 * its own events rather than a `source` dimension on the email ones.
 * `bb_facility_sync_run` fires once per feed run that reached at least one
 * feed (carrying the feed count, candidate count, and how many feeds errored);
 * `bb_facility_sync_import` fires when a feed candidate is confirmed into a
 * Booking; `bb_facility_sync_cancellation` fires when a feed-diff cancellation
 * candidate is confirmed and its Booking removed (issue #296).
 *
 * `bb_sync_merged_import` (issue #348) fires when a *consolidated* card — one
 * reservation that came in from both the mailbox and a calendar feed — is
 * confirmed: a single Booking, but both sources settled. Neither a pure email
 * nor a pure feed import, so its own event rather than a dimension on either.
 *
 * Issue #336 unified the two sync buttons into one "Sync bookings" action but
 * deliberately kept these two event families separate: a `bb_*_sync_run`
 * still fires per source that actually ran (both, when both are configured),
 * and the per-source dimensions (`provider`, feed/error counts) stay cleaner
 * than one event with a `source` discriminator would.
 */
export type FacilitySyncEvent =
  | "bb_facility_sync_run"
  | "bb_facility_sync_import"
  | "bb_facility_sync_cancellation"
  | "bb_sync_merged_import";

/** Emit one "Sync facilities" event. Same fail-quiet posture as `trackFunnelEvent`. */
export async function trackFacilitySyncEvent(
  event: FacilitySyncEvent,
  properties?: Record<string, string | number | boolean | null>,
): Promise<void> {
  try {
    await track(event, properties);
  } catch (error) {
    console.error(`booking-buddy: emitting ${event} failed`, error);
  }
}

/**
 * Calendar quick-create (spec #303). Not a funnel step — `bb_first_booking`
 * still owns the 0→1 transition from every entry point. This one fires on
 * *every* Booking logged straight from a dashboard calendar cell's `+`, so
 * the calendar entry point can be weighed against the FAB and the Bookings
 * page. Server-emitted from inside `after()` like the funnel events, for the
 * same "can't be trusted from the client" reason.
 */
export type BookingEntryEvent = "bb_booking_via_calendar";

/** Emit `bb_booking_via_calendar`. Same fail-quiet posture as `trackFunnelEvent`. */
export async function trackBookingViaCalendar(): Promise<void> {
  const event: BookingEntryEvent = "bb_booking_via_calendar";
  try {
    await track(event);
  } catch (error) {
    console.error(`booking-buddy: emitting ${event} failed`, error);
  }
}

/** Emit one `provider`-dimensioned email-sync event. Same fail-quiet posture as `trackFunnelEvent`. */
export async function trackEmailSyncEvent(
  event: EmailSyncEvent,
  provider: MailboxProvider,
  properties?: Record<string, string | number | boolean | null>,
): Promise<void> {
  try {
    await track(event, { provider, ...properties });
  } catch (error) {
    console.error(`booking-buddy: emitting ${event} failed`, error);
  }
}

/**
 * Emit one funnel event. Swallows everything: the `track` SDK already fails
 * quiet in most cases, and the one thing analytics must never do is turn a
 * successful Booking (or signup, or RSVP) into a visible error. In local dev
 * with no `VERCEL_URL` the SDK console-logs `Track "<event>"` instead of
 * sending — that's the manual verification path.
 */
export async function trackFunnelEvent(
  event: FunnelEvent,
  properties?: Record<string, string | number | boolean | null>,
): Promise<void> {
  try {
    await track(event, properties);
  } catch (error) {
    console.error(`booking-buddy: emitting ${event} failed`, error);
  }
}

/**
 * Fire `bb_signup` exactly once per account, on the first authenticated
 * session we see — called from every auth entry point (the callback route
 * and the password/Google sign-in actions).
 *
 * The set-once guard is the `funnel_signup_at is null` filter on the update:
 * only the call that actually stamps the column gets a row back, so only it
 * emits. A pre-existing account backfills this on its next sign-in — a
 * one-time, harmless late `bb_signup` for the handful of accounts that
 * predate this column.
 */
export async function trackSignupOnce(userId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ funnel_signup_at: new Date().toISOString() })
    .eq("id", userId)
    .is("funnel_signup_at", null)
    .select("id");

  if (error) {
    console.error("booking-buddy: stamping funnel_signup_at failed", error);
    return;
  }

  if (data?.length) {
    await trackFunnelEvent("bb_signup");
  }
}

/**
 * Count rows in `table` scoped to `owner_id`, returning `null` on a read
 * error so a caller can tell "couldn't check" from "not the first". `table`
 * is a fixed literal at every call site, never user input.
 */
async function countOwned(
  supabase: SupabaseClient,
  table: "orgs" | "bookings" | "slots",
  ownerId: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);

  if (error) {
    console.error(`booking-buddy: counting ${table} for the funnel failed`, error);
    return null;
  }

  return count ?? null;
}

/** `after()` helper: emit `bb_first_facility` if this Org is the caller's first. */
export async function trackFirstFacility(ownerId: string): Promise<void> {
  const supabase = await createClient();
  if ((await countOwned(supabase, "orgs", ownerId)) === 1) {
    await trackFunnelEvent("bb_first_facility");
  }
}

/** `after()` helper: emit `bb_first_booking` if this Booking is the caller's first. */
export async function trackFirstBooking(ownerId: string): Promise<void> {
  const supabase = await createClient();
  if ((await countOwned(supabase, "bookings", ownerId)) === 1) {
    await trackFunnelEvent("bb_first_booking");
  }
}

/**
 * `after()` helper: emit `bb_first_slot` if this Slot is the caller's first.
 * `slots` RLS also returns friends' visible Slots, hence the `owner_id`
 * filter in `countOwned` rather than trusting the row set.
 */
export async function trackFirstSlot(ownerId: string): Promise<void> {
  const supabase = await createClient();
  if ((await countOwned(supabase, "slots", ownerId)) === 1) {
    await trackFunnelEvent("bb_first_slot");
  }
}

/**
 * `after()` helper: emit `bb_first_friend` if this is the accepter's first
 * accepted Connection. Fires for the accepter only — the requester gains
 * their first friend at the same moment but runs no code here, and a server
 * `track()` "for" them would misattribute to the accepter's session.
 */
export async function trackFirstFriend(accepterId: string): Promise<void> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("connections")
    .select("id", { count: "exact", head: true })
    .eq("status", "accepted")
    .or(`requester_id.eq.${accepterId},addressee_id.eq.${accepterId}`);

  if (error) {
    console.error("booking-buddy: counting connections for the funnel failed", error);
    return;
  }

  if (count === 1) {
    await trackFunnelEvent("bb_first_friend");
  }
}

/**
 * Whether `slotId` currently has zero Responses. Check this *before* a
 * Response write so `respondToSlot`'s upsert (someone changing their own
 * answer) can't re-fire `bb_slot_first_response`. Pass the client the action
 * already holds — the caller's own for a signed-in responder, the admin
 * client for the Guest path.
 */
export async function slotHasNoResponsesYet(
  supabase: SupabaseClient,
  slotId: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from("responses")
    .select("id", { count: "exact", head: true })
    .eq("slot_id", slotId);

  if (error) {
    console.error("booking-buddy: counting responses for the funnel failed", error);
    return false;
  }

  return count === 0;
}

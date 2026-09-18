import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { track } from "@vercel/analytics/server";

import type { OnDeckFunnelEvent } from "./analytics-events.ts";

/**
 * The server half of the adoption funnel (issue #524), copied in shape from
 * `src/lib/booking-buddy/analytics.ts` and ADR 0014: custom Vercel Analytics
 * events emitted after the fact from Server Actions, gated on a database check
 * the client cannot be trusted to make, with no table of our own and no
 * dashboard. The read is manual — see `on-deck/docs/adoption-funnel.md`.
 *
 * Fire each of these from inside `after()` so a slow or failing analytics
 * round trip never delays the action it is measuring. Payloads carry no PII
 * and no ids: the console joins events by visitor session, not by anything
 * sent here.
 *
 * Every gated helper takes the Supabase client its caller already holds
 * rather than building its own, following `slotHasNoResponsesYet` next door.
 * That is load-bearing here, not tidiness: `resolveOpenSessionForClub` fires
 * one of these during the home screen's *render*, and Next refuses `cookies()`
 * inside `after()` while rendering — so the client has to be one that resolved
 * them before the callback was scheduled.
 *
 * The demo's two events are not here. They are browser facts about a page with
 * no account and no database behind it, and the demo route's import graph is
 * deliberately kept clear of a Supabase client.
 */

/**
 * Emit one funnel event. Swallows everything: the `track` SDK already fails
 * quiet in most cases, and the one thing analytics must never do is turn a
 * created Club or a closed night into a visible error. In local dev with no
 * `VERCEL_URL` the SDK console-logs `Track "<event>"` instead of sending —
 * that is the manual verification path.
 */
export async function trackFunnelEvent(
  event: OnDeckFunnelEvent,
  properties?: Record<string, string | number | boolean | null>,
): Promise<void> {
  try {
    await track(event, properties);
  } catch (error) {
    console.error(`on-deck: emitting ${event} failed`, error);
  }
}

/**
 * `after()` helper: emit `od_club_created`.
 *
 * No first-time gate, unlike everything below — `on_deck_clubs_one_per_owner`
 * means an account cannot reach a second successful create, and the caller
 * already excludes the `ClubAlreadyExistsError` path that returns success for
 * a Club that was already there. Once per account falls out of the schema.
 */
export async function trackClubCreated(): Promise<void> {
  await trackFunnelEvent("od_club_created");
}

/**
 * How many Sessions this Club has ever started, or null on a read error so a
 * caller can tell "couldn't check" from "not the first".
 *
 * `started_at is not null` is what separates a Session from a `scheduled` row
 * (issue #254), which lives in the same table, has no start time, and is not a
 * night anybody has run.
 */
async function countStartedSessions(
  supabase: SupabaseClient,
  clubId: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from("on_deck_sessions")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .not("started_at", "is", null);

  if (error) {
    console.error("on-deck: counting Sessions for the funnel failed", error);
    return null;
  }

  return count ?? null;
}

/**
 * How many Sessions this Club has ever closed, or null on a read error.
 *
 * Counted off the Summaries rather than `on_deck_sessions.status`, because a
 * Summary row is written by the same transaction that closes a Session and is
 * the only permanent record of one: the event log and the roster are purged on
 * close (ADR 0001).
 */
async function countClosedSessions(
  supabase: SupabaseClient,
  clubId: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from("on_deck_session_summaries")
    .select("session_id", { count: "exact", head: true })
    .eq("club_id", clubId);

  if (error) {
    console.error("on-deck: counting closed Sessions for the funnel failed", error);
    return null;
  }

  return count ?? null;
}

/**
 * `after()` helper: emit `od_first_session_started` if this is the Club's
 * first ever Session. A post-write count of 1, the shape ADR 0014 settled on
 * — exact, idempotent, and nothing extra to keep in sync.
 *
 * Second and later nights are deliberately not counted. This funnel asks
 * whether a stranger ever ran a night at all; whether they came back is a
 * retention question, and it needs a different instrument.
 */
export async function trackFirstSessionStarted(
  supabase: SupabaseClient,
  clubId: string,
): Promise<void> {
  if ((await countStartedSessions(supabase, clubId)) === 1) {
    await trackFunnelEvent("od_first_session_started");
  }
}

/**
 * `after()` helper: emit `od_first_session_closed` if this is the Club's first
 * ever closed Session.
 *
 * `auto` separates the two ways a night ends. An Organizer who taps Close ran
 * the night to its end; one whose Session closed itself six hours after it
 * went quiet (issue #516) walked away from it, and reading those as the same
 * outcome would flatter the product at exactly the point this release is
 * trying to learn something.
 */
export async function trackFirstSessionClosed(
  supabase: SupabaseClient,
  clubId: string,
  autoClosed: boolean,
): Promise<void> {
  if ((await countClosedSessions(supabase, clubId)) === 1) {
    await trackFunnelEvent("od_first_session_closed", { auto: autoClosed });
  }
}

"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { ORGS_PATH, BOOKINGS_PATH, BOOKING_BUDDY_ROOT } from "../routes.ts";
import { type ActionResult } from "./result.ts";
import {
  readCalendarFeedAllowedHosts,
  requireMailboxLinkEncryptionKey,
} from "../env.ts";
import { validateFeedUrl } from "../calendar-feed-url.ts";
import { fetchCalendarFeed } from "../calendar-feed-client.ts";
import { encryptRefreshToken, decryptRefreshToken } from "../token-encryption.ts";
import { parseCourtReserveFeed } from "../courtreserve-feed.ts";
import { isKnownTimeZone } from "../timezone.ts";
import {
  reviewCalendarFeed,
  type CalendarFeedReviewItem,
  type CalendarFeedCancellationItem,
  type SeenFeedEvent,
} from "../calendar-feed-review.ts";
import { todayInZone, clockInZone } from "../datetime.ts";
import { upsertFeedEventRow, type FeedEventUpsert } from "../feed-events.ts";
import { parseNewBooking } from "../bookings.ts";
import { insertValidatedBooking, deleteOwnedBooking } from "./bookings.ts";
import { trackFacilitySyncEvent } from "../analytics.ts";

export type { ActionResult } from "./result.ts";
export type { CalendarFeedReviewItem, CalendarFeedCancellationItem };

/* -------------------------------------------------------------------------- */
/* Set / clear the feed URL                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Store a CourtReserve calendar-feed URL on one of the caller's Orgs, encrypted
 * at rest (issue #294, ADR-0019). The URL is validated here at save time —
 * `https:` only, host on the CourtReserve allowlist — and a bad value is
 * rejected with a reason that never echoes the URL (it carries a private
 * member token). The same rule runs again at fetch time (`fetchCalendarFeed`).
 *
 * `org_id` and `feed_url` come from the form. `feed_url` blank routes to
 * `clearCalendarFeedUrl`'s behaviour would be surprising here — a blank submit
 * is an error, "Clear feed" is its own action.
 */
export async function setCalendarFeedUrl(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const orgId = String(formData.get("org_id") ?? "").trim();
  if (!orgId) {
    return { error: "Pick which facility this feed is for." };
  }

  const rawUrl = String(formData.get("feed_url") ?? "");
  const validated = validateFeedUrl(rawUrl, readCalendarFeedAllowedHosts());
  if (!validated.ok) {
    return { error: validated.reason };
  }

  let encryptionKey: string;
  try {
    encryptionKey = requireMailboxLinkEncryptionKey();
  } catch (error) {
    console.error("booking-buddy: Mailbox Link encryption key isn't configured", error);
    return { error: "Couldn't save that feed. Try again." };
  }

  const supabase = await createClient();

  // Read the current URL first: if this save points the Org at a *different*
  // feed, its old seen-set is stale and has to go (spec #288 user story 25 —
  // "a re-pasted URL starts from a clean slate"), the same purge
  // `clearCalendarFeedUrl` does. A no-op re-save of the same URL keeps the
  // history.
  const { data: currentRows } = await supabase
    .from("orgs")
    .select("calendar_feed_url")
    .eq("id", orgId)
    .eq("owner_id", session.userId)
    .maybeSingle();

  const currentCiphertext = currentRows?.calendar_feed_url ?? null;
  const currentUrl = currentCiphertext
    ? decryptRefreshToken(currentCiphertext, encryptionKey)
    : null;
  const urlChanged = !currentUrl?.ok || currentUrl.plainText !== validated.url;

  const { data, error } = await supabase
    .from("orgs")
    .update({ calendar_feed_url: encryptRefreshToken(validated.url, encryptionKey) })
    .eq("id", orgId)
    .eq("owner_id", session.userId)
    .select("id");

  if (error || !data?.length) {
    return { error: "Couldn't save that feed. Try again." };
  }

  if (urlChanged) {
    const { error: purgeError } = await supabase
      .from("org_feed_events")
      .delete()
      .eq("org_id", orgId)
      .eq("owner_id", session.userId);
    if (purgeError) {
      console.error("booking-buddy: purging org_feed_events on feed-URL change failed", purgeError);
    }
  }

  revalidatePath(ORGS_PATH);
  revalidatePath(BOOKINGS_PATH);
  return { ok: true };
}

/**
 * Clear an Org's feed URL and purge that Org's `org_feed_events` rows (issue
 * #294 / spec #288, user story 25) — a re-pasted URL later starts from a clean
 * seen-set rather than diffing against stale history.
 */
export async function clearCalendarFeedUrl(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const orgId = String(formData.get("org_id") ?? "").trim();
  if (!orgId) {
    return { error: "Pick which facility's feed to remove." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orgs")
    .update({ calendar_feed_url: null })
    .eq("id", orgId)
    .eq("owner_id", session.userId)
    .select("id");

  if (error || !data?.length) {
    return { error: "Couldn't remove that feed. Try again." };
  }

  // App-level purge (the schema has no cascade from an Org's own column change).
  // RLS scopes this to the caller, `eq(org_id)` scopes it to this feed.
  const { error: purgeError } = await supabase
    .from("org_feed_events")
    .delete()
    .eq("org_id", orgId)
    .eq("owner_id", session.userId);

  if (purgeError) {
    // The URL is already gone, which is the user-visible effect they asked
    // for. A stale seen-set left behind only matters on a future re-paste,
    // and a later sync's own auto-link/dedupe still keeps a double Booking
    // from being created.
    console.error("booking-buddy: purging org_feed_events on feed clear failed", purgeError);
  }

  revalidatePath(ORGS_PATH);
  revalidatePath(BOOKINGS_PATH);
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Sync                                                                        */
/* -------------------------------------------------------------------------- */

/** One feed's contribution to a "Sync facilities" run — the same envelope shape the email sync returns, per Facility. */
export type FacilityFeedResult =
  | {
      orgId: string;
      status: "ok";
      items: CalendarFeedReviewItem[];
      /** Feed-diff cancellation candidates (issue #296). Empty when `feedLooksWrong`. */
      cancellations: CalendarFeedCancellationItem[];
      /** Rail 4 tripped — show the "this feed looks wrong — check the URL" warning instead of the candidates. */
      feedLooksWrong: boolean;
    }
  | { orgId: string; status: "error"; message: string };

export type SyncFacilityFeedsResult =
  | { status: "ok"; feeds: FacilityFeedResult[] }
  | { status: "error"; message: string };

type OrgFeedRow = {
  id: string;
  time_zone: string;
  calendar_feed_url: string;
};

/** The Org's own zone, or UTC when Postgres somehow holds a value `Intl` won't take. */
function feedFallbackZone(timeZone: string): string {
  return isKnownTimeZone(timeZone) ? timeZone : "UTC";
}

/**
 * Sync one feed: decrypt its URL, hardened HTTPS GET, parse, review, persist
 * the updated seen-set, and collect the import candidates. Never throws — a
 * failure comes back as `{ status: "error" }` for this one Facility so
 * `syncFacilityFeeds` can report it and carry on with the others.
 *
 * The feed URL is never put in the returned `message` or in any log line here.
 */
async function syncOneFeed(
  ownerId: string,
  org: OrgFeedRow,
  encryptionKey: string,
  now: Date,
): Promise<FacilityFeedResult> {
  const decrypted = decryptRefreshToken(org.calendar_feed_url, encryptionKey);
  if (!decrypted.ok) {
    console.error("booking-buddy: a stored calendar-feed URL wouldn't decrypt");
    return { orgId: org.id, status: "error", message: "That feed's saved link looks corrupted. Re-save it." };
  }

  const fetched = await fetchCalendarFeed(decrypted.plainText);
  if (!fetched.ok) {
    return {
      orgId: org.id,
      status: "error",
      message:
        fetched.reason === "blocked"
          ? "That feed's link isn't a CourtReserve address anymore. Re-save it."
          : "Couldn't reach that feed. Check the link and try again.",
    };
  }

  const zone = feedFallbackZone(org.time_zone);
  const { events, unreadableUids } = parseCourtReserveFeed(fetched.text, { fallbackTimeZone: zone });

  // Rail 1 — the healthy-fetch gate (ADR-0019). A 2xx body that parses to zero
  // usable events (an empty calendar, junk that isn't a calendar at all, or a
  // body every VEVENT of which failed to parse) is treated as an unhealthy
  // sync: a sync error, and **no diff runs**. A CourtReserve hiccup must never
  // read as "every reservation cancelled". The non-2xx / timeout / redirect /
  // oversize cases are already `fetched.ok === false` above.
  if (events.length === 0) {
    return {
      orgId: org.id,
      status: "error",
      message: "That feed came back empty. If it keeps happening, re-copy the URL from CourtReserve.",
    };
  }

  const supabase = await createClient();

  const [{ data: bookingRows, error: bookingError }, { data: seenRows, error: seenError }] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("id, org_id, court_label, starts_at")
        .eq("owner_id", ownerId)
        .eq("org_id", org.id),
      supabase
        .from("org_feed_events")
        .select("uid, status, starts_at, booking_id")
        .eq("owner_id", ownerId)
        .eq("org_id", org.id),
    ]);

  if (bookingError || seenError) {
    console.error("booking-buddy: reading Bookings / seen events for a feed sync failed", bookingError, seenError);
    return { orgId: org.id, status: "error", message: "Couldn't sync that feed. Try again." };
  }

  const existingBookings = (bookingRows ?? []).map((row) => ({
    id: row.id,
    orgId: row.org_id,
    courtLabel: row.court_label,
    date: todayInZone(zone, new Date(row.starts_at)),
    startTime: clockInZone(zone, new Date(row.starts_at)),
  }));

  const seenEvents: SeenFeedEvent[] = (seenRows ?? []).map((row) => ({
    uid: row.uid,
    status: row.status,
    startsAt: new Date(row.starts_at).toISOString(),
    bookingId: row.booking_id,
  }));

  const { items, autoLinked, cancellations, feedLooksWrong } = reviewCalendarFeed({
    events,
    org: { id: org.id, timeZone: zone },
    existingBookings,
    seenEvents,
    unreadableUids,
    now,
  });

  // Persist the seen-set. `upsert` on the (owner_id, org_id, uid) unique
  // constraint bumps `last_seen_at` for a row already present and inserts a
  // fresh one otherwise. A `dismissed` row is never in `items` (the review
  // filters it) or `autoLinked`, so it is not touched.
  //
  //  - every candidate  -> `pending`, `booking_id` explicitly nulled (a row
  //    that was `imported` and is now offered again — its Booking edited out
  //    of the slot — must not keep the stale link).
  //  - every auto-link  -> `imported` + linked.
  //  - every unreadable UID already on file -> its `last_seen_at` bumped, so a
  //    one-sync parse gap for a real reservation is never later diffed as a
  //    cancellation (ics-feed.ts's documented contract for `unreadableUids`).
  //    A *new* unreadable UID is not inserted — there is nothing to review and
  //    nothing yet to protect.
  const nowIso = now.toISOString();
  const rows = [
    ...items.map((item) => ({
      owner_id: ownerId,
      org_id: org.id,
      uid: item.feedEventUid,
      sequence: item.sequence,
      starts_at: startsAtFor(events, item.feedEventUid),
      status: "pending" as const,
      booking_id: null as string | null,
      last_seen_at: nowIso,
    })),
    ...autoLinked.map((link) => ({
      owner_id: ownerId,
      org_id: org.id,
      uid: link.feedEventUid,
      sequence: link.sequence,
      starts_at: link.startsAt,
      status: "imported" as const,
      booking_id: link.bookingId as string | null,
      last_seen_at: nowIso,
    })),
  ];

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from("org_feed_events")
      .upsert(rows, { onConflict: "owner_id,org_id,uid" });

    if (upsertError) {
      // Not fatal to the review — the candidates are still valid to show and
      // confirm; a missed `last_seen_at` bump only affects the (next-slice)
      // cancellation diff, and a re-run rebuilds the same set.
      console.error("booking-buddy: persisting the feed seen-set failed", upsertError);
    }
  }

  // Bump `last_seen_at` on any already-tracked UID the parser couldn't read
  // this sync — a one-sync parse gap for a real reservation must never later
  // diff as a cancellation (`ics-feed.ts`'s `unreadableUids` contract). A
  // brand-new unreadable UID isn't inserted: nothing to review, nothing yet
  // to protect.
  const seenUids = new Set(seenEvents.map((seen) => seen.uid));
  const unreadableSeen = unreadableUids.filter((uid) => seenUids.has(uid));
  if (unreadableSeen.length > 0) {
    const { error: touchError } = await supabase
      .from("org_feed_events")
      .update({ last_seen_at: nowIso })
      .eq("owner_id", ownerId)
      .eq("org_id", org.id)
      .in("uid", unreadableSeen);
    if (touchError) {
      console.error("booking-buddy: bumping last_seen_at for unreadable feed UIDs failed", touchError);
    }
  }

  return { orgId: org.id, status: "ok", items, cancellations, feedLooksWrong };
}

/** The parsed event's start instant, for the seen-event row's `starts_at`. */
function startsAtFor(
  events: readonly { uid: string; startsAt: string }[],
  uid: string,
): string {
  return events.find((event) => event.uid === uid)?.startsAt ?? new Date(0).toISOString();
}

/**
 * "Sync facilities" — every feed-configured Org the caller owns. Fetches,
 * parses, and reviews each in turn; one feed failing is reported for that
 * Facility and does not abort the rest (issue #294 acceptance criteria).
 * Returns the same status-envelope shape `syncFromEmail` returns, one entry
 * per Facility.
 *
 * Not allowlist-gated — a Calendar Feed is available to every User (ADR-0019).
 */
export async function syncFacilityFeeds(): Promise<SyncFacilityFeedsResult> {
  return runFeedSync(null);
}

/** "Sync facilities", one Org — same as `syncFacilityFeeds` but scoped to `orgId`. */
export async function syncFacilityFeed(orgId: string): Promise<SyncFacilityFeedsResult> {
  if (!orgId.trim()) {
    return { status: "error", message: "Couldn't sync that facility. Try again." };
  }
  return runFeedSync(orgId.trim());
}

async function runFeedSync(onlyOrgId: string | null): Promise<SyncFacilityFeedsResult> {
  const session = await verifySession();
  const supabase = await createClient();

  let query = supabase
    .from("orgs")
    .select("id, time_zone, calendar_feed_url")
    .eq("owner_id", session.userId)
    .not("calendar_feed_url", "is", null);

  if (onlyOrgId) {
    query = query.eq("id", onlyOrgId);
  }

  const { data: orgRows, error } = await query;

  if (error) {
    console.error("booking-buddy: reading feed-configured Orgs failed", error);
    return { status: "error", message: "Couldn't sync your facilities. Try again." };
  }

  const orgs = (orgRows ?? []) as OrgFeedRow[];
  if (orgs.length === 0) {
    return { status: "ok", feeds: [] };
  }

  let encryptionKey: string;
  try {
    encryptionKey = requireMailboxLinkEncryptionKey();
  } catch (keyError) {
    console.error("booking-buddy: Mailbox Link encryption key isn't configured", keyError);
    return { status: "error", message: "Couldn't sync your facilities. Try again." };
  }

  // One "now" for the whole run, same as `syncFromEmail`.
  const now = new Date();

  // Sequential rather than Promise.all: a hostile or slow feed shouldn't get
  // to run four outbound fetches in parallel off one click, and a real User
  // has a handful of Facilities at most.
  const feeds: FacilityFeedResult[] = [];
  for (const org of orgs) {
    feeds.push(await syncOneFeed(session.userId, org, encryptionKey, now));
  }

  const candidateCount = feeds.reduce(
    (sum, feed) =>
      sum + (feed.status === "ok" ? feed.items.length + feed.cancellations.length : 0),
    0,
  );
  const erroredCount = feeds.filter((feed) => feed.status === "error").length;

  after(() =>
    trackFacilitySyncEvent("bb_facility_sync_run", {
      feeds: feeds.length,
      candidates: candidateCount,
      errored: erroredCount,
    }),
  );

  return { status: "ok", feeds };
}

/* -------------------------------------------------------------------------- */
/* Confirm / dismiss a feed candidate                                          */
/* -------------------------------------------------------------------------- */

/**
 * Confirming a feed Import Candidate creates a real Booking (developer story
 * 12) — the form posts the same field names `CreateBookingForm` does plus
 * `org_id` and `feed_event_uid`, so it reuses `parseNewBooking`'s validation
 * as-is rather than trusting the candidate's already-parsed fields.
 *
 * The confirm-time duplicate guard (ADR-0019's "Consequences"): before the
 * insert, the parsed slot is checked against the caller's existing Bookings.
 * The review list already filters duplicates when it's shaped, but confirming
 * an email candidate and then a feed candidate for the same slot in the same
 * session would otherwise slip past — the feed review ran before the email
 * confirm created its Booking. On a hit the feed event is recorded `imported`
 * + linked to the Booking that already exists, and no second Booking is made.
 */
export async function confirmFeedCandidate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const feedEventUid = String(formData.get("feed_event_uid") ?? "").trim();
  const orgId = String(formData.get("org_id") ?? "").trim();
  if (!feedEventUid || !orgId) {
    return { error: "Couldn't confirm that booking. Try again." };
  }

  const parsed = parseNewBooking(formData);
  if ("error" in parsed) {
    return parsed;
  }

  const sequenceRaw = Number(formData.get("sequence"));
  const sequence = Number.isInteger(sequenceRaw) && sequenceRaw >= 0 ? sequenceRaw : 0;
  const startsAtRaw = String(formData.get("starts_at") ?? "").trim();
  const startsAt = startsAtRaw && !Number.isNaN(Date.parse(startsAtRaw))
    ? new Date(startsAtRaw).toISOString()
    : null;

  const supabase = await createClient();

  // The confirm-time duplicate guard. Read the caller's Bookings for this Org
  // in the Org's zone, exactly the shape `isDuplicateBooking` compares.
  const { data: orgRow } = await supabase
    .from("orgs")
    .select("time_zone")
    .eq("id", orgId)
    .eq("owner_id", session.userId)
    .maybeSingle();
  const zone = orgRow?.time_zone && isKnownTimeZone(orgRow.time_zone) ? orgRow.time_zone : "UTC";

  const { data: bookingRows } = await supabase
    .from("bookings")
    .select("id, org_id, court_label, starts_at")
    .eq("owner_id", session.userId)
    .eq("org_id", orgId);

  const existing = (bookingRows ?? []).map((row) => ({
    id: row.id,
    orgId: row.org_id,
    courtLabel: row.court_label,
    date: todayInZone(zone, new Date(row.starts_at)),
    startTime: clockInZone(zone, new Date(row.starts_at)),
  }));

  const alreadyBooked = existing.find(
    (booking) =>
      booking.orgId === parsed.orgId &&
      booking.courtLabel === parsed.courtLabel &&
      booking.date === parsed.date &&
      booking.startTime === parsed.startTime,
  );

  if (alreadyBooked) {
    // No second Booking — link the feed event to the one that already exists
    // and report success; the User's intent ("this slot is on my calendar")
    // is satisfied. `alreadyBooked` and `isDuplicateBooking` compare the same
    // four fields, so this one check covers the whole duplicate case.
    await recordFeedEvent(supabase, session.userId, {
      orgId,
      uid: feedEventUid,
      sequence,
      startsAt: startsAt ?? new Date(0).toISOString(),
      status: "imported",
      bookingId: alreadyBooked.id,
    });
    return { ok: true };
  }

  const result = await insertValidatedBooking(session.userId, parsed);
  if (!result.ok) {
    return result;
  }

  await recordFeedEvent(supabase, session.userId, {
    orgId,
    uid: feedEventUid,
    sequence,
    startsAt: startsAt ?? new Date(0).toISOString(),
    status: "imported",
    bookingId: result.bookingId ?? null,
  });

  after(() => trackFacilitySyncEvent("bb_facility_sync_import"));

  return { ok: true };
}

/**
 * Dismissing a feed candidate never touches a Booking (CONTEXT.md's Import
 * Candidate entry) — it writes the `org_feed_events` row `status = 'dismissed'`
 * so a later sync skips this event even though it's still in the feed (issue
 * #294 acceptance criteria).
 *
 * The "From facility feeds" section reuses this for the "Keep booking" control
 * on a cancellation candidate (issue #296): the User has seen that the
 * reservation left the feed and wants to keep the record anyway, so the same
 * `dismissed` row is what stops the vanished event being re-flagged on every
 * future sync. That does clear the Booking link (`booking_id` -> null), which
 * is the intended effect — the feed is no longer tracking this reservation.
 */
export async function dismissFeedCandidate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const feedEventUid = String(formData.get("feed_event_uid") ?? "").trim();
  const orgId = String(formData.get("org_id") ?? "").trim();
  if (!feedEventUid || !orgId) {
    return { error: "Couldn't dismiss that. Try again." };
  }

  const sequenceRaw = Number(formData.get("sequence"));
  const sequence = Number.isInteger(sequenceRaw) && sequenceRaw >= 0 ? sequenceRaw : 0;
  const startsAtRaw = String(formData.get("starts_at") ?? "").trim();
  const startsAt = startsAtRaw && !Number.isNaN(Date.parse(startsAtRaw))
    ? new Date(startsAtRaw).toISOString()
    : new Date(0).toISOString();

  const supabase = await createClient();
  const error = await recordFeedEvent(supabase, session.userId, {
    orgId,
    uid: feedEventUid,
    sequence,
    startsAt,
    status: "dismissed",
    bookingId: null,
  });

  if (error) {
    return { error: "Couldn't dismiss that. Try again." };
  }

  return { ok: true };
}

/**
 * Confirming a feed-diff cancellation candidate (issue #296) removes the
 * Booking it maps to. `booking_id` and `feed_event_uid` come from the review
 * screen's own hidden fields — the same posture as
 * `confirmCancellationCandidate` (email) — but this action does not trust
 * them: it re-reads the `org_feed_events` row and only proceeds if that row is
 * `imported` and still linked to the same Booking the form names. That link
 * is what `reviewCalendarFeed` resolved server-side.
 *
 * After the delete, the seen-event row is marked `dismissed` with its
 * `booking_id` cleared, so a later sync neither re-flags the (still-present,
 * explicitly-cancelled) event nor offers the vanished one again.
 */
export async function confirmFeedCancellation(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const session = await verifySession();

  const feedEventUid = String(formData.get("feed_event_uid") ?? "").trim();
  const orgId = String(formData.get("org_id") ?? "").trim();
  const bookingId = String(formData.get("booking_id") ?? "").trim();
  if (!feedEventUid || !orgId || !bookingId) {
    return { error: "Couldn't remove that booking. Try again." };
  }

  const supabase = await createClient();

  // Re-verify the link server-side — the review already resolved it, but the
  // form field must not be trusted to still hold.
  const { data: seenRow } = await supabase
    .from("org_feed_events")
    .select("status, booking_id")
    .eq("owner_id", session.userId)
    .eq("org_id", orgId)
    .eq("uid", feedEventUid)
    .maybeSingle();

  if (!seenRow || seenRow.status !== "imported" || seenRow.booking_id !== bookingId) {
    return { error: "That booking has already changed. Sync again." };
  }

  const deleteResult = await deleteOwnedBooking(bookingId);
  if (!deleteResult.ok) {
    return deleteResult;
  }

  // `on delete set null` has already nulled `booking_id`; mark it dismissed so
  // the intent ("this reservation is gone") sticks across future syncs.
  const { error: markError } = await supabase
    .from("org_feed_events")
    .update({ status: "dismissed", booking_id: null, last_seen_at: new Date().toISOString() })
    .eq("owner_id", session.userId)
    .eq("org_id", orgId)
    .eq("uid", feedEventUid);

  if (markError) {
    // Not fatal — the Booking is gone, which is what the User asked for. A
    // stale `imported`/null row is already excluded from the cancellation diff
    // (it needs a non-null `booking_id`), so the worst case is the event
    // re-surfacing once as an import candidate the User can dismiss.
    console.error("booking-buddy: marking a confirmed feed cancellation dismissed failed", markError);
  }

  after(() => trackFacilitySyncEvent("bb_facility_sync_cancellation"));

  revalidatePath(BOOKINGS_PATH);
  revalidatePath(BOOKING_BUDDY_ROOT);
  return { ok: true };
}

/**
 * Upsert one `org_feed_events` row and revalidate the Bookings surface.
 * Returns an error string or null. The row shape and conflict key live in the
 * shared `upsertFeedEventRow` (`feed-events.ts`), reused by the merged
 * email+feed confirm (issue #348).
 */
async function recordFeedEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  event: FeedEventUpsert,
): Promise<string | null> {
  const { error } = await upsertFeedEventRow(supabase, ownerId, event);

  if (error) {
    console.error("booking-buddy: recording an org_feed_events row failed", error);
    return "record failed";
  }

  revalidatePath(BOOKINGS_PATH);
  revalidatePath(BOOKING_BUDDY_ROOT);
  return null;
}

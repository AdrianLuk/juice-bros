"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { ORGS_PATH, BOOKINGS_PATH } from "../routes.ts";
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
import { pruneExpiredFeedEvents } from "../feed-events.ts";
import {
  listDismissedReservations,
  pruneExpiredDismissedReservations,
} from "../dismissed-reservations.ts";
import type { BookingIdentity } from "../import-candidate-shaping.ts";
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
      /** Events dropped against `dismissed_reservations` — the review screen names them and offers each back (issue #444). */
      suppressed: BookingIdentity[];
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
  const { events, unreadableUids, isCalendar } = parseCourtReserveFeed(fetched.text, {
    fallbackTimeZone: zone,
  });

  // Rail 1 — the healthy-fetch gate (ADR-0019). Zero usable events means **no
  // diff runs**, whatever the reason: a CourtReserve hiccup must never read as
  // "every reservation cancelled". The non-2xx / timeout / redirect / oversize
  // cases are already `fetched.ok === false` above.
  //
  // What the three remaining cases differ on is what the User is told (#431).
  // A well-formed calendar holding nothing is a *healthy* sync — they have no
  // upcoming reservations at this Facility, which is an ordinary state and not
  // a broken link. Only a body that wasn't a calendar, or one whose every
  // VEVENT failed to parse, is worth an error.
  if (events.length === 0) {
    if (isCalendar && unreadableUids.length === 0) {
      // Indistinguishable from a feed whose events all matched a Booking
      // already, and deliberately so (#438): both mean "nothing new here", and
      // the review section says that once, for every source at once.
      return {
        orgId: org.id,
        status: "ok",
        items: [],
        cancellations: [],
        suppressed: [],
        feedLooksWrong: false,
      };
    }
    return {
      orgId: org.id,
      status: "error",
      message: isCalendar
        ? "None of that feed's reservations could be read. If this keeps happening, re-copy the feed URL from CourtReserve and save it again."
        : "That link didn't return a calendar. Re-copy the feed URL from CourtReserve and save it again.",
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

  // Reservations the User has already dismissed at this Facility, from either
  // source (issue #437) — an email-side dismissal leaves no Booking behind for
  // the match above to recognise, so this list is what carries it across.
  const dismissedSlots = await listDismissedReservations(supabase, ownerId, org.id);

  const { items, autoLinked, cancellations, suppressed, feedLooksWrong } = reviewCalendarFeed({
    events,
    org: { id: org.id, timeZone: zone },
    existingBookings,
    seenEvents,
    dismissedSlots,
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

  return { orgId: org.id, status: "ok", items, cancellations, suppressed, feedLooksWrong };
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

  // One "now" for the whole run, same as `syncFromEmail`.
  const now = new Date();

  // Housekeeping (issues #447 and #452). Once for the run, not once per
  // Facility — neither prune is scoped to an Org, so running them inside the
  // loop below would repeat a delete that already found everything the first
  // time. And ahead of every early return below, so that "you have no feeds
  // configured" doesn't also mean "these tables stay as they are forever".
  //
  // Ahead of `syncOneFeed`'s own seen-set read too, so one sync run sees one
  // state of `org_feed_events` — the review diffs against exactly the rows the
  // prune left behind.
  await Promise.all([
    pruneExpiredDismissedReservations(supabase, session.userId, now),
    pruneExpiredFeedEvents(supabase, session.userId, now),
  ]);

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

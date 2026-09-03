/**
 * The composed "parsed CourtReserve feed events -> Import Candidate review
 * list" algorithm for one Org's Calendar Feed (issue #294, spec #288,
 * ADR-0019) — the feed counterpart of `reviewCourtReserveEmails`
 * (`email-sync-review.ts`).
 *
 * `import` and `cancellation` kinds (issue #296). The fresh fetch turns every
 * future-dated event that isn't already a Booking and isn't dismissed into an
 * import candidate, records the ones that already match a Booking as
 * `imported` + linked, and — the feed-diff cancellation mechanism — flags a
 * previously-seen, Booking-linked event that has vanished from the feed (or
 * now carries a cancelled status) as a cancellation candidate. Four safety
 * rails guard the diff (ADR-0019):
 *
 *   1. Healthy-fetch gate — a failed / empty / unparseable fetch never reaches
 *      here (the caller bails before calling `reviewCalendarFeed`). This module
 *      only ever runs off a clean parse with at least one event.
 *   2. In-window only — a vanished UID counts only if its start is still in the
 *      future *and* at or after the earliest event still present in the feed.
 *   3. Explicit cancelled status is unconditional — an event still in the feed
 *      carrying a cancelled status is flagged regardless of rail 2.
 *   4. Sanity cap — a sync that would flag more than `CANCELLATION_ABSOLUTE_CAP`
 *      or more than half an Org's feed-tracked Bookings surfaces a
 *      `feedLooksWrong` warning instead of the cancellation candidates.
 *
 * Pure, and free of Next.js / Supabase imports — same discipline as
 * `import-candidate-shaping.ts`, whose shared helpers it reuses
 * (`splitOverlongCourtLabel` / `stripCourtLabelPrefix` / `isPastConfirmation`).
 * The "already on file" match is the same four-field comparison
 * `isDuplicateBooking` makes, kept inline here because this composition needs
 * the matched Booking's `id` for the auto-link, not just a yes/no.
 * `syncFacilityFeed` (`actions/calendar-feed.ts`) does the decrypt / HTTPS
 * fetch / `parseIcsFeed` / Supabase reads and writes around it.
 *
 * A Calendar Feed is per-Org, so nothing here matches a facility name — the
 * owning Org is a parameter. Player matching is skipped too: a real
 * CourtReserve member feed carries no player data (`courtreserve-feed.ts`).
 */

import type { BookingFormat } from "./capacity.ts";
import type { CourtReserveFeedEvent } from "./courtreserve-feed.ts";
import { clockInZone, todayInZone } from "./datetime.ts";
import {
  isPastConfirmation,
  splitOverlongCourtLabel,
  stripCourtLabelPrefix,
  type BookingIdentity,
} from "./import-candidate-shaping.ts";

/** The Org a feed belongs to, narrowed to what the review needs. */
export type OrgForFeedReview = {
  id: string;
  timeZone: string;
};

/** One existing Booking, its wall-clock identity plus the id an auto-link writes. */
export type ExistingBookingForFeedReview = BookingIdentity & { id: string };

/**
 * A future-dated feed event that isn't already a Booking and hasn't been
 * dismissed — a confirmation-shaped Import Candidate the "Sync facilities"
 * review screen renders (developer story 12). The `feedEventUid` is the
 * VEVENT UID `confirmFeedCandidate` writes the `org_feed_events` row against;
 * the shape otherwise mirrors an email import's `ReviewItem` so the review UI
 * components are shared.
 */
export type CalendarFeedReviewItem = {
  kind: "import";
  /** The owning Org — known without matching, since a feed is per-Org. */
  orgId: string;
  /** The VEVENT UID, verbatim — the seen-event row's stable key. */
  feedEventUid: string;
  /** `SEQUENCE`, recorded on the seen-event row so a later slice can notice a bump. */
  sequence: number;
  /** `LOCATION` verbatim — informational, shown on the card the same as an email import's facility name. */
  facilityName: string;
  /** Start instant, ISO 8601 — the seen-event row's `starts_at` when this candidate is confirmed or dismissed. */
  startsAt: string;
  /** `YYYY-MM-DD` in the Org's own zone. */
  date: string;
  /** `HH:MM`, 24-hour, in the Org's own zone. */
  startTime: string;
  endTime: string;
  /** Already stripped of its leading "Court" word; null when the raw label ran over the length limit (the full text is in `notes`). */
  courtLabel: string | null;
  /** Set only when the court text overflowed `courtLabel`. */
  notes: string | null;
  format: BookingFormat;
  /** `SUMMARY` verbatim — display parity with an email import's Details name. */
  name: string;
};

/**
 * A previously-seen, Booking-linked feed event that has vanished from the feed
 * or now carries a cancelled status — a cancellation candidate the review
 * screen renders. Confirming it removes the linked Booking (`confirmFeedCancellation`).
 * Matched by the `booking_id` on the seen-event row, so it works for a Booking
 * imported from email or entered by hand, not only feed-imported ones.
 */
export type CalendarFeedCancellationItem = {
  kind: "cancellation";
  /** The owning Org. */
  orgId: string;
  /** The VEVENT UID of the vanished / cancelled event — the seen-event row's key. */
  feedEventUid: string;
  /** The Booking this event was linked to; confirming removes it. */
  bookingId: string;
  /** Start instant, ISO 8601 — from the seen-event row. */
  startsAt: string;
  /** `YYYY-MM-DD` in the Org's own zone. */
  date: string;
  /** `HH:MM`, 24-hour, in the Org's own zone. */
  startTime: string;
  /** Why it was flagged — `"vanished"` (gone from the feed) or `"cancelled"` (explicit status). */
  reason: "vanished" | "cancelled";
};

/**
 * A feed event that maps to an existing Booking (same Org, court, date/time)
 * — filtered out of the review list and its `org_feed_events` row written
 * `status = 'imported'` with `booking_id` set, regardless of how that Booking
 * was created. The auto-link is what lets the (next-slice) cancellation diff
 * work for a hand-entered or email-imported Booking too.
 */
export type AutoLinkedFeedEvent = {
  feedEventUid: string;
  sequence: number;
  bookingId: string;
  /** Start instant, ISO 8601 — the seen-event row's `starts_at`. */
  startsAt: string;
};

/** A seen-event row already on file — what the review needs to skip a dismissed event and run the cancellation diff. */
export type SeenFeedEvent = {
  uid: string;
  status: "pending" | "imported" | "dismissed";
  /** Start instant, ISO 8601 — the cancellation diff's in-window check reads this. */
  startsAt: string;
  /** The Booking this row settled to, when `status === "imported"`. Null otherwise. */
  bookingId: string | null;
};

/** More than this many cancellation candidates in one sync trips the sanity cap (rail 4). */
export const CANCELLATION_ABSOLUTE_CAP = 3;

export type ReviewCalendarFeedInput = {
  /** The fresh fetch, already parsed and mapped (`parseCourtReserveFeed`). */
  events: readonly CourtReserveFeedEvent[];
  org: OrgForFeedReview;
  /** The caller's existing Bookings — the duplicate / auto-link check compares against these. */
  existingBookings: readonly ExistingBookingForFeedReview[];
  /** Every `org_feed_events` row already on file for this Org. */
  seenEvents: readonly SeenFeedEvent[];
  /**
   * UIDs the parser saw but couldn't turn into a usable event this sync
   * (`parseCourtReserveFeed`'s `unreadableUids`) — treated as *still present*
   * by the cancellation diff so a one-sync parse gap never reads as a vanish.
   */
  unreadableUids?: readonly string[];
  /** Passed in, never read from the clock — determinism, same as the rest of this app. */
  now: Date;
};

export type ReviewedCalendarFeed = {
  /** Future-dated events worth the User's review, earliest slot first. */
  items: CalendarFeedReviewItem[];
  /** Events that already match a Booking — the caller records these as imported + linked. */
  autoLinked: AutoLinkedFeedEvent[];
  /** Previously-seen, Booking-linked events that vanished or went cancelled — earliest slot first. Empty when `feedLooksWrong`. */
  cancellations: CalendarFeedCancellationItem[];
  /**
   * Rail 4 tripped — the diff would have flagged more than
   * `CANCELLATION_ABSOLUTE_CAP` or more than half this Org's feed-tracked
   * Bookings, so `cancellations` is suppressed and the caller shows a
   * "this feed looks wrong — check the URL" warning instead.
   */
  feedLooksWrong: boolean;
};

/** Earliest slot first — `date` / `startTime` both sort correctly as plain strings. */
function byDateAndStartTime(
  a: { date: string; startTime: string },
  b: { date: string; startTime: string },
): number {
  return a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date);
}

/**
 * One Org's fresh feed fetch -> the import candidates and the auto-links.
 *
 * Pure: every decision is made from the events and the plain data the caller
 * hands in. `syncFacilityFeed` does the fetch and the Supabase reads/writes.
 */
export function reviewCalendarFeed({
  events,
  org,
  existingBookings,
  seenEvents,
  unreadableUids = [],
  now,
}: ReviewCalendarFeedInput): ReviewedCalendarFeed {
  const dismissedUids = new Set(
    seenEvents.filter((seen) => seen.status === "dismissed").map((seen) => seen.uid),
  );

  // A UID this feed already recorded as `imported` and linked to a Booking.
  // Re-affirmed as an auto-link every sync *by UID*, before the court/date/time
  // match runs — so an event stays linked even when the Booking's court label
  // no longer equals the feed's own (a merged email+feed import keeps the
  // email's richer `"#5 - Hard"` where the feed only carries `"#5"` — issue
  // #348 — and a feed whose court wording drifts over time would otherwise
  // re-offer every reservation).
  const importedBookingIdByUid = new Map<string, string>();
  for (const seen of seenEvents) {
    if (seen.status === "imported" && seen.bookingId !== null) {
      importedBookingIdByUid.set(seen.uid, seen.bookingId);
    }
  }

  const items: CalendarFeedReviewItem[] = [];
  const autoLinked: AutoLinkedFeedEvent[] = [];

  for (const event of events) {
    // A cancelled event is the cancellation diff's job (next slice), never an
    // import candidate.
    if (event.cancelled) {
      continue;
    }

    const startInstant = new Date(event.startsAt);
    const date = todayInZone(org.timeZone, startInstant);
    const startTime = clockInZone(org.timeZone, startInstant);
    const endTime = clockInZone(org.timeZone, new Date(event.endsAt));

    // Same coarse calendar-day-only past check the email path uses — a first
    // sync must not dump a season of history into the review queue.
    if (isPastConfirmation({ date }, org.timeZone, now)) {
      continue;
    }

    const { courtLabel, notes } = splitOverlongCourtLabel(
      stripCourtLabelPrefix(event.courtLabel),
    );

    // A dismissed event is skipped before anything else — it must not resurface
    // as a candidate, and it must not be auto-linked either (which would
    // overwrite its `dismissed` seen-event row with `imported`).
    if (dismissedUids.has(event.uid)) {
      continue;
    }

    // Already an `imported`, Booking-linked seen row for this UID, and that
    // Booking still exists — re-affirm the link (bumping `sequence` /
    // `starts_at`) rather than re-matching on court/date/time. If the Booking
    // was deleted, fall through: normal matching re-offers it, which is right.
    const linkedBookingId = importedBookingIdByUid.get(event.uid);
    if (linkedBookingId && existingBookings.some((booking) => booking.id === linkedBookingId)) {
      autoLinked.push({
        feedEventUid: event.uid,
        sequence: event.sequence,
        bookingId: linkedBookingId,
        startsAt: startInstant.toISOString(),
      });
      continue;
    }

    const identity: BookingIdentity = {
      orgId: org.id,
      courtLabel,
      date,
      startTime,
    };

    const matchedBooking = existingBookings.find(
      (booking) =>
        booking.orgId === identity.orgId &&
        booking.courtLabel === identity.courtLabel &&
        booking.date === identity.date &&
        booking.startTime === identity.startTime,
    );

    if (matchedBooking) {
      autoLinked.push({
        feedEventUid: event.uid,
        sequence: event.sequence,
        bookingId: matchedBooking.id,
        startsAt: startInstant.toISOString(),
      });
      continue;
    }

    items.push({
      kind: "import",
      orgId: org.id,
      feedEventUid: event.uid,
      sequence: event.sequence,
      facilityName: event.facilityName,
      startsAt: startInstant.toISOString(),
      date,
      startTime,
      endTime,
      courtLabel,
      notes,
      format: event.format,
      name: event.name,
    });
  }

  items.sort(byDateAndStartTime);

  /* ---------------------------------------------------------------------- */
  /* The feed-diff cancellation mechanism + its four safety rails.          */
  /* ---------------------------------------------------------------------- */

  // Rail 1 is the caller's: a failed / empty / unparseable fetch never gets
  // here. By this point `events` is a clean parse with at least one event.

  // Every UID the current feed still carries — readable events plus the ones
  // the parser couldn't decode this sync (a parse gap must never read as a
  // vanish).
  const presentUids = new Set<string>([
    ...events.map((event) => event.uid),
    ...unreadableUids,
  ]);

  // An event still in the feed, keyed by UID, so rail 3 can spot an explicit
  // cancelled status.
  const currentByUid = new Map(events.map((event) => [event.uid, event]));

  const nowMs = now.getTime();

  // Rail 2's floor: the earliest *future* start still present in the feed. A
  // vanished UID older than this is "the feed's window simply moved past it",
  // not a cancellation. Only future present events count toward the floor — a
  // stale past event lingering in the feed must not drag the floor into the
  // past and disable the rail.
  const earliestPresentStartMs = events.reduce((min, event) => {
    const startMs = new Date(event.startsAt).getTime();
    return startMs > nowMs ? Math.min(min, startMs) : min;
  }, Number.POSITIVE_INFINITY);

  // Only an `imported`, Booking-linked seen row can be a cancellation
  // candidate — that link is the whole matching mechanism, and it exists
  // however the Booking was made.
  const linkedSeen = seenEvents.filter(
    (seen): seen is SeenFeedEvent & { bookingId: string } =>
      seen.status === "imported" && seen.bookingId !== null,
  );

  const cancellations: CalendarFeedCancellationItem[] = [];

  for (const seen of linkedSeen) {
    const seenStartMs = new Date(seen.startsAt).getTime();
    const startInstant = new Date(seen.startsAt);
    const shaped = {
      kind: "cancellation" as const,
      orgId: org.id,
      feedEventUid: seen.uid,
      bookingId: seen.bookingId,
      startsAt: startInstant.toISOString(),
      date: todayInZone(org.timeZone, startInstant),
      startTime: clockInZone(org.timeZone, startInstant),
    };

    const stillPresent = currentByUid.get(seen.uid);
    if (stillPresent) {
      // Rail 3: an explicit cancelled status is unconditional — flag it
      // regardless of rail 2's window.
      if (stillPresent.cancelled) {
        cancellations.push({ ...shaped, reason: "cancelled" });
      }
      continue;
    }

    // Vanished from the feed. Rail 2: only counts if its start is still in the
    // future *and* at or after the earliest event the feed still shows.
    if (
      !presentUids.has(seen.uid) &&
      seenStartMs > nowMs &&
      seenStartMs >= earliestPresentStartMs
    ) {
      cancellations.push({ ...shaped, reason: "vanished" });
    }
  }

  cancellations.sort(byDateAndStartTime);

  // Rail 4: a narrowed or swapped feed must not quietly gut a User's records.
  // Two independent triggers (ADR-0019's "more than ~3, or more than ~50%"):
  //  - more than `CANCELLATION_ABSOLUTE_CAP` candidates in one sync; or
  //  - more than half an Org's feed-tracked Bookings at once — but only when
  //    that's at least two candidates, so an ordinary lone cancellation
  //    (which is 100% of a one-Booking feed) still comes through.
  const feedTrackedBookingCount = linkedSeen.length;
  const feedLooksWrong =
    cancellations.length > CANCELLATION_ABSOLUTE_CAP ||
    (cancellations.length >= 2 &&
      cancellations.length * 2 > feedTrackedBookingCount);

  return {
    items,
    autoLinked,
    cancellations: feedLooksWrong ? [] : cancellations,
    feedLooksWrong,
  };
}

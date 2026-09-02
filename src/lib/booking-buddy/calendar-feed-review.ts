/**
 * The composed "parsed CourtReserve feed events -> Import Candidate review
 * list" algorithm for one Org's Calendar Feed (issue #294, spec #288,
 * ADR-0019) — the feed counterpart of `reviewCourtReserveEmails`
 * (`email-sync-review.ts`).
 *
 * `import` kind only in this slice. The feed-diff cancellation mechanism (a
 * previously-seen event that has vanished or gone cancelled) and its four
 * safety rails are the next ticket; this one takes the fresh fetch and turns
 * every future-dated event that isn't already a Booking and isn't dismissed
 * into an import candidate, and records the ones that already match a Booking
 * as `imported` + linked.
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

/** A seen-event row already on file, the minimum the review needs to skip a dismissed event. */
export type SeenFeedEvent = {
  uid: string;
  status: "pending" | "imported" | "dismissed";
};

export type ReviewCalendarFeedInput = {
  /** The fresh fetch, already parsed and mapped (`parseCourtReserveFeed`). */
  events: readonly CourtReserveFeedEvent[];
  org: OrgForFeedReview;
  /** The caller's existing Bookings — the duplicate / auto-link check compares against these. */
  existingBookings: readonly ExistingBookingForFeedReview[];
  /** Every `org_feed_events` row already on file for this Org. */
  seenEvents: readonly SeenFeedEvent[];
  /** Passed in, never read from the clock — determinism, same as the rest of this app. */
  now: Date;
};

export type ReviewedCalendarFeed = {
  /** Future-dated events worth the User's review, earliest slot first. */
  items: CalendarFeedReviewItem[];
  /** Events that already match a Booking — the caller records these as imported + linked. */
  autoLinked: AutoLinkedFeedEvent[];
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
  now,
}: ReviewCalendarFeedInput): ReviewedCalendarFeed {
  const dismissedUids = new Set(
    seenEvents.filter((seen) => seen.status === "dismissed").map((seen) => seen.uid),
  );

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

  return { items, autoLinked };
}

/**
 * Turns a parsed CourtReserve member calendar feed (`parseIcsFeed`, the
 * generic RFC 5545 reader) into reservation-shaped records the Calendar Feed
 * review composition can shape into Import Candidates — the feed counterpart
 * of `courtreserve-email.ts` (spec #288, developer story 35).
 *
 * The `SUMMARY` / `LOCATION` / `DESCRIPTION` mapping below was decided
 * against a real captured member feed (Vaughan Pickleball, one account,
 * eight reservations — names/ids scrubbed for commit, per the repo's
 * public-repo discipline; see `courtreserve-feed.test.ts`'s real-feed
 * fixture). ADR-0009 records the email parser first being built against a
 * wrong guess, so this was held until a real feed was in hand. What that
 * feed showed:
 *
 *   - `SUMMARY` is exactly the format word — `"Doubles"` or `"Singles"` —
 *     nothing else. It drives `format`, and is kept verbatim as `name` for
 *     display parity with an email import's own Details name (issue #95).
 *   - `DESCRIPTION` is the court, prefixed the same way CourtReserve's email
 *     template prefixes it: `"Court #10"`. Kept verbatim here; the leading
 *     "Court" word is stripped, and an overlong label folded into notes, by
 *     the shared shaping helpers the review composition runs (`stripCourtLabelPrefix`
 *     / `splitOverlongCourtLabel`), exactly as the email path does.
 *   - `LOCATION` is the club — `"Vaughan Pickleball"`. A Calendar Feed is
 *     already per-Org (the owning Org is known without matching a name), so
 *     this is informational only, carried through for display and sanity
 *     checks.
 *   - There is no player data anywhere in the feed. `playerNames` is always
 *     empty — a feed-imported Booking simply has no Players (developer story
 *     12), fixable later from Edit Booking.
 *   - `STATUS` was absent on every event (all confirmed). An explicit
 *     `STATUS:CANCELLED`, when it appears, is surfaced as `cancelled` — the
 *     feed telling us directly is an unconditional cancellation signal
 *     (spec #288, cancellation rail 3).
 *
 * Free of Next.js and Supabase imports, and of any import from the
 * email-sync modules, on purpose — same discipline as `import-candidate-shaping.ts`.
 */

import { DEFAULT_BOOKING_FORMAT } from "./bookings.ts";
import { isBookingFormat, type BookingFormat } from "./capacity.ts";
import {
  parseIcsFeed,
  type IcsFeedEvent,
  type ParseIcsFeedOptions,
} from "./ics-feed.ts";

export type CourtReserveFeedEvent = {
  /** The feed event's `UID`, verbatim — the caller's stable identity for this reservation across syncs. */
  uid: string;
  /** `SEQUENCE`, `0` when absent — a later edit to the same reservation bumps it. */
  sequence: number;
  /** Absolute start instant, ISO 8601 with `Z`. The review composition projects it into the Org's zone. */
  startsAt: string;
  /** Absolute end instant, ISO 8601 with `Z` — always strictly after `startsAt`. */
  endsAt: string;
  /** From `SUMMARY` — `"Doubles"` / `"Singles"` narrowed to the Booking format enum, defaulting to doubles for anything unexpected. */
  format: BookingFormat;
  /** `SUMMARY` verbatim — the display name line, mirroring an email import's `name`. */
  name: string;
  /** `DESCRIPTION` verbatim (`"Court #10"`); `null` when blank. Prefix-strip / overflow-split is the review composition's job, not this module's. */
  courtLabel: string | null;
  /** `LOCATION` verbatim (`"Vaughan Pickleball"`). Informational — a Calendar Feed is already per-Org. */
  facilityName: string;
  /** Always empty: a real CourtReserve member feed carries no player data. Kept for downstream shape parity. */
  playerNames: string[];
  /** `true` only when the feed event carries an explicit `STATUS:CANCELLED`. */
  cancelled: boolean;
};

export type ParsedCourtReserveFeed = {
  events: CourtReserveFeedEvent[];
  /**
   * UIDs the generic parser could read an identity from but not a usable
   * event — passed straight through so the caller keeps them in its seen-set
   * and a parse gap is never diffed as a cancellation.
   */
  unreadableUids: string[];
};

function toFormat(summary: string): BookingFormat {
  const normalized = summary.trim().toLowerCase();
  return isBookingFormat(normalized) ? normalized : DEFAULT_BOOKING_FORMAT;
}

/** One generic `IcsFeedEvent` -> its CourtReserve reservation shape. */
export function mapCourtReserveFeedEvent(event: IcsFeedEvent): CourtReserveFeedEvent {
  return {
    uid: event.uid,
    sequence: event.sequence,
    startsAt: event.start,
    endsAt: event.end,
    format: toFormat(event.summary),
    name: event.summary,
    courtLabel: event.description.trim() || null,
    facilityName: event.location.trim(),
    playerNames: [],
    cancelled: event.status === "cancelled",
  };
}

/**
 * Parse a raw CourtReserve `.ics` body straight into reservation-shaped
 * records. Pure and total — `parseIcsFeed` never throws, and this only maps
 * its output.
 */
export function parseCourtReserveFeed(
  text: string,
  options: ParseIcsFeedOptions,
): ParsedCourtReserveFeed {
  const { events, unreadableUids } = parseIcsFeed(text, options);
  return { events: events.map(mapCourtReserveFeedEvent), unreadableUids };
}

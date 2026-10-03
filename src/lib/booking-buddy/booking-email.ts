/**
 * Every sender "Sync from Email" reads booking emails from, and which parser
 * reads each one. CourtReserve covers most facilities; a facility running its
 * own booking system (Backyard Club) gets its own entry here. Each sender is
 * a separate mailbox search, so the provider-neutral `{ sender, after }`
 * criteria never needs an OR — and the search a message came back from is
 * what says how to parse it.
 */

import {
  BACKYARD_CLUB_SENDER,
  parseBackyardClubEmail,
} from "./backyard-club-email.ts";
import {
  COURTRESERVE_SENDER,
  buildCourtReserveSearchCriteria,
  parseCourtReserveEmail,
  type CourtReserveEmailParseResult,
} from "./courtreserve-email.ts";

export type BookingEmailSource = "courtreserve" | "backyard_club";

export const BOOKING_EMAIL_SOURCES: readonly BookingEmailSource[] = ["courtreserve", "backyard_club"];

const SENDER_BY_SOURCE: Record<BookingEmailSource, string> = {
  courtreserve: COURTRESERVE_SENDER,
  backyard_club: BACKYARD_CLUB_SENDER,
};

/** One source's search: its own sender, over CourtReserve's own lookback window. */
export function buildBookingEmailSearchCriteria(
  source: BookingEmailSource,
  now: Date,
): { sender: string; after: Date } {
  return { ...buildCourtReserveSearchCriteria(now), sender: SENDER_BY_SOURCE[source] };
}

export function parseBookingEmail(email: {
  source: BookingEmailSource;
  subject: string;
  html: string;
}): CourtReserveEmailParseResult {
  return email.source === "backyard_club" ? parseBackyardClubEmail(email) : parseCourtReserveEmail(email);
}

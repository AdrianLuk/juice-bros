/**
 * The one hidden field a review card posts to say which Import Candidate it is
 * settling (issue #606): which sources it came from, and the slot a dismissal
 * records.
 *
 * Before this, every card hand-wrote that identity as its own hidden inputs
 * and every action read them back its own way, with its own fallbacks (an
 * unreadable `starts_at` became the epoch, an unreadable `sequence` became 0).
 * Now the card encodes the candidate once and the Server Action decodes it
 * once, and a post that doesn't decode is refused rather than patched up.
 *
 * Source identities only, plus the Booking a cancellation was matched to. The
 * Booking fields the User sees on the card (the Facility select, name, date,
 * times, court, notes, Players, and which Booking an update applies to) stay
 * ordinary named inputs that `parseNewBooking` or `parseUpdateApplication`
 * re-validates, exactly as before.
 *
 * Unsigned on purpose: every write it leads to is RLS-scoped to the caller's
 * own rows, so a tampered token can only settle the caller's own candidates,
 * which is no more than the old hidden inputs allowed.
 *
 * Pure and client-safe: the merged card is built in the browser (ADR 0020),
 * so the cards import `encodeCandidate` from here directly.
 */

import type { BookingIdentity } from "./import-candidate-shaping.ts";

/** The form field the token travels in. */
export const CANDIDATE_FIELD = "candidate";

/** One VEVENT's `org_feed_events` key: enough to find a row already on file. */
export type FeedEventKey = {
  /** The Org whose feed listed the event, not whatever a card's Facility select shows. */
  orgId: string;
  /** The VEVENT UID, verbatim. */
  uid: string;
};

/**
 * One VEVENT a sync already recorded: its key, and the start a fresh row is
 * stamped with should that row be gone by the time the User answers.
 */
export type KnownFeedEvent = FeedEventKey & {
  /** Start instant, ISO 8601. */
  startsAt: string;
};

/** One VEVENT as its `org_feed_events` row is keyed and stamped. */
export type FeedEventIdentity = KnownFeedEvent & {
  /** `SEQUENCE`, a whole number. */
  sequence: number;
};

/**
 * A new-reservation Import Candidate from the mailbox, a Calendar Feed, or
 * both at once (a merged card). At least one source is set.
 */
export type ImportCandidate = {
  kind: "import";
  /** The email's provider message id, the `processed_messages` key. Null for a feed-only candidate. */
  messageId: string | null;
  /** The feed event, the `org_feed_events` key. Null for an email-only candidate. */
  feed: FeedEventIdentity | null;
  /**
   * The slot a dismissal records in `dismissed_reservations` (issue #437).
   * Null for an email whose facility matched no Org: there is no Org to key
   * it on.
   */
  slot: BookingIdentity | null;
};

/**
 * A cancellation from the mailbox (a cancellation email) or a Calendar Feed
 * (an event that vanished or now says cancelled). Exactly the source it came
 * from is set; the two are never merged into one card.
 */
export type CancellationCandidate = {
  kind: "cancellation";
  /** The cancellation email's provider message id. Null for a feed cancellation. */
  messageId: string | null;
  /**
   * The feed event's row, already on file: a feed cancellation is a row the
   * last sync left `imported`, so it is found by key and its `sequence` is
   * never rewritten. The start is only for a row that has gone since.
   * Null for an email cancellation.
   */
  feed: KnownFeedEvent | null;
  /**
   * The Booking the review matched it to, which confirming removes. Null for
   * an email cancellation that matched none, which can only be dismissed.
   */
  bookingId: string | null;
};

/**
 * A Reservation Update Notice from the mailbox. Which Booking it applies to is
 * not part of the token: on a suggested match the User picks it, so it travels
 * as the card's `booking_id` field with the rest of what
 * `parseUpdateApplication` re-validates.
 */
export type UpdateCandidate = {
  kind: "update";
  messageId: string;
};

/** Every candidate kind a card can post. */
export type Candidate = ImportCandidate | CancellationCandidate | UpdateCandidate;

/**
 * An import's `slot`: the reservation's date, start and court under `orgId`,
 * which is always the Org the review matched, never a card's Facility select.
 */
export function candidateSlot(
  orgId: string,
  reservation: { date: string; startTime: string; courtLabel: string | null },
): BookingIdentity {
  return {
    orgId,
    date: reservation.date,
    startTime: reservation.startTime,
    courtLabel: reservation.courtLabel,
  };
}

export function encodeCandidate(candidate: Candidate): string {
  return JSON.stringify(candidate);
}

/** `YYYY-MM-DD`. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** `HH:MM`, 24-hour. */
const TIME_PATTERN = /^\d{2}:\d{2}$/;

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonBlankString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** A nullable id: `null` when the token says null, `undefined` when it holds anything but a non-blank string. */
function readNullableId(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  return nonBlankString(value) ?? undefined;
}

function readFeedKey(value: unknown): FeedEventKey | null | undefined {
  if (value === null) {
    return null;
  }
  if (!isObject(value)) {
    return undefined;
  }

  const orgId = nonBlankString(value.orgId);
  const uid = nonBlankString(value.uid);
  return orgId && uid ? { orgId, uid } : undefined;
}

function readKnownFeed(value: unknown): KnownFeedEvent | null | undefined {
  const key = readFeedKey(value);
  if (!key || !isObject(value)) {
    return key === null ? null : undefined;
  }

  const startsAt = typeof value.startsAt === "string" ? Date.parse(value.startsAt) : NaN;
  return Number.isNaN(startsAt) ? undefined : { ...key, startsAt: new Date(startsAt).toISOString() };
}

function readFeed(value: unknown): FeedEventIdentity | null | undefined {
  const known = readKnownFeed(value);
  if (!known || !isObject(value)) {
    return known === null ? null : undefined;
  }

  const { sequence } = value;
  if (typeof sequence !== "number" || !Number.isInteger(sequence) || sequence < 0) {
    return undefined;
  }

  return { ...known, sequence };
}

function readSlot(value: unknown): BookingIdentity | null | undefined {
  if (value === null) {
    return null;
  }
  if (!isObject(value)) {
    return undefined;
  }

  const orgId = nonBlankString(value.orgId);
  const { date, startTime, courtLabel } = value;

  if (
    !orgId ||
    typeof date !== "string" ||
    !DATE_PATTERN.test(date) ||
    typeof startTime !== "string" ||
    !TIME_PATTERN.test(startTime) ||
    (courtLabel !== null && typeof courtLabel !== "string")
  ) {
    return undefined;
  }

  return {
    orgId,
    date,
    startTime,
    courtLabel: typeof courtLabel === "string" ? courtLabel.trim() || null : null,
  };
}

/**
 * The candidate a form posted, or `null` when the field is missing or anything
 * in it is malformed. Nothing is defaulted: a candidate that can't say exactly
 * which rows it settles settles none.
 */
export function decodeCandidate(formData: FormData): Candidate | null {
  const raw = formData.get(CANDIDATE_FIELD);
  if (typeof raw !== "string") {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isObject(parsed)) {
    return null;
  }

  const messageId = readNullableId(parsed.messageId);
  if (messageId === undefined) {
    return null;
  }

  switch (parsed.kind) {
    case "import": {
      const feed = readFeed(parsed.feed);
      const slot = readSlot(parsed.slot);
      if (feed === undefined || slot === undefined || (messageId === null && feed === null)) {
        return null;
      }
      return { kind: "import", messageId, feed, slot };
    }
    case "cancellation": {
      const feed = readKnownFeed(parsed.feed);
      const bookingId = readNullableId(parsed.bookingId);
      if (feed === undefined || bookingId === undefined || (messageId === null && feed === null)) {
        return null;
      }
      return { kind: "cancellation", messageId, feed, bookingId };
    }
    case "update":
      return messageId === null ? null : { kind: "update", messageId };
    default:
      return null;
  }
}

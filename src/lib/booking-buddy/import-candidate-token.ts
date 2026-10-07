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
 * Source identities only. The Booking fields the User sees on the card (the
 * Facility select, name, date, times, court, notes, Players) stay ordinary
 * named inputs that `parseNewBooking` re-validates, exactly as before.
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

/** One VEVENT as its `org_feed_events` row is keyed and stamped. */
export type FeedEventIdentity = {
  /** The Org whose feed listed the event, not whatever a card's Facility select shows. */
  orgId: string;
  /** The VEVENT UID, verbatim. */
  uid: string;
  /** `SEQUENCE`, a whole number. */
  sequence: number;
  /** Start instant, ISO 8601. */
  startsAt: string;
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

/** Every candidate kind a card can post. Cancellations and updates join in #609. */
export type Candidate = ImportCandidate;

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

function readFeed(value: unknown): FeedEventIdentity | null | undefined {
  if (value === null) {
    return null;
  }
  if (!isObject(value)) {
    return undefined;
  }

  const orgId = nonBlankString(value.orgId);
  const uid = nonBlankString(value.uid);
  const { sequence } = value;
  const startsAt = typeof value.startsAt === "string" ? Date.parse(value.startsAt) : NaN;

  if (
    !orgId ||
    !uid ||
    typeof sequence !== "number" ||
    !Number.isInteger(sequence) ||
    sequence < 0 ||
    Number.isNaN(startsAt)
  ) {
    return undefined;
  }

  return { orgId, uid, sequence, startsAt: new Date(startsAt).toISOString() };
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

  if (!isObject(parsed) || parsed.kind !== "import") {
    return null;
  }

  const messageId = parsed.messageId === null ? null : nonBlankString(parsed.messageId);
  const feed = readFeed(parsed.feed);
  const slot = readSlot(parsed.slot);

  if (
    (messageId === null && parsed.messageId !== null) ||
    feed === undefined ||
    slot === undefined ||
    (messageId === null && feed === null)
  ) {
    return null;
  }

  return { kind: "import", messageId, feed, slot };
}

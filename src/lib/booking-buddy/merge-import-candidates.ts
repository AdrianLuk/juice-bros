/**
 * Consolidates the two independent Booking-import sources' review lists into
 * one card per real reservation (issue #348).
 *
 * A User with both a Mailbox Link and a Calendar Feed configured for the same
 * facility gets the same reservation twice on the "Sync bookings" screen: an
 * `import` `ReviewItem` from `email-sync-review.ts` (carries the Player(s) and
 * the Details name) and a `CalendarFeedReviewItem` from
 * `calendar-feed-review.ts` (no players — a real member feed has none — and a
 * thinner court label, `"Court #5"` where the email's Court(s) is
 * `"Court #5 - Hard"`). The confirm-time duplicate guard already stops a
 * second Booking being written, so this is a review-screen defect only: the
 * two cards should be one, keeping the richer field from each side.
 *
 * Pure, and free of Next.js / Supabase imports — same discipline as
 * `import-candidate-shaping.ts`. Runs client-side in `sync-bookings.tsx`, the
 * one place both source lists are in hand at once. Confirming the merged card
 * settles *both* sources (`confirmMergedCandidate`, `actions/email-sync.ts`).
 *
 * The match is Org + date + start time, deliberately **not** court — the two
 * sources genuinely disagree on court text, which is the whole reason a
 * cross-source dedupe can't lean on `isDuplicateBooking`'s four-field key.
 * Same "Org + date + start, not court" identity `matchCancellationToBooking`
 * already uses, and the same "refuse to guess" posture: an email item whose
 * facility didn't match an Org isn't merged (no Org to key on), and neither
 * side is merged when more than one candidate shares a slot key (two courts
 * booked for one group at the same time are indistinguishable without court).
 */

import type { BookingFormat } from "./capacity.ts";
import type { CalendarFeedReviewItem } from "./calendar-feed-review.ts";
import type { PlayerMatch } from "./email-sync-matching.ts";
import type { ReviewItem } from "./email-sync-review.ts";

type ImportReviewItem = Extract<ReviewItem, { kind: "import" }>;

/**
 * One email `import` candidate and one feed candidate resolved to the same
 * real reservation — the fields taken from whichever side carries the better
 * value, plus both source keys so a single confirm can write the Booking, the
 * `processed_messages` row (email side) and the `org_feed_events` row (feed
 * side) together.
 */
export type MergedImportCandidate = {
  kind: "merged";
  /** `${gmailMessageId}::${feedEventUid}` — the review card's React key. */
  mergeKey: string;
  /** Email side — the `processed_messages` key. */
  gmailMessageId: string;
  /** Feed side — the `org_feed_events` key. */
  feedEventUid: string;
  /** Feed `SEQUENCE`, for the `org_feed_events` row. */
  sequence: number;
  /** Feed event start instant, ISO 8601 — the `org_feed_events` row's `starts_at`. */
  startsAt: string;
  /** The owning Org — `email.matchedOrgId`, which equals `feed.orgId` (the merge key). */
  orgId: string;
  /** The email's own facility name — the feed's `LOCATION` says the same club. */
  facilityName: string;
  /** The email's Details name — the feed's `SUMMARY` is only `"Doubles"` / `"Singles"`. */
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  /** The email's court label when it has one (richer text — `"#5 - Hard"`), else the feed's (`"#5"`). */
  courtLabel: string | null;
  /** The email's overflow notes when present, else the feed's. */
  notes: string | null;
  format: BookingFormat;
  /** From the email side only — a real member feed carries no player data. */
  matchedPlayers: PlayerMatch[];
};

export type MergeImportCandidatesResult = {
  merged: MergedImportCandidate[];
  /** Every email item that wasn't merged — all `kind`s, original order preserved. */
  emailItems: ReviewItem[];
  /** Every feed candidate that wasn't merged — original order preserved. */
  feedCandidates: CalendarFeedReviewItem[];
};

/** Org + date + start time — the cross-source identity of one reservation. */
function slotKey(item: { orgId: string; date: string; startTime: string }): string {
  return `${item.orgId}|${item.date}|${item.startTime}`;
}

/**
 * Pair every email `import` candidate that shares an Org + date + start time
 * with exactly one feed candidate (and vice versa) into a single
 * `MergedImportCandidate`, and return the three lists the review screen
 * renders: the merged cards, the leftover email items (all kinds), and the
 * leftover feed candidates.
 */
export function mergeImportCandidates(
  emailItems: readonly ReviewItem[],
  feedCandidates: readonly CalendarFeedReviewItem[],
): MergeImportCandidatesResult {
  // Group each side by slot key. An email item only competes for a merge when
  // it's an `import` with a matched Org — a `cancellation`/`update`, or an
  // import whose facility didn't resolve to an Org, has no key to pair on.
  const emailImportsByKey = new Map<string, ImportReviewItem[]>();
  for (const item of emailItems) {
    if (item.kind !== "import" || item.matchedOrgId === null) {
      continue;
    }
    const key = slotKey({ orgId: item.matchedOrgId, date: item.date, startTime: item.startTime });
    const group = emailImportsByKey.get(key);
    if (group) {
      group.push(item);
    } else {
      emailImportsByKey.set(key, [item]);
    }
  }

  const feedByKey = new Map<string, CalendarFeedReviewItem[]>();
  for (const item of feedCandidates) {
    const key = slotKey(item);
    const group = feedByKey.get(key);
    if (group) {
      group.push(item);
    } else {
      feedByKey.set(key, [item]);
    }
  }

  const merged: MergedImportCandidate[] = [];
  const mergedEmailIds = new Set<string>();
  const mergedFeedUids = new Set<string>();

  for (const [key, emailGroup] of emailImportsByKey) {
    const feedGroup = feedByKey.get(key);
    // Exactly one on each side — otherwise which email pairs with which feed
    // is a guess, and the two stay as separate cards (same posture as
    // `matchCancellationToBooking` refusing an ambiguous match).
    if (!feedGroup || emailGroup.length !== 1 || feedGroup.length !== 1) {
      continue;
    }

    const email = emailGroup[0];
    const feed = feedGroup[0];

    merged.push({
      kind: "merged",
      mergeKey: `${email.gmailMessageId}::${feed.feedEventUid}`,
      gmailMessageId: email.gmailMessageId,
      feedEventUid: feed.feedEventUid,
      sequence: feed.sequence,
      startsAt: feed.startsAt,
      orgId: feed.orgId,
      facilityName: email.facilityName,
      name: email.name,
      date: email.date,
      startTime: email.startTime,
      endTime: email.endTime,
      courtLabel: email.courtLabel ?? feed.courtLabel,
      notes: email.notes ?? feed.notes,
      format: email.format,
      matchedPlayers: email.matchedPlayers,
    });
    mergedEmailIds.add(email.gmailMessageId);
    mergedFeedUids.add(feed.feedEventUid);
  }

  return {
    merged,
    emailItems: emailItems.filter((item) => !mergedEmailIds.has(item.gmailMessageId)),
    feedCandidates: feedCandidates.filter((item) => !mergedFeedUids.has(item.feedEventUid)),
  };
}

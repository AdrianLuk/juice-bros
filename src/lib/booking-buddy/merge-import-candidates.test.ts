import assert from "node:assert/strict";
import test from "node:test";

import type { CalendarFeedReviewItem } from "./calendar-feed-review.ts";
import type { ReviewItem } from "./email-sync-review.ts";
import { mergeImportCandidates } from "./merge-import-candidates.ts";

/** An email `import` `ReviewItem` (defaults line up with `feedItem()`). */
function emailItem(overrides: Partial<Extract<ReviewItem, { kind: "import" }>> = {}): ReviewItem {
  return {
    kind: "import",
    gmailMessageId: "gmail-1",
    facilityName: "Vaughan Pickleball",
    matchedOrgId: "org-1",
    date: "2026-09-03",
    startTime: "13:00",
    endTime: "15:00",
    courtLabel: "#5 - Hard",
    notes: null,
    format: "doubles",
    name: "Doubles",
    matchedPlayers: [
      { name: "Cecilia Mui", userId: null },
      { name: "Adrian Luk", userId: null },
    ],
    ...overrides,
  };
}

/** A feed `CalendarFeedReviewItem` for the same slot as `emailItem()`. */
function feedItem(overrides: Partial<CalendarFeedReviewItem> = {}): CalendarFeedReviewItem {
  return {
    kind: "import",
    orgId: "org-1",
    feedEventUid: "vevent-1",
    sequence: 0,
    facilityName: "Vaughan Pickleball",
    startsAt: "2026-09-03T17:00:00.000Z",
    date: "2026-09-03",
    startTime: "13:00",
    endTime: "15:00",
    courtLabel: "#5",
    notes: null,
    format: "doubles",
    name: "Doubles",
    ...overrides,
  };
}

test("an email import and a feed candidate for the same Org/date/start merge into one card", () => {
  const { merged, emailItems, feedCandidates } = mergeImportCandidates([emailItem()], [feedItem()]);

  assert.equal(emailItems.length, 0);
  assert.equal(feedCandidates.length, 0);
  assert.deepEqual(merged, [
    {
      kind: "merged",
      mergeKey: "gmail-1::vevent-1",
      gmailMessageId: "gmail-1",
      feedEventUid: "vevent-1",
      sequence: 0,
      startsAt: "2026-09-03T17:00:00.000Z",
      orgId: "org-1",
      facilityName: "Vaughan Pickleball",
      name: "Doubles",
      date: "2026-09-03",
      startTime: "13:00",
      endTime: "15:00",
      courtLabel: "#5 - Hard",
      notes: null,
      format: "doubles",
      matchedPlayers: [
        { name: "Cecilia Mui", userId: null },
        { name: "Adrian Luk", userId: null },
      ],
    },
  ]);
});

test("the merged card keeps the email's players and the richer court label", () => {
  const { merged } = mergeImportCandidates([emailItem()], [feedItem()]);
  assert.equal(merged[0].courtLabel, "#5 - Hard");
  assert.equal(merged[0].matchedPlayers.length, 2);
});

test("the feed's court label is used when the email has none (overflowed to notes)", () => {
  const { merged } = mergeImportCandidates(
    [emailItem({ courtLabel: null, notes: "1, 2, 3, 4, 5, 6, 7, 8" })],
    [feedItem()],
  );
  assert.equal(merged[0].courtLabel, "#5");
  assert.equal(merged[0].notes, "1, 2, 3, 4, 5, 6, 7, 8");
});

test("an email import whose facility didn't match an Org is never merged", () => {
  const { merged, emailItems, feedCandidates } = mergeImportCandidates(
    [emailItem({ matchedOrgId: null })],
    [feedItem()],
  );
  assert.equal(merged.length, 0);
  assert.equal(emailItems.length, 1);
  assert.equal(feedCandidates.length, 1);
});

test("a different start time is not the same reservation — no merge", () => {
  const { merged, emailItems, feedCandidates } = mergeImportCandidates(
    [emailItem({ startTime: "13:00" })],
    [feedItem({ startTime: "15:00" })],
  );
  assert.equal(merged.length, 0);
  assert.equal(emailItems.length, 1);
  assert.equal(feedCandidates.length, 1);
});

test("a different Org is not the same reservation — no merge", () => {
  const { merged } = mergeImportCandidates(
    [emailItem({ matchedOrgId: "org-1" })],
    [feedItem({ orgId: "org-2" })],
  );
  assert.equal(merged.length, 0);
});

test("two email imports at one slot key are ambiguous — neither side merges", () => {
  const { merged, emailItems, feedCandidates } = mergeImportCandidates(
    [emailItem({ gmailMessageId: "g-a" }), emailItem({ gmailMessageId: "g-b" })],
    [feedItem()],
  );
  assert.equal(merged.length, 0);
  assert.equal(emailItems.length, 2);
  assert.equal(feedCandidates.length, 1);
});

test("two feed candidates at one slot key are ambiguous — neither side merges", () => {
  const { merged, emailItems, feedCandidates } = mergeImportCandidates(
    [emailItem()],
    [feedItem({ feedEventUid: "v-a" }), feedItem({ feedEventUid: "v-b" })],
  );
  assert.equal(merged.length, 0);
  assert.equal(emailItems.length, 1);
  assert.equal(feedCandidates.length, 2);
});

test("non-import email kinds pass straight through, never merged", () => {
  const cancellation: ReviewItem = {
    kind: "cancellation",
    gmailMessageId: "gmail-c",
    facilityName: "Vaughan Pickleball",
    date: "2026-09-03",
    startTime: "13:00",
    courtLabel: null,
    matched: false,
  };
  const { merged, emailItems, feedCandidates } = mergeImportCandidates([cancellation], [feedItem()]);
  assert.equal(merged.length, 0);
  assert.deepEqual(emailItems, [cancellation]);
  assert.equal(feedCandidates.length, 1);
});

test("unrelated email and feed candidates are all returned untouched", () => {
  const email = emailItem({ gmailMessageId: "g-x", date: "2026-09-10" });
  const feed = feedItem({ feedEventUid: "v-x", date: "2026-09-11", startsAt: "2026-09-11T17:00:00.000Z" });
  const { merged, emailItems, feedCandidates } = mergeImportCandidates([email], [feed]);
  assert.equal(merged.length, 0);
  assert.deepEqual(emailItems, [email]);
  assert.deepEqual(feedCandidates, [feed]);
});

test("only the matched pair is consumed — other candidates on each side survive", () => {
  const matchEmail = emailItem({ gmailMessageId: "g-match" });
  const otherEmail = emailItem({ gmailMessageId: "g-other", date: "2026-09-20" });
  const matchFeed = feedItem({ feedEventUid: "v-match" });
  const otherFeed = feedItem({
    feedEventUid: "v-other",
    date: "2026-09-21",
    startsAt: "2026-09-21T17:00:00.000Z",
  });

  const { merged, emailItems, feedCandidates } = mergeImportCandidates(
    [matchEmail, otherEmail],
    [matchFeed, otherFeed],
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].gmailMessageId, "g-match");
  assert.deepEqual(emailItems, [otherEmail]);
  assert.deepEqual(feedCandidates, [otherFeed]);
});

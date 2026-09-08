"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  MergedCandidateCard,
  ReviewItemGroups,
} from "@/components/booking-buddy/sync-from-email";
import {
  FeedCandidateCard,
  FeedCancellationCard,
} from "@/components/booking-buddy/sync-facilities";
import { SuppressedReservations } from "@/components/booking-buddy/suppressed-reservations";
import {
  mergeImportCandidates,
  type MergedImportCandidate,
} from "@/lib/booking-buddy/merge-import-candidates";
import {
  isSameReservation,
  type BookingIdentity,
} from "@/lib/booking-buddy/import-candidate-shaping";
import { BOOKINGS_PATH, ORGS_PATH } from "@/lib/booking-buddy/routes";
import type { ReviewOutcome } from "@/components/booking-buddy/review-outcome";
import type { Org } from "@/lib/booking-buddy/actions/orgs";
import {
  MAILBOX_PROVIDER_IDENTITY_LABEL,
  MAILBOX_PROVIDER_LABEL,
  type MailboxProvider,
} from "@/lib/booking-buddy/mailbox-provider";
import {
  connectMailbox,
  syncFromEmail,
  type SyncFromEmailResult,
} from "@/lib/booking-buddy/actions/email-sync";
import {
  syncFacilityFeeds,
  type CalendarFeedCancellationItem,
  type CalendarFeedReviewItem,
  type SyncFacilityFeedsResult,
} from "@/lib/booking-buddy/actions/calendar-feed";

const EMAIL_QUERY_KEY = ["booking-buddy", "email-sync-candidates"] as const;
const FEED_QUERY_KEY = ["booking-buddy", "facility-feed-candidates"] as const;

/** Anchor on the Bookings page's own "Booked" heading, linked from the tally. */
const BOOKED_HREF = `${BOOKINGS_PATH}#booked`;

/** The tally's lines, in the order they read. */
const SETTLED_ORDER: ReviewOutcome[] = [
  "added",
  "updated",
  "removed",
  "kept",
  "skipped",
];

/** Each outcome's own line. Only "skipped" has no Booking to count, so it counts candidates. */
const SETTLED_LINE: Record<ReviewOutcome, (count: number) => string> = {
  added: (count) =>
    count === 1 ? "Added 1 booking." : `Added ${count} bookings.`,
  updated: (count) =>
    count === 1 ? "Updated 1 booking." : `Updated ${count} bookings.`,
  removed: (count) =>
    count === 1 ? "Removed 1 booking." : `Removed ${count} bookings.`,
  kept: (count) => (count === 1 ? "Kept 1 booking." : `Kept ${count} bookings.`),
  skipped: (count) => (count === 1 ? "Skipped 1." : `Skipped ${count}.`),
};

/**
 * What this sync has settled so far, said out loud (issue #464).
 *
 * A settled card is dropped from the query cache and unmounts, so until now
 * the only feedback a confirm gave was the card disappearing — and the Booked
 * list it landed in sits above this section, off-screen on a phone. A first
 * time User reading that as "it deleted my reservation" is exactly the
 * confusion this section already invites by looking finished the moment the
 * cards render.
 *
 * Counts, not a line per booking: the card carried the detail, and repeating
 * it here would rebuild the list the User just cleared.
 */
function SettledTally({ counts }: { counts: Record<ReviewOutcome, number> }) {
  const lines = SETTLED_ORDER.filter((outcome) => counts[outcome] > 0);

  if (lines.length === 0) {
    return null;
  }

  // `role="status"` so the outcome reaches a screen reader too — the card it
  // replaces has already gone by the time this renders.
  return (
    <div
      role="status"
      className="bb-outline flex flex-col gap-1 p-4 text-sm sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2"
    >
      {lines.map((outcome) => (
        <p key={outcome}>{SETTLED_LINE[outcome](counts[outcome])}</p>
      ))}
      {counts.added > 0 && (
        <Link href={BOOKED_HREF} className="underline underline-offset-4">
          See them under Booked
        </Link>
      )}
    </div>
  );
}

/**
 * "Sync bookings" (issue #336) — the one review section that replaces the
 * separate "Sync from Email" and "From facility feeds" sections now that both
 * import sources exist (ADR-0019 kept them apart only for the Calendar Feed
 * slice; #288 and #280 both landing is the trigger to unify).
 *
 * One button runs whichever sources the User has configured — a Mailbox Link
 * or Gmail allowlist entry (`canSyncFromEmail`) and/or at least one
 * feed-configured Facility (`hasConfiguredFeed`) — as two independent queries
 * fired together. The results merge into a single review list, but the
 * per-source failure reporting stays legible: an email error, a reconnect
 * prompt, and one banner per un-fetchable Facility feed all render together,
 * and one source failing never hides the other's candidates.
 *
 * The confirm-time duplicate guard (`confirmImportCandidate` /
 * `confirmFeedCandidate`) still holds when both lists render together — email
 * and feed candidates for the same slot resolve to one Booking on confirm,
 * in either order — because that check runs server-side against the live
 * Bookings, not against what's on screen.
 *
 * The two card shapes stay as separate components in one list (the choice
 * #295 made): the email `ReviewItemCard` union keyed on a Gmail message id,
 * the feed cards keyed on the VEVENT UID.
 */
export function SyncBookingsSection({
  orgs,
  canSyncFromEmail,
  mailboxProvider,
  hasConfiguredFeed,
  autoSync = false,
}: {
  orgs: Org[];
  /** Whether the User can sync email at all — Gmail allowlist entry or a Mailbox Link. */
  canSyncFromEmail: boolean;
  /** The connected Mailbox Link's provider, or `null` when nothing is connected yet. */
  mailboxProvider: MailboxProvider | null;
  /** Whether the User has at least one feed-configured Facility. */
  hasConfiguredFeed: boolean;
  /**
   * Start the sync on arrival instead of waiting for the button (issue #471).
   * Set by `?sync=1`, which onboarding's calendar-feed handoff links to: that
   * User has already asked for this by connecting a feed, and landing them on
   * another button to press would be asking twice. Read once, as the initial
   * value — the button below owns every run after it.
   */
  autoSync?: boolean;
}) {
  const [hasSynced, setHasSynced] = useState(autoSync);
  const [settled, setSettled] = useState<Record<ReviewOutcome, number>>({
    added: 0,
    updated: 0,
    removed: 0,
    kept: 0,
    skipped: 0,
  });
  const queryClient = useQueryClient();
  const settledTotal = Object.values(settled).reduce(
    (total, count) => total + count,
    0,
  );

  function recordOutcome(outcome: ReviewOutcome) {
    setSettled((previous) => ({
      ...previous,
      [outcome]: previous[outcome] + 1,
    }));
  }

  // Allowlisted but nothing connected yet — there's no mailbox to search, so
  // email sync doesn't run; the section points them at Settings instead.
  const emailConnected = canSyncFromEmail && mailboxProvider !== null;

  const emailQuery = useQuery<SyncFromEmailResult>({
    queryKey: EMAIL_QUERY_KEY,
    queryFn: () => syncFromEmail(),
    enabled: hasSynced && emailConnected,
  });

  const feedQuery = useQuery<SyncFacilityFeedsResult>({
    queryKey: FEED_QUERY_KEY,
    queryFn: () => syncFacilityFeeds(),
    enabled: hasSynced && hasConfiguredFeed,
  });

  const isFetching =
    (emailConnected && emailQuery.isFetching) ||
    (hasConfiguredFeed && feedQuery.isFetching);

  function handleEmailResolved(
    gmailMessageId: string,
    outcome?: ReviewOutcome,
  ) {
    if (outcome) {
      recordOutcome(outcome);
    }
    queryClient.setQueryData<SyncFromEmailResult>(
      EMAIL_QUERY_KEY,
      (previous) =>
        previous?.status === "ok"
          ? {
              ...previous,
              items: previous.items.filter(
                (item) => item.gmailMessageId !== gmailMessageId,
              ),
            }
          : previous,
    );
  }

  function handleFeedResolved(feedEventUid: string, outcome?: ReviewOutcome) {
    if (outcome) {
      recordOutcome(outcome);
    }
    queryClient.setQueryData<SyncFacilityFeedsResult>(
      FEED_QUERY_KEY,
      (previous) => {
        if (previous?.status !== "ok") {
          return previous;
        }
        return {
          ...previous,
          feeds: previous.feeds.map((feed) =>
            feed.status === "ok"
              ? {
                  ...feed,
                  items: feed.items.filter(
                    (item) => item.feedEventUid !== feedEventUid,
                  ),
                  cancellations: feed.cancellations.filter(
                    (item) => item.feedEventUid !== feedEventUid,
                  ),
                }
              : feed,
          ),
        };
      },
    );
  }

  // "Offer this again" (issue #444) deleted every `dismissed_reservations` row
  // for this slot, so it is suppressed on neither side any more — drop it from
  // both caches, the same way a resolved candidate is dropped, rather than
  // re-running a whole sync (a mailbox round trip, every feed fetched) to
  // learn what this already knows.
  function handleSuppressedResolved(reservation: BookingIdentity) {
    queryClient.setQueryData<SyncFromEmailResult>(EMAIL_QUERY_KEY, (previous) =>
      previous?.status === "ok"
        ? {
            ...previous,
            suppressed: previous.suppressed.filter(
              (slot) => !isSameReservation(slot, reservation),
            ),
          }
        : previous,
    );
    queryClient.setQueryData<SyncFacilityFeedsResult>(FEED_QUERY_KEY, (previous) => {
      if (previous?.status !== "ok") {
        return previous;
      }
      return {
        ...previous,
        feeds: previous.feeds.map((feed) =>
          feed.status === "ok"
            ? {
                ...feed,
                suppressed: feed.suppressed.filter(
                  (slot) => !isSameReservation(slot, reservation),
                ),
              }
            : feed,
        ),
      };
    });
  }

  function handleMergedResolved(
    item: MergedImportCandidate,
    outcome: ReviewOutcome,
  ) {
    // A merged card is one reservation from both sources — clear it from both
    // query caches so it can't come back from either side. The outcome is
    // recorded once here rather than passed to both, since the User settled
    // one card and one reservation, not two.
    recordOutcome(outcome);
    handleEmailResolved(item.gmailMessageId);
    handleFeedResolved(item.feedEventUid);
  }

  const orgNameById = new Map(orgs.map((org) => [org.id, org.displayName]));

  const emailData = emailConnected ? emailQuery.data : undefined;
  const feedData = hasConfiguredFeed ? feedQuery.data : undefined;

  const emailItems = emailData?.status === "ok" ? emailData.items : [];

  const okFeeds =
    feedData?.status === "ok"
      ? feedData.feeds.filter(
          (feed): feed is Extract<typeof feed, { status: "ok" }> =>
            feed.status === "ok",
        )
      : [];
  const erroredFeeds =
    feedData?.status === "ok"
      ? feedData.feeds.filter(
          (feed): feed is Extract<typeof feed, { status: "error" }> =>
            feed.status === "error",
        )
      : [];
  const feedCandidates: CalendarFeedReviewItem[] = okFeeds.flatMap(
    (feed) => feed.items,
  );
  const feedCancellations: CalendarFeedCancellationItem[] = okFeeds.flatMap(
    (feed) => feed.cancellations,
  );
  const feedsLookingWrong = okFeeds.filter((feed) => feed.feedLooksWrong);

  // Reservations both sources dropped against `dismissed_reservations` (issue
  // #444). Concatenated raw — `SuppressedReservations` dedupes, because when
  // both sources are configured for a facility the same reservation is
  // suppressed once on each side and the User said no to it only once.
  const suppressedReservations = [
    ...(emailData?.status === "ok" ? emailData.suppressed : []),
    ...okFeeds.flatMap((feed) => feed.suppressed),
  ];

  // One reservation the User made can arrive from both sources at once (a
  // Mailbox Link and a calendar feed for the same facility) — consolidate the
  // pair into a single card so they don't review, and confirm, the same
  // booking twice (issue #348). `nothingToReview` below stays on the raw
  // `emailItems` / `feedCandidates` counts — a merged card always has a
  // source in each, so it can't hide the empty state.
  const {
    merged: mergedCandidates,
    emailItems: emailItemsToRender,
    feedCandidates: feedCandidatesToRender,
  } = mergeImportCandidates(emailItems, feedCandidates);

  const emailReconnectRequired = emailData?.status === "reconnect_required";
  // A structured `{ status: "error" }` result, *or* a query that rejected
  // outright (a thrown `verifySession` redirect, an uncaught adapter fault) —
  // either way the sync failed and mustn't read as "nothing found".
  const emailError =
    emailData?.status === "error"
      ? emailData.message
      : emailConnected && emailQuery.isError
        ? "Couldn't sync from email. Try again."
        : null;
  const feedError =
    feedData?.status === "error"
      ? feedData.message
      : hasConfiguredFeed && feedQuery.isError
        ? "Couldn't sync your facilities. Try again."
        : null;

  // There's something to sync only if a mailbox is actually connected or a
  // feed is configured. An allowlisted User who hasn't connected yet gets the
  // Settings nudge and no button.
  const canSync = emailConnected || hasConfiguredFeed;

  // Both queries have come back (whichever ran) with nothing to act on and no
  // failure to name — the one shared empty state. A source that isn't
  // configured for this User never blocks it.
  const emailSettled =
    !emailConnected || (emailQuery.isFetched && !emailQuery.isFetching);
  const feedSettled =
    !hasConfiguredFeed || (feedQuery.isFetched && !feedQuery.isFetching);
  // Every card the User still has a decision to make on, across both sources
  // and all three kinds (issue #464). Drives the "nothing here is saved yet"
  // framing, which is the whole point: the cards used to render with no
  // indication that they were a queue rather than the finished result.
  const reviewCount =
    mergedCandidates.length +
    emailItemsToRender.length +
    feedCandidatesToRender.length +
    feedCancellations.length;

  // Of those, the ones carrying an "Add to my bookings" button. The framing
  // names that button, and a review list holding only cancellations or updates
  // has none — telling that User to add the ones they want to keep would be
  // pointing at a control that isn't on screen.
  const addableCount =
    mergedCandidates.length +
    feedCandidatesToRender.length +
    emailItemsToRender.filter((item) => item.kind === "import").length;

  const nothingToReview =
    hasSynced &&
    // Clearing the last card is not "no new bookings found" — that reads as
    // the sync having turned up nothing, moments after it turned up the ones
    // the tally above is reporting on.
    settledTotal === 0 &&
    emailSettled &&
    feedSettled &&
    emailItems.length === 0 &&
    feedCandidates.length === 0 &&
    feedCancellations.length === 0 &&
    erroredFeeds.length === 0 &&
    feedsLookingWrong.length === 0 &&
    !emailReconnectRequired &&
    !emailError &&
    !feedError;

  return (
    <section id="sync" className="scroll-mt-6">
      <h2 className="bb-h text-[1.05rem]">Sync bookings</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pull in the court reservations you&apos;ve made at CourtReserve-powered
        facilities{" "}
        {emailConnected && hasConfiguredFeed ? (
          <>
            from your connected mailbox and from facilities with a calendar feed
            set up on the{" "}
            <Link href={ORGS_PATH} className="underline underline-offset-4">
              Facilities
            </Link>{" "}
            page.
          </>
        ) : hasConfiguredFeed ? (
          <>
            from facilities with a calendar feed set up on the{" "}
            <Link href={ORGS_PATH} className="underline underline-offset-4">
              Facilities
            </Link>{" "}
            page.
          </>
        ) : (
          <>from your connected mailbox.</>
        )}
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {canSync ? (
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={isFetching}
              onClick={() => {
                // The tally reports on the run the User is looking at, so a
                // fresh run starts it over rather than accumulating across
                // syncs.
                setSettled({
                  added: 0,
                  updated: 0,
                  removed: 0,
                  kept: 0,
                  skipped: 0,
                });
                if (!hasSynced) {
                  setHasSynced(true);
                  return;
                }
                if (emailConnected) {
                  emailQuery.refetch();
                }
                if (hasConfiguredFeed) {
                  feedQuery.refetch();
                }
              }}
            >
              {isFetching ? "Checking your bookings…" : "Sync bookings"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Connect a mailbox in Settings to pull in bookings you&apos;ve made
            at CourtReserve-powered facilities.
          </p>
        )}

        {/* Allowlisted for email sync but nothing connected — still worth
            saying so even when a feed is set up and the button already shows. */}
        {canSync && canSyncFromEmail && !mailboxProvider && (
          <p className="text-sm text-muted-foreground">
            Connect a mailbox in Settings to sync from email too.
          </p>
        )}

        {emailReconnectRequired && mailboxProvider && (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">
              {MAILBOX_PROVIDER_IDENTITY_LABEL[mailboxProvider]} needs you to
              reconnect {MAILBOX_PROVIDER_LABEL[mailboxProvider]} before syncing
              again.
            </p>
            <form action={connectMailbox.bind(null, mailboxProvider)}>
              <Button type="submit" variant="outline" size="sm">
                Reconnect {MAILBOX_PROVIDER_LABEL[mailboxProvider]}
              </Button>
            </form>
          </div>
        )}

        {emailError && (
          <p className="text-sm text-destructive" role="alert">
            {emailError}
          </p>
        )}

        {feedError && (
          <p className="text-sm text-destructive" role="alert">
            {feedError}
          </p>
        )}

        {erroredFeeds.map((feed) => (
          <div
            key={feed.orgId}
            className="rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
            role="alert"
          >
            <p className="font-medium">
              Couldn&apos;t fetch{" "}
              {orgNameById.get(feed.orgId) ?? "that facility"}
              &apos;s feed.
            </p>
            <p className="mt-0.5">{feed.message}</p>
          </div>
        ))}

        {feedsLookingWrong.map((feed) => (
          <div
            key={feed.orgId}
            className="rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
            role="alert"
          >
            <p className="font-medium">
              {orgNameById.get(feed.orgId) ?? "That facility"}&apos;s feed looks
              wrong.
            </p>
            <p className="mt-0.5">
              It dropped far more of your bookings at once than a normal
              cancellation would. Nothing was removed. Check the feed URL on the{" "}
              <Link href={ORGS_PATH} className="underline underline-offset-4">
                Facilities
              </Link>{" "}
              page and sync again.
            </p>
          </div>
        ))}

        <SettledTally counts={settled} />

        {reviewCount > 0 && (
          <div>
            <h3 className="bb-h text-sm">
              {reviewCount === 1
                ? "Review 1 reservation"
                : `Review ${reviewCount} reservations`}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Nothing here is saved yet.{" "}
              {addableCount > 0 && (
                <>
                  Choose{" "}
                  {/* Held on one line: it is standing in for a button label,
                      and a phrase broken across two lines stops reading as
                      the name of the thing sitting below it. */}
                  <span className="font-medium whitespace-nowrap text-foreground">
                    Add to my bookings
                  </span>{" "}
                  on the ones you want to keep.{" "}
                </>
              )}
              Booking Buddy never changes your reservation at the facility.
            </p>
          </div>
        )}

        {feedCancellations.length > 0 && (
          <ul className="flex flex-col gap-4">
            {feedCancellations.map((item) => (
              <FeedCancellationCard
                key={item.feedEventUid}
                item={item}
                onResolved={handleFeedResolved}
              />
            ))}
          </ul>
        )}

        {mergedCandidates.length > 0 && (
          <ul className="flex flex-col gap-4">
            {mergedCandidates.map((item) => (
              <MergedCandidateCard
                key={item.mergeKey}
                item={item}
                orgs={orgs}
                onResolved={handleMergedResolved}
              />
            ))}
          </ul>
        )}

        <ReviewItemGroups
          items={emailItemsToRender}
          orgs={orgs}
          onResolved={handleEmailResolved}
        />

        {feedCandidatesToRender.length > 0 && (
          <ul className="flex flex-col gap-4">
            {feedCandidatesToRender.map((item) => (
              <FeedCandidateCard
                key={item.feedEventUid}
                item={item}
                orgs={orgs}
                onResolved={handleFeedResolved}
              />
            ))}
          </ul>
        )}

        {nothingToReview && (
          <p className="text-sm text-muted-foreground">
            No new bookings found.
          </p>
        )}

        {/* Last, and after the empty state: "no new bookings found" plus "3
            were skipped because you dismissed them before" is the pair that
            actually answers "where is my booking?". */}
        <SuppressedReservations
          reservations={suppressedReservations}
          orgs={orgs}
          onOfferedAgain={handleSuppressedResolved}
        />
      </div>
    </section>
  );
}

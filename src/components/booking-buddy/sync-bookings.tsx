"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ReviewItemGroups } from "@/components/booking-buddy/sync-from-email";
import {
  FeedCandidateCard,
  FeedCancellationCard,
} from "@/components/booking-buddy/sync-facilities";
import { ORGS_PATH } from "@/lib/booking-buddy/routes";
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
}: {
  orgs: Org[];
  /** Whether the User can sync email at all — Gmail allowlist entry or a Mailbox Link. */
  canSyncFromEmail: boolean;
  /** The connected Mailbox Link's provider, or `null` when nothing is connected yet. */
  mailboxProvider: MailboxProvider | null;
  /** Whether the User has at least one feed-configured Facility. */
  hasConfiguredFeed: boolean;
}) {
  const [hasSynced, setHasSynced] = useState(false);
  const queryClient = useQueryClient();

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

  function handleEmailResolved(gmailMessageId: string) {
    queryClient.setQueryData<SyncFromEmailResult>(EMAIL_QUERY_KEY, (previous) =>
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

  function handleFeedResolved(feedEventUid: string) {
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
    });
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
  const nothingToReview =
    hasSynced &&
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
    <section>
      <h2 className="font-heading text-lg font-semibold tracking-tight">
        Sync bookings
      </h2>
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
            Connect a mailbox in Settings to pull in bookings you&apos;ve made at
            CourtReserve-powered facilities.
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
              Couldn&apos;t fetch {orgNameById.get(feed.orgId) ?? "that facility"}
              &apos;s feed.
            </p>
            <p className="mt-0.5">
              {feed.message} If this keeps happening, re-copy the feed URL from
              CourtReserve and save it again.
            </p>
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

        <ReviewItemGroups
          items={emailItems}
          orgs={orgs}
          onResolved={handleEmailResolved}
        />

        {feedCandidates.length > 0 && (
          <ul className="flex flex-col gap-4">
            {feedCandidates.map((item) => (
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
          <p className="text-sm text-muted-foreground">No new bookings found.</p>
        )}
      </div>
    </section>
  );
}

"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { OrgSelect } from "@/components/booking-buddy/org-select";
import { useResolveOnSuccess } from "@/components/booking-buddy/use-resolve-on-success";
import { ORGS_PATH } from "@/lib/booking-buddy/routes";
import {
  formatCandidateDate,
  formatCourtLabel,
  formatTimeLabel,
} from "@/lib/booking-buddy/bookings";
import { BOOKING_FORMAT_LABEL } from "@/lib/booking-buddy/capacity";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import type { Org } from "@/lib/booking-buddy/actions/orgs";
import {
  confirmFeedCancellation,
  confirmFeedCandidate,
  dismissFeedCandidate,
  syncFacilityFeeds,
  type CalendarFeedCancellationItem,
  type CalendarFeedReviewItem,
  type SyncFacilityFeedsResult,
} from "@/lib/booking-buddy/actions/calendar-feed";

const EMPTY: ActionResult = {};

const SYNC_QUERY_KEY = ["booking-buddy", "facility-feed-candidates"] as const;

function ActionError({ state }: { state: ActionResult }) {
  if (!state.error) {
    return null;
  }

  return (
    <p className="text-xs text-destructive" role="alert">
      {state.error}
    </p>
  );
}

/**
 * One feed Import Candidate — the `bb-card` shell, detail-line formatters and
 * `OrgSelect` match the "Sync from Email" review's own `import` card, but this
 * is its own component: the email `ReviewItemCard` switches over three kinds
 * and is keyed on a Gmail message id, this one is import-only and keyed on the
 * VEVENT UID. A Calendar Feed is per-Org, so
 * the Facility select is prefilled to the owning Org and stays editable only
 * as a safety valve; every other field rides through as a hidden input so
 * `confirmFeedCandidate` re-runs `parseNewBooking` over the same field names
 * `CreateBookingForm` posts.
 */
function FeedCandidateCard({
  item,
  orgs,
  onResolved,
}: {
  item: CalendarFeedReviewItem;
  orgs: Org[];
  onResolved: (feedEventUid: string) => void;
}) {
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmFeedCandidate,
    EMPTY,
  );
  const [dismissState, dismissAction, dismissPending] = useActionState(
    dismissFeedCandidate,
    EMPTY,
  );
  const busy = confirmPending || dismissPending;
  const facilityFieldId = `feed-facility-${item.feedEventUid}`;

  useResolveOnSuccess(confirmState, () => onResolved(item.feedEventUid));
  useResolveOnSuccess(dismissState, () => onResolved(item.feedEventUid));

  return (
    <li className="bb-card flex flex-col gap-3 p-4">
      <div>
        <p className="font-medium">{item.facilityName}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {item.name} · {formatCandidateDate(item.date)} ·{" "}
          {formatTimeLabel(item.startTime)}–{formatTimeLabel(item.endTime)} ·{" "}
          {formatCourtLabel(item.courtLabel)} · {BOOKING_FORMAT_LABEL[item.format]}
        </p>
        {item.notes && (
          <p className="mt-1 text-xs text-muted-foreground">
            Court list was too long to fit. Saved to Notes: &ldquo;{item.notes}
            &rdquo;
          </p>
        )}
      </div>

      <form
        action={confirmAction}
        className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor={facilityFieldId}>Facility</Label>
          <OrgSelect id={facilityFieldId} orgs={orgs} defaultValue={item.orgId} />
        </div>

        <input type="hidden" name="feed_event_uid" value={item.feedEventUid} />
        <input type="hidden" name="sequence" value={item.sequence} />
        <input type="hidden" name="starts_at" value={item.startsAt} />
        <input type="hidden" name="name" value={item.name} />
        <input type="hidden" name="format" value={item.format} />
        <input type="hidden" name="date" value={item.date} />
        <input type="hidden" name="start_time" value={item.startTime} />
        <input type="hidden" name="end_time" value={item.endTime} />
        <input type="hidden" name="court_label" value={item.courtLabel ?? ""} />
        <input type="hidden" name="notes" value={item.notes ?? ""} />
        <input type="hidden" name="players" value="" />

        <Button type="submit" disabled={busy}>
          {confirmPending ? "Confirming…" : "Confirm"}
        </Button>
      </form>
      <ActionError state={confirmState} />

      <form action={dismissAction} className="self-start">
        <input type="hidden" name="feed_event_uid" value={item.feedEventUid} />
        <input type="hidden" name="org_id" value={item.orgId} />
        <input type="hidden" name="sequence" value={item.sequence} />
        <input type="hidden" name="starts_at" value={item.startsAt} />
        <Button type="submit" variant="ghost" size="sm" disabled={busy}>
          {dismissPending ? "Dismissing…" : "Dismiss"}
        </Button>
      </form>
      <ActionError state={dismissState} />
    </li>
  );
}

/**
 * One feed-diff cancellation candidate (issue #296) — a reservation that was
 * in the feed on a previous sync and has vanished, or now carries a cancelled
 * status, and maps to a logged future Booking. Confirming removes that
 * Booking. Mirrors the email sync's `CancellationBody` — no Org picker, no
 * editable fields, just Remove / Dismiss.
 */
function FeedCancellationCard({
  item,
  onResolved,
}: {
  item: CalendarFeedCancellationItem;
  onResolved: (feedEventUid: string) => void;
}) {
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmFeedCancellation,
    EMPTY,
  );
  const [dismissState, dismissAction, dismissPending] = useActionState(
    dismissFeedCandidate,
    EMPTY,
  );
  const busy = confirmPending || dismissPending;

  useResolveOnSuccess(confirmState, () => onResolved(item.feedEventUid));
  useResolveOnSuccess(dismissState, () => onResolved(item.feedEventUid));

  return (
    <li className="bb-card flex flex-col gap-3 border-destructive/30 p-4">
      <div>
        <p className="font-medium">
          {item.reason === "cancelled"
            ? "Cancelled at the facility"
            : "No longer on the facility's calendar"}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {formatCandidateDate(item.date)} · {formatTimeLabel(item.startTime)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Confirm to remove the matching booking from Booking Buddy.
        </p>
      </div>

      <form action={confirmAction} className="self-start">
        <input type="hidden" name="feed_event_uid" value={item.feedEventUid} />
        <input type="hidden" name="org_id" value={item.orgId} />
        <input type="hidden" name="booking_id" value={item.bookingId} />
        <Button type="submit" variant="destructive" disabled={busy}>
          {confirmPending ? "Removing…" : "Remove booking"}
        </Button>
      </form>
      <ActionError state={confirmState} />

      <form action={dismissAction} className="self-start">
        <input type="hidden" name="feed_event_uid" value={item.feedEventUid} />
        <input type="hidden" name="org_id" value={item.orgId} />
        <input type="hidden" name="sequence" value={0} />
        <input type="hidden" name="starts_at" value={item.startsAt} />
        <Button type="submit" variant="ghost" size="sm" disabled={busy}>
          {dismissPending ? "Dismissing…" : "Keep booking"}
        </Button>
      </form>
      <ActionError state={dismissState} />
    </li>
  );
}

/**
 * "From facility feeds" (issue #295) — the Calendar Feed counterpart of the
 * "Sync from Email" section, rendered adjacent to it on the Bookings page but
 * as its own section. A click-triggered sync (same `enabled` pattern), one
 * error line per Facility that couldn't be fetched (named), and the import
 * candidates rendered through the same card shell as an email import.
 *
 * Not allowlist-gated — a Calendar Feed is available to every User (ADR-0019).
 */
export function SyncFacilitiesSection({
  orgs,
  hasConfiguredFeed,
}: {
  orgs: Org[];
  /** Whether the caller has at least one feed-configured Facility — the section renders only then. */
  hasConfiguredFeed: boolean;
}) {
  const [hasSynced, setHasSynced] = useState(false);
  const queryClient = useQueryClient();

  const { data, isFetching, refetch } = useQuery<SyncFacilityFeedsResult>({
    queryKey: SYNC_QUERY_KEY,
    queryFn: () => syncFacilityFeeds(),
    enabled: hasSynced,
  });

  function handleResolved(feedEventUid: string) {
    queryClient.setQueryData<SyncFacilityFeedsResult>(SYNC_QUERY_KEY, (previous) => {
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

  const okFeeds =
    data?.status === "ok"
      ? data.feeds.filter(
          (feed): feed is Extract<typeof feed, { status: "ok" }> =>
            feed.status === "ok",
        )
      : [];
  const erroredFeeds =
    data?.status === "ok"
      ? data.feeds.filter(
          (feed): feed is Extract<typeof feed, { status: "error" }> =>
            feed.status === "error",
        )
      : [];
  const candidates: CalendarFeedReviewItem[] = okFeeds.flatMap((feed) => feed.items);
  const cancellations: CalendarFeedCancellationItem[] = okFeeds.flatMap(
    (feed) => feed.cancellations,
  );
  const feedsLookingWrong = okFeeds.filter((feed) => feed.feedLooksWrong);
  const nothingToReview =
    candidates.length === 0 &&
    cancellations.length === 0 &&
    erroredFeeds.length === 0 &&
    feedsLookingWrong.length === 0;

  if (!hasConfiguredFeed) {
    return null;
  }

  return (
    <section>
      <h2 className="font-heading text-lg font-semibold tracking-tight">
        From facility feeds
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pull in the reservations you&apos;ve made at facilities with a calendar
        feed set up on the{" "}
        <Link href={ORGS_PATH} className="underline underline-offset-4">
          Facilities
        </Link>{" "}
        page.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={isFetching}
            onClick={() => (hasSynced ? refetch() : setHasSynced(true))}
          >
            {isFetching ? "Checking your feeds…" : "Sync facilities"}
          </Button>
        </div>

        {data?.status === "error" && (
          <p className="text-sm text-destructive" role="alert">
            {data.message}
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
              {orgNameById.get(feed.orgId) ?? "that facility"}&apos;s feed.
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

        {data?.status === "ok" && (
          <>
            {cancellations.length > 0 && (
              <ul className="flex flex-col gap-4">
                {cancellations.map((item) => (
                  <FeedCancellationCard
                    key={item.feedEventUid}
                    item={item}
                    onResolved={handleResolved}
                  />
                ))}
              </ul>
            )}

            {candidates.length > 0 && (
              <ul className="flex flex-col gap-4">
                {candidates.map((item) => (
                  <FeedCandidateCard
                    key={item.feedEventUid}
                    item={item}
                    orgs={orgs}
                    onResolved={handleResolved}
                  />
                ))}
              </ul>
            )}

            {nothingToReview && (
              <p className="text-sm text-muted-foreground">
                No new bookings found.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

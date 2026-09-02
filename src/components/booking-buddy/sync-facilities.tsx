"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { OrgSelect } from "@/components/booking-buddy/org-select";
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
  confirmFeedCandidate,
  dismissFeedCandidate,
  syncFacilityFeeds,
  type CalendarFeedReviewItem,
  type SyncFacilityFeedsResult,
} from "@/lib/booking-buddy/actions/calendar-feed";

const EMPTY: ActionResult = {};

const SYNC_QUERY_KEY = ["booking-buddy", "facility-feed-candidates"] as const;

/** `onResolved` is idempotent — a confirm and a dismiss each get their own effect. */
function useResolveOnSuccess(state: ActionResult, resolve: () => void) {
  useEffect(() => {
    if (state.ok) {
      resolve();
    }
    // Only the action state should re-trigger this — `resolve` closes over
    // values stable within one card's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

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
 * One feed Import Candidate — the same card shell and read-only detail lines
 * the "Sync from Email" review uses for its own `import` items, keyed on the
 * VEVENT UID rather than a Gmail message id. A Calendar Feed is per-Org, so
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
  feedOrgIds,
}: {
  orgs: Org[];
  /** Ids of the caller's Orgs that have a feed configured — the section only renders when this is non-empty. */
  feedOrgIds: string[];
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

  if (feedOrgIds.length === 0) {
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
          <p
            key={feed.orgId}
            className="rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
            role="alert"
          >
            Couldn&apos;t fetch {orgNameById.get(feed.orgId) ?? "that facility"}
            &apos;s feed — {feed.message} You may need to re-copy the URL from
            CourtReserve.
          </p>
        ))}

        {data?.status === "ok" &&
          (candidates.length === 0 ? (
            erroredFeeds.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No new bookings found.
              </p>
            )
          ) : (
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
          ))}
      </div>
    </section>
  );
}

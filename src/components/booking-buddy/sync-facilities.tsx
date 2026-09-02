"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { OrgSelect } from "@/components/booking-buddy/org-select";
import { useResolveOnSuccess } from "@/components/booking-buddy/use-resolve-on-success";
import { ActionError } from "@/components/booking-buddy/action-error";
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
  type CalendarFeedCancellationItem,
  type CalendarFeedReviewItem,
} from "@/lib/booking-buddy/actions/calendar-feed";

const EMPTY: ActionResult = {};

/**
 * The Calendar Feed review cards, rendered by the unified "Sync bookings"
 * section (issue #336) — this file no longer owns a section wrapper or a
 * TanStack Query of its own; `SyncBookingsSection` runs the feed sync
 * alongside email sync and merges both into one review list.
 */

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
export function FeedCandidateCard({
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
export function FeedCancellationCard({
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

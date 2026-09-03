"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { OrgSelect } from "@/components/booking-buddy/org-select";
import { useResolveOnSuccess } from "@/components/booking-buddy/use-resolve-on-success";
import { ActionError } from "@/components/booking-buddy/action-error";
import { ORGS_PATH } from "@/lib/booking-buddy/routes";
import {
  formatCandidateDate,
  formatCourtLabel,
  formatTimeLabel,
  PLAYER_NAME_MAX_LENGTH,
} from "@/lib/booking-buddy/bookings";
import { BOOKING_FORMAT_LABEL } from "@/lib/booking-buddy/capacity";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import type { Org } from "@/lib/booking-buddy/actions/orgs";
import {
  confirmCancellationCandidate,
  confirmImportCandidate,
  confirmMergedCandidate,
  confirmUpdateCandidate,
  dismissMergedCandidate,
  dismissReviewItem,
  type MergedImportCandidate,
  type ReviewItem,
} from "@/lib/booking-buddy/actions/email-sync";

const EMPTY: ActionResult = {};

/**
 * The email ("Sync from Email") review cards, rendered by the unified "Sync
 * bookings" section (issue #336) — this file no longer owns a section wrapper
 * or a TanStack Query; `SyncBookingsSection` runs the email sync and merges
 * its candidates with the feed's into one review list.
 */

/** The three kinds, in the order the review screen groups them for display. */
const REVIEW_KINDS = ["import", "cancellation", "update"] as const;

/** Confirming each kind stays its own action — the three re-validate down completely different paths (see `email-sync.ts`). */
const CONFIRM_ACTION = {
  import: confirmImportCandidate,
  cancellation: confirmCancellationCandidate,
  update: confirmUpdateCandidate,
} as const;

/** The read-only detail lines under the facility name — the one part of the card that varies per kind but carries no form. */
function ReviewItemDetails({ item }: { item: ReviewItem }) {
  if (item.kind === "import") {
    return (
      <>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {item.name} · {formatCandidateDate(item.date)} ·{" "}
          {formatTimeLabel(item.startTime)}–{formatTimeLabel(item.endTime)} ·{" "}
          {formatCourtLabel(item.courtLabel)} ·{" "}
          {BOOKING_FORMAT_LABEL[item.format]}
        </p>
        {item.matchedPlayers.length > 0 && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            With: {item.matchedPlayers.map((player) => player.name).join(", ")}
          </p>
        )}
        {item.notes && (
          <p className="mt-1 text-xs text-muted-foreground">
            Court list was too long to fit. Saved to Notes: &ldquo;{item.notes}
            &rdquo;
          </p>
        )}
      </>
    );
  }

  if (item.kind === "cancellation") {
    return (
      <>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {formatCandidateDate(item.date)} · {formatTimeLabel(item.startTime)} ·{" "}
          {formatCourtLabel(item.courtLabel)}
        </p>
        {item.matched ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Cancelled. Matches a Booking you logged.
          </p>
        ) : (
          <p className="mt-1 text-xs text-destructive">
            No matching booking found. Your records may be out of sync.
          </p>
        )}
      </>
    );
  }

  return (
    <>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {formatCandidateDate(item.date)} · {formatTimeLabel(item.startTime)}–
        {formatTimeLabel(item.endTime)} · {formatCourtLabel(item.courtLabel)} ·{" "}
        {BOOKING_FORMAT_LABEL[item.format]}
      </p>
      {item.matchedPlayers.length > 0 && (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          With: {item.matchedPlayers.map((player) => player.name).join(", ")}
        </p>
      )}
      {item.notes && (
        <p className="mt-1 text-xs text-muted-foreground">
          Court list was too long to fit. Will be saved to Notes: &ldquo;
          {item.notes}&rdquo;
        </p>
      )}
      {item.matched ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Updates a booking you logged.
        </p>
      ) : (
        <p className="mt-1 text-xs text-destructive">
          No matching booking found. Your records may be out of sync.
        </p>
      )}
    </>
  );
}

type BodyProps<K extends ReviewItem["kind"]> = {
  item: Extract<ReviewItem, { kind: K }>;
  confirmAction: (payload: FormData) => void;
  confirmState: ActionResult;
  confirmPending: boolean;
  busy: boolean;
};

/**
 * The little "why isn't my facility here?" nudge next to the Facility label.
 * The picker only lists facilities the User has already saved, so a booking
 * from a court they haven't added yet lands here with nothing pre-selected —
 * this points them at the Facilities page to fix that.
 */
function FacilityFieldHint() {
  return (
    <Popover>
      <PopoverTrigger
        render={<button type="button" />}
        aria-label="Why isn't my facility in the list?"
        className="grid size-4 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info className="size-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <p className="text-sm leading-relaxed">
          Don&apos;t see your facility? Add it on the{" "}
          <Link
            href={ORGS_PATH}
            className="font-medium text-foreground underline underline-offset-2"
          >
            Facilities
          </Link>{" "}
          page and it&apos;ll show up in this list.
        </p>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The Import Candidate's Confirm form — the only kind with a field the User
 * still edits (`<OrgSelect>` when the facility matched no Org). Every other
 * value rides through as a hidden input so `confirmImportCandidate` re-runs
 * `parseNewBooking` over the same field names `CreateBookingForm` posts,
 * rather than trusting the already-parsed item a second time.
 */
function ImportBody({
  item,
  orgs,
  confirmAction,
  confirmState,
  confirmPending,
  busy,
}: BodyProps<"import"> & { orgs: Org[] }) {
  const facilityFieldId = `sync-facility-${item.gmailMessageId}`;

  return (
    <>
      <form
        action={confirmAction}
        className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Label htmlFor={facilityFieldId}>Facility</Label>
            <FacilityFieldHint />
          </div>
          <OrgSelect
            id={facilityFieldId}
            orgs={orgs}
            defaultValue={item.matchedOrgId ?? ""}
          />
        </div>

        <input
          type="hidden"
          name="gmail_message_id"
          value={item.gmailMessageId}
        />
        <input type="hidden" name="name" value={item.name} />
        <input type="hidden" name="format" value={item.format} />
        <input type="hidden" name="date" value={item.date} />
        <input type="hidden" name="start_time" value={item.startTime} />
        <input type="hidden" name="end_time" value={item.endTime} />
        <input type="hidden" name="court_label" value={item.courtLabel ?? ""} />
        <input type="hidden" name="notes" value={item.notes ?? ""} />
        {/* Re-matched at write time by `insertBookingPlayers` (ADR 0011) — this
            carries the parsed names through, not `matchedPlayers`' own
            review-time match. Not a new editable field: same hidden-input
            shape as every other field on this form. Truncated defensively —
            there's no field here for the User to fix an over-long parsed
            name, and per issue #100 a parsing quirk shouldn't block
            confirming the booking; it's recoverable via Edit Booking. */}
        <input
          type="hidden"
          name="players"
          value={item.matchedPlayers
            .map((player) => player.name.slice(0, PLAYER_NAME_MAX_LENGTH))
            .join(", ")}
        />

        <Button type="submit" disabled={busy}>
          {confirmPending ? "Confirming…" : "Confirm"}
        </Button>
      </form>
      <ActionError state={confirmState} />
    </>
  );
}

/**
 * A parsed cancellation, matched or not (issue #65). No Org picker to fill in
 * — a cancellation either resolved to a Booking already on file or it didn't,
 * and there's nothing left for the User to correct either way, just remove or
 * dismiss. The Remove form renders only for a matched item; otherwise the
 * unmatched notice in `ReviewItemDetails` and the shared Dismiss button are
 * all that's left.
 */
function CancellationBody({
  item,
  confirmAction,
  confirmState,
  confirmPending,
  busy,
}: BodyProps<"cancellation">) {
  if (!item.matched) {
    return null;
  }

  return (
    <>
      <form action={confirmAction} className="self-start">
        <input
          type="hidden"
          name="gmail_message_id"
          value={item.gmailMessageId}
        />
        <input type="hidden" name="booking_id" value={item.bookingId} />
        <Button type="submit" variant="destructive" disabled={busy}>
          {confirmPending ? "Removing…" : "Remove booking"}
        </Button>
      </form>
      <ActionError state={confirmState} />
    </>
  );
}

/**
 * A parsed Reservation Update, matched or not (issue #91) — CourtReserve's own
 * resend after a logged reservation's details changed. Like a cancellation,
 * there's no Org picker: `matchUpdateToBooking` already resolved which Booking
 * this refers to (or didn't), so the only choice left is apply it or dismiss
 * it, and the Apply form renders only when it matched.
 */
function UpdateBody({
  item,
  confirmAction,
  confirmState,
  confirmPending,
  busy,
}: BodyProps<"update">) {
  if (!item.matched) {
    return null;
  }

  return (
    <>
      <form action={confirmAction} className="self-start">
        <input
          type="hidden"
          name="gmail_message_id"
          value={item.gmailMessageId}
        />
        <input type="hidden" name="booking_id" value={item.bookingId} />
        <input type="hidden" name="format" value={item.format} />
        <input type="hidden" name="court_label" value={item.courtLabel ?? ""} />
        <input type="hidden" name="notes" value={item.notes ?? ""} />
        <Button type="submit" disabled={busy}>
          {confirmPending ? "Applying…" : "Apply update"}
        </Button>
      </form>
      <ActionError state={confirmState} />
    </>
  );
}

/**
 * One review item on the "Sync from Email" screen (issues #64/#65/#91). Owns
 * the card shell every kind shares — the `bb-card` wrapper, the facility line,
 * the Dismiss form, and the resolve-on-success effects — and switches on
 * `item.kind` for the detail lines and the kind-specific confirm form. The
 * confirm action reference is picked by kind but bound through a single
 * `useActionState` call so the shared `busy` gating stays in one place.
 */
export function ReviewItemCard({
  item,
  orgs,
  onResolved,
}: {
  item: ReviewItem;
  orgs: Org[];
  onResolved: (gmailMessageId: string) => void;
}) {
  const [confirmState, confirmAction, confirmPending] = useActionState(
    CONFIRM_ACTION[item.kind],
    EMPTY,
  );
  const [dismissState, dismissAction, dismissPending] = useActionState(
    dismissReviewItem,
    EMPTY,
  );
  const busy = confirmPending || dismissPending;

  useResolveOnSuccess(confirmState, () => onResolved(item.gmailMessageId));
  useResolveOnSuccess(dismissState, () => onResolved(item.gmailMessageId));

  return (
    <li className="bb-card flex flex-col gap-3 p-4">
      <div>
        <p className="font-medium">{item.facilityName}</p>
        <ReviewItemDetails item={item} />
      </div>

      {item.kind === "import" ? (
        <ImportBody
          item={item}
          orgs={orgs}
          confirmAction={confirmAction}
          confirmState={confirmState}
          confirmPending={confirmPending}
          busy={busy}
        />
      ) : item.kind === "cancellation" ? (
        <CancellationBody
          item={item}
          confirmAction={confirmAction}
          confirmState={confirmState}
          confirmPending={confirmPending}
          busy={busy}
        />
      ) : (
        <UpdateBody
          item={item}
          confirmAction={confirmAction}
          confirmState={confirmState}
          confirmPending={confirmPending}
          busy={busy}
        />
      )}

      <form action={dismissAction} className="self-start">
        <input
          type="hidden"
          name="gmail_message_id"
          value={item.gmailMessageId}
        />
        <Button type="submit" variant="ghost" size="sm" disabled={busy}>
          {dismissPending ? "Dismissing…" : "Dismiss"}
        </Button>
      </form>
      <ActionError state={dismissState} />
    </li>
  );
}

/**
 * One consolidated review card (issue #348) — a single reservation that came
 * in from both the mailbox and a calendar feed, shown once instead of twice.
 * Looks like the email `import` card (it carries the Player(s), which the feed
 * never has), but confirming it runs `confirmMergedCandidate`, which creates
 * one Booking and settles both sources. Keyed on `mergeKey` (both source ids)
 * and resolved out of both query caches by the parent's `onResolved`.
 *
 * The Facility select is prefilled to the matched Org and stays editable as a
 * safety valve, same as the two single-source import cards; every other field
 * rides through as a hidden input so `confirmMergedCandidate` re-runs
 * `parseNewBooking` over the same field names `CreateBookingForm` posts.
 */
export function MergedCandidateCard({
  item,
  orgs,
  onResolved,
}: {
  item: MergedImportCandidate;
  orgs: Org[];
  onResolved: (item: MergedImportCandidate) => void;
}) {
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmMergedCandidate,
    EMPTY,
  );
  const [dismissState, dismissAction, dismissPending] = useActionState(
    dismissMergedCandidate,
    EMPTY,
  );
  const busy = confirmPending || dismissPending;
  const facilityFieldId = `merged-facility-${item.mergeKey}`;

  useResolveOnSuccess(confirmState, () => onResolved(item));
  useResolveOnSuccess(dismissState, () => onResolved(item));

  const players = item.matchedPlayers
    .map((player) => player.name.slice(0, PLAYER_NAME_MAX_LENGTH))
    .join(", ");

  return (
    <li className="bb-card flex flex-col gap-3 p-4">
      <div>
        <p className="font-medium">{item.facilityName}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {item.name} · {formatCandidateDate(item.date)} ·{" "}
          {formatTimeLabel(item.startTime)}–{formatTimeLabel(item.endTime)} ·{" "}
          {formatCourtLabel(item.courtLabel)} ·{" "}
          {BOOKING_FORMAT_LABEL[item.format]}
        </p>
        {item.matchedPlayers.length > 0 && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            With: {item.matchedPlayers.map((player) => player.name).join(", ")}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          From your mailbox and a facility calendar feed.
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
          <div className="flex items-center gap-1.5">
            <Label htmlFor={facilityFieldId}>Facility</Label>
            <FacilityFieldHint />
          </div>
          <OrgSelect
            id={facilityFieldId}
            orgs={orgs}
            defaultValue={item.orgId}
          />
        </div>

        <input
          type="hidden"
          name="gmail_message_id"
          value={item.gmailMessageId}
        />
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
        <input type="hidden" name="players" value={players} />

        <Button type="submit" disabled={busy}>
          {confirmPending ? "Confirming…" : "Confirm"}
        </Button>
      </form>
      <ActionError state={confirmState} />

      <form action={dismissAction} className="self-start">
        <input
          type="hidden"
          name="gmail_message_id"
          value={item.gmailMessageId}
        />
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
 * The flat `ReviewItem` list grouped back into the same three `<ul>` blocks
 * (import, then cancellation, then update) the screen has always shown. The
 * list arrives `byDateAndStartTime`-sorted, and `filter` preserves that
 * order, so each group stays date-sorted exactly as before.
 *
 * Renders nothing when empty — the unified "Sync bookings" section (issue
 * #336) owns the one shared "No new bookings found." line now that email and
 * feed candidates land in the same list.
 */
export function ReviewItemGroups({
  items,
  orgs,
  onResolved,
}: {
  items: ReviewItem[];
  orgs: Org[];
  onResolved: (gmailMessageId: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <>
      {REVIEW_KINDS.map((kind) => {
        const group = items.filter((item) => item.kind === kind);
        if (group.length === 0) {
          return null;
        }

        return (
          <ul key={kind} className="flex flex-col gap-4">
            {group.map((item) => (
              <ReviewItemCard
                key={item.gmailMessageId}
                item={item}
                orgs={orgs}
                onResolved={onResolved}
              />
            ))}
          </ul>
        );
      })}
    </>
  );
}

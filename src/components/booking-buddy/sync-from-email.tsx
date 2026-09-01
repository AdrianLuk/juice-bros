"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { OrgSelect } from "@/components/booking-buddy/org-select";
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
  MAILBOX_PROVIDER_IDENTITY_LABEL,
  MAILBOX_PROVIDER_LABEL,
  type MailboxProvider,
} from "@/lib/booking-buddy/mailbox-provider";
import {
  confirmCancellationCandidate,
  confirmImportCandidate,
  confirmUpdateCandidate,
  connectMailbox,
  dismissReviewItem,
  syncFromEmail,
  type ReviewItem,
  type SyncFromEmailResult,
} from "@/lib/booking-buddy/actions/email-sync";

const EMPTY: ActionResult = {};

const SYNC_QUERY_KEY = ["booking-buddy", "email-sync-candidates"] as const;

/** The three kinds, in the order the review screen groups them for display. */
const REVIEW_KINDS = ["import", "cancellation", "update"] as const;

/** Confirming each kind stays its own action — the three re-validate down completely different paths (see `email-sync.ts`). */
const CONFIRM_ACTION = {
  import: confirmImportCandidate,
  cancellation: confirmCancellationCandidate,
  update: confirmUpdateCandidate,
} as const;

/** `onResolved` is idempotent, so a confirm and a dismiss each get their own effect rather than one watching both. */
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

/** The read-only detail lines under the facility name — the one part of the card that varies per kind but carries no form. */
function ReviewItemDetails({ item }: { item: ReviewItem }) {
  if (item.kind === "import") {
    return (
      <>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {item.name} · {formatCandidateDate(item.date)} · {formatTimeLabel(item.startTime)}–{formatTimeLabel(item.endTime)} ·{" "}
          {formatCourtLabel(item.courtLabel)} · {BOOKING_FORMAT_LABEL[item.format]}
        </p>
        {item.matchedPlayers.length > 0 && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            With: {item.matchedPlayers.map((player) => player.name).join(", ")}
          </p>
        )}
        {item.notes && (
          <p className="mt-1 text-xs text-muted-foreground">
            Court list was too long to fit. Saved to Notes: &ldquo;{item.notes}&rdquo;
          </p>
        )}
      </>
    );
  }

  if (item.kind === "cancellation") {
    return (
      <>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {formatCandidateDate(item.date)} · {formatTimeLabel(item.startTime)} · {formatCourtLabel(item.courtLabel)}
        </p>
        {item.matched ? (
          <p className="mt-1 text-xs text-muted-foreground">Cancelled. Matches a Booking you logged.</p>
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
        {formatCandidateDate(item.date)} · {formatTimeLabel(item.startTime)}–{formatTimeLabel(item.endTime)} ·{" "}
        {formatCourtLabel(item.courtLabel)} · {BOOKING_FORMAT_LABEL[item.format]}
      </p>
      {item.matchedPlayers.length > 0 && (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          With: {item.matchedPlayers.map((player) => player.name).join(", ")}
        </p>
      )}
      {item.notes && (
        <p className="mt-1 text-xs text-muted-foreground">
          Court list was too long to fit. Will be saved to Notes: &ldquo;{item.notes}&rdquo;
        </p>
      )}
      {item.matched ? (
        <p className="mt-1 text-xs text-muted-foreground">Updates a booking you logged.</p>
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
function ImportBody({ item, orgs, confirmAction, confirmState, confirmPending, busy }: BodyProps<"import"> & { orgs: Org[] }) {
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
          <OrgSelect id={facilityFieldId} orgs={orgs} defaultValue={item.matchedOrgId ?? ""} />
        </div>

        <input type="hidden" name="gmail_message_id" value={item.gmailMessageId} />
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
function CancellationBody({ item, confirmAction, confirmState, confirmPending, busy }: BodyProps<"cancellation">) {
  if (!item.matched) {
    return null;
  }

  return (
    <>
      <form action={confirmAction} className="self-start">
        <input type="hidden" name="gmail_message_id" value={item.gmailMessageId} />
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
function UpdateBody({ item, confirmAction, confirmState, confirmPending, busy }: BodyProps<"update">) {
  if (!item.matched) {
    return null;
  }

  return (
    <>
      <form action={confirmAction} className="self-start">
        <input type="hidden" name="gmail_message_id" value={item.gmailMessageId} />
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
  const [confirmState, confirmAction, confirmPending] = useActionState(CONFIRM_ACTION[item.kind], EMPTY);
  const [dismissState, dismissAction, dismissPending] = useActionState(dismissReviewItem, EMPTY);
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
        <input type="hidden" name="gmail_message_id" value={item.gmailMessageId} />
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
 */
function ReviewItemGroups({
  items,
  orgs,
  onResolved,
}: {
  items: ReviewItem[];
  orgs: Org[];
  onResolved: (gmailMessageId: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No new bookings found.</p>;
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
              <ReviewItemCard key={item.gmailMessageId} item={item} orgs={orgs} onResolved={onResolved} />
            ))}
          </ul>
        );
      })}
    </>
  );
}

/**
 * "Sync from Email" (issue #64) — a click-triggered live search rather than
 * something the page loads eagerly, same `enabled` pattern
 * `FriendCalendarDialog` uses for its own click-triggered fetch. Rendered on
 * the Bookings page for a User who can sync; `mailboxProvider` being `null`
 * distinguishes "not connected at all" (send them to Settings) from every
 * other outcome, which `syncFromEmail`'s own result handles once clicked. A
 * non-null provider also names itself in the reconnect prompt so the button
 * restarts the right provider's OAuth flow.
 */
export function SyncFromEmailSection({
  orgs,
  mailboxProvider,
}: {
  orgs: Org[];
  /** The connected Mailbox Link's provider, or `null` when nothing is connected. */
  mailboxProvider: MailboxProvider | null;
}) {
  const [hasSynced, setHasSynced] = useState(false);
  const queryClient = useQueryClient();

  const { data, isFetching, refetch } = useQuery<SyncFromEmailResult>({
    queryKey: SYNC_QUERY_KEY,
    queryFn: () => syncFromEmail(),
    enabled: hasSynced,
  });

  function handleResolved(gmailMessageId: string) {
    queryClient.setQueryData<SyncFromEmailResult>(SYNC_QUERY_KEY, (previous) =>
      previous?.status === "ok"
        ? { ...previous, items: previous.items.filter((item) => item.gmailMessageId !== gmailMessageId) }
        : previous,
    );
  }

  if (!mailboxProvider) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        Connect a mailbox in Settings to pull in bookings you&apos;ve made at
        CourtReserve-powered facilities.
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={isFetching}
          onClick={() => (hasSynced ? refetch() : setHasSynced(true))}
        >
          {isFetching ? "Checking your inbox…" : "Sync from Email"}
        </Button>
      </div>

      {data?.status === "reconnect_required" && (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            {MAILBOX_PROVIDER_IDENTITY_LABEL[mailboxProvider]} needs you to reconnect{" "}
            {MAILBOX_PROVIDER_LABEL[mailboxProvider]} before syncing again.
          </p>
          <form action={connectMailbox.bind(null, mailboxProvider)}>
            <Button type="submit" variant="outline" size="sm">
              Reconnect {MAILBOX_PROVIDER_LABEL[mailboxProvider]}
            </Button>
          </form>
        </div>
      )}

      {data?.status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {data.message}
        </p>
      )}

      {data?.status === "ok" && (
        <ReviewItemGroups items={data.items} orgs={orgs} onResolved={handleResolved} />
      )}
    </div>
  );
}

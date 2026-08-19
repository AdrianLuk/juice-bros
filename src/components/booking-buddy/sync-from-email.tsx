"use client";

import { useActionState, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { OrgSelect } from "@/components/booking-buddy/org-select";
import { formatCandidateDate, formatCourtLabel, formatTimeLabel } from "@/lib/booking-buddy/bookings";
import { BOOKING_FORMAT_LABEL } from "@/lib/booking-buddy/capacity";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import type { Org } from "@/lib/booking-buddy/actions/orgs";
import {
  confirmCancellationCandidate,
  confirmImportCandidate,
  connectGmail,
  dismissImportCandidate,
  syncFromEmail,
  type CancellationCandidate,
  type ImportCandidate,
  type SyncFromEmailResult,
} from "@/lib/booking-buddy/actions/email-sync";

const EMPTY: ActionResult = {};

const SYNC_QUERY_KEY = ["booking-buddy", "email-sync-candidates"] as const;

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

function ImportCandidateCard({
  candidate,
  orgs,
  onResolved,
}: {
  candidate: ImportCandidate;
  orgs: Org[];
  onResolved: (gmailMessageId: string) => void;
}) {
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmImportCandidate, EMPTY);
  const [dismissState, dismissAction, dismissPending] = useActionState(dismissImportCandidate, EMPTY);
  const busy = confirmPending || dismissPending;

  useEffect(() => {
    if (confirmState.ok || dismissState.ok) {
      onResolved(candidate.gmailMessageId);
    }
    // Only the two action states should re-trigger this — `onResolved` and
    // `candidate` are stable enough within one card's lifetime not to matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmState, dismissState]);

  const facilityFieldId = `sync-facility-${candidate.gmailMessageId}`;

  return (
    <li className="bb-card flex flex-col gap-3 p-4">
      <div>
        <p className="font-medium">{candidate.facilityName}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {formatCandidateDate(candidate.date)} · {formatTimeLabel(candidate.startTime)}–{formatTimeLabel(candidate.endTime)} ·{" "}
          {formatCourtLabel(candidate.courtLabel)} · {BOOKING_FORMAT_LABEL[candidate.format]}
        </p>
        {candidate.matchedPlayers.length > 0 && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            With: {candidate.matchedPlayers.map((player) => player.name).join(", ")}
          </p>
        )}
      </div>

      <form
        action={confirmAction}
        className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor={facilityFieldId}>Facility</Label>
          <OrgSelect id={facilityFieldId} orgs={orgs} defaultValue={candidate.matchedOrgId ?? ""} />
        </div>

        <input type="hidden" name="gmail_message_id" value={candidate.gmailMessageId} />
        <input type="hidden" name="format" value={candidate.format} />
        <input type="hidden" name="date" value={candidate.date} />
        <input type="hidden" name="start_time" value={candidate.startTime} />
        <input type="hidden" name="end_time" value={candidate.endTime} />
        <input type="hidden" name="court_label" value={candidate.courtLabel ?? ""} />

        <Button type="submit" disabled={busy}>
          {confirmPending ? "Confirming…" : "Confirm"}
        </Button>
      </form>
      <ActionError state={confirmState} />

      <form action={dismissAction} className="self-start">
        <input type="hidden" name="gmail_message_id" value={candidate.gmailMessageId} />
        <Button type="submit" variant="ghost" size="sm" disabled={busy}>
          {dismissPending ? "Dismissing…" : "Dismiss"}
        </Button>
      </form>
      <ActionError state={dismissState} />
    </li>
  );
}

/**
 * A parsed cancellation, matched or not (issue #65). Unlike
 * `ImportCandidateCard`, there's no Org picker to fill in — a cancellation
 * either resolved to a Booking already on file or it didn't, and there's
 * nothing left for the User to correct either way, just confirm or dismiss.
 */
function CancellationCandidateCard({
  candidate,
  onResolved,
}: {
  candidate: CancellationCandidate;
  onResolved: (gmailMessageId: string) => void;
}) {
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmCancellationCandidate, EMPTY);
  const [dismissState, dismissAction, dismissPending] = useActionState(dismissImportCandidate, EMPTY);
  const busy = confirmPending || dismissPending;

  useEffect(() => {
    if (confirmState.ok || dismissState.ok) {
      onResolved(candidate.gmailMessageId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmState, dismissState]);

  return (
    <li className="bb-card flex flex-col gap-3 p-4">
      <div>
        <p className="font-medium">{candidate.facilityName}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {formatCandidateDate(candidate.date)} · {formatTimeLabel(candidate.startTime)} · {formatCourtLabel(candidate.courtLabel)}
        </p>
        {candidate.matched ? (
          <p className="mt-1 text-xs text-muted-foreground">Cancelled — matches a Booking you logged.</p>
        ) : (
          <p className="mt-1 text-xs text-destructive">
            No matching booking found. Your records may be out of sync.
          </p>
        )}
      </div>

      {candidate.matched && (
        <>
          <form action={confirmAction} className="self-start">
            <input type="hidden" name="gmail_message_id" value={candidate.gmailMessageId} />
            <input type="hidden" name="booking_id" value={candidate.bookingId} />
            <Button type="submit" variant="destructive" disabled={busy}>
              {confirmPending ? "Removing…" : "Remove booking"}
            </Button>
          </form>
          <ActionError state={confirmState} />
        </>
      )}

      <form action={dismissAction} className="self-start">
        <input type="hidden" name="gmail_message_id" value={candidate.gmailMessageId} />
        <Button type="submit" variant="ghost" size="sm" disabled={busy}>
          {dismissPending ? "Dismissing…" : "Dismiss"}
        </Button>
      </form>
      <ActionError state={dismissState} />
    </li>
  );
}

/**
 * "Sync from Email" (issue #64) — a click-triggered live search rather than
 * something the page loads eagerly, same `enabled` pattern
 * `FriendCalendarDialog` uses for its own click-triggered fetch. Only
 * rendered on the Bookings page when the caller is both allowlisted and has
 * an active or expired Mailbox Link — `mailboxLinkConnected` distinguishes
 * "not connected at all" (send them to Settings) from every other outcome,
 * which `syncFromEmail`'s own result handles once clicked.
 */
export function SyncFromEmailSection({
  orgs,
  mailboxLinkConnected,
}: {
  orgs: Org[];
  mailboxLinkConnected: boolean;
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
        ? {
            ...previous,
            candidates: previous.candidates.filter((c) => c.gmailMessageId !== gmailMessageId),
            cancellations: previous.cancellations.filter((c) => c.gmailMessageId !== gmailMessageId),
          }
        : previous,
    );
  }

  if (!mailboxLinkConnected) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        Connect Gmail in Settings to pull in bookings you&apos;ve made at
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
            Google needs you to reconnect Gmail before syncing again.
          </p>
          <form action={connectGmail}>
            <Button type="submit" variant="outline" size="sm">
              Reconnect Gmail
            </Button>
          </form>
        </div>
      )}

      {data?.status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {data.message}
        </p>
      )}

      {data?.status === "ok" && data.candidates.length === 0 && data.cancellations.length === 0 && (
        <p className="text-sm text-muted-foreground">No new bookings found.</p>
      )}

      {data?.status === "ok" && data.candidates.length > 0 && (
        <ul className="flex flex-col gap-4">
          {data.candidates.map((candidate) => (
            <ImportCandidateCard
              key={candidate.gmailMessageId}
              candidate={candidate}
              orgs={orgs}
              onResolved={handleResolved}
            />
          ))}
        </ul>
      )}

      {data?.status === "ok" && data.cancellations.length > 0 && (
        <ul className="flex flex-col gap-4">
          {data.cancellations.map((candidate) => (
            <CancellationCandidateCard
              key={candidate.gmailMessageId}
              candidate={candidate}
              onResolved={handleResolved}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

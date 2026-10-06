"use client";

import { useActionState, useId } from "react";

import { Button } from "@/components/ui/button";
import { BoardCard } from "@/components/booking-buddy/bb/board-card";
import { ActionError } from "@/components/booking-buddy/action-error";
import { BOOKING_FORMAT_LABEL } from "@/lib/booking-buddy/capacity";
import { formatCourtLabel } from "@/lib/booking-buddy/bookings";
import { attachBookingToSlot } from "@/lib/booking-buddy/actions/slots";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import type { CourtMatch } from "@/lib/booking-buddy/actions/court-matches";

const EMPTY: ActionResult = {};

/**
 * "Attach your 8:00 PM court at X?" (issue #582): one note per matching
 * Booking, each attached only by its own button, through the same
 * `attachBookingToSlot` a manual attach uses. Renders nothing with no
 * matches, so a caller can drop it into its notice spot unconditionally.
 *
 * `showGameDay` names which game each note is for, for a list that spans
 * more than one game (the Weekly games row); a game's own page leaves it off.
 */
export function CourtSuggestions({
  matches,
  showGameDay = false,
  className,
}: {
  matches: readonly CourtMatch[];
  showGameDay?: boolean;
  className?: string;
}) {
  if (matches.length === 0) {
    return null;
  }

  return (
    <ul aria-label="Courts to attach" className={className ?? "flex flex-col gap-4"}>
      {matches.map((match) => (
        <CourtSuggestion
          key={`${match.slotId}:${match.bookingId}`}
          match={match}
          showGameDay={showGameDay}
        />
      ))}
    </ul>
  );
}

function CourtSuggestion({
  match,
  showGameDay,
}: {
  match: CourtMatch;
  showGameDay: boolean;
}) {
  const [state, formAction, pending] = useActionState(attachBookingToSlot, EMPTY);
  const questionId = useId();
  const details = [
    showGameDay ? `For ${match.gameDay}` : null,
    formatCourtLabel(match.courtLabel),
    BOOKING_FORMAT_LABEL[match.format],
  ].filter(Boolean);

  return (
    <li>
      <BoardCard
        pin="need"
        pinLabel="Needs you"
        pinAlign="left"
        pinned={false}
        className="bb-slip"
      >
        <form
          action={formAction}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <input type="hidden" name="slot_id" value={match.slotId} />
          <input type="hidden" name="booking_id" value={match.bookingId} />
          <div id={questionId} className="min-w-0">
            <p className="font-medium text-foreground">
              Attach your {match.startLabel} court at {match.orgName}?
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {details.join(" · ")}
            </p>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Button
              type="submit"
              size="sm"
              disabled={pending}
              aria-describedby={questionId}
              // Ink, not orange: the red pin carries the "needs you", and
              // orange stays the screen's one commit (DESIGN.md).
              className="bg-foreground text-(--card) hover:bg-foreground/90"
            >
              {pending ? "Attaching…" : "Attach court"}
            </Button>
            <ActionError state={state} />
          </div>
        </form>
      </BoardCard>
    </li>
  );
}

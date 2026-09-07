"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { ActionError } from "@/components/booking-buddy/action-error";
import { DismissedSlotFields } from "@/components/booking-buddy/dismissed-slot-fields";
import { useResolveOnSuccess } from "@/components/booking-buddy/use-resolve-on-success";
import {
  formatCandidateDate,
  formatCourtLabel,
  formatTimeLabel,
} from "@/lib/booking-buddy/bookings";
import {
  dedupeReservations,
  reservationKey,
  type BookingIdentity,
} from "@/lib/booking-buddy/import-candidate-shaping";
import { offerDismissedReservationAgain } from "@/lib/booking-buddy/actions/dismissed-reservations";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import type { Org } from "@/lib/booking-buddy/actions/orgs";

const EMPTY: ActionResult = {};

/**
 * What a sync dropped because the User had dismissed that slot before (issue
 * #444), and the way to take one back.
 *
 * A dismissal used to hide one email or one feed event; since #437 it hides a
 * *slot*, from both sources at once, which means it can hide a reservation the
 * User never saw. The load-bearing case is a cancel and rebook of the same
 * slot: a genuinely new reservation, arriving under a fresh message id and a
 * fresh VEVENT UID, matching the dismissal recorded against the one it
 * replaced. Both sources drop it. Without this, nothing on the screen said so
 * and nothing could undo it.
 *
 * Deliberately quiet: a closed disclosure under the candidates, not a banner.
 * The common reading is "yes, I dismissed those, that's why they aren't here",
 * which needs one line; the uncommon one is a booking the User is looking for
 * and can't find, which needs the list open and a button.
 */
export function SuppressedReservations({
  reservations,
  orgs,
}: {
  /** Both sources' suppressed lists, concatenated. Deduped here, since only this component holds both. */
  reservations: readonly BookingIdentity[];
  orgs: Org[];
}) {
  // Taken back this session. The two suppressed lists come from the sync
  // queries, and re-running those means re-running a whole sync (a mailbox
  // round trip, every feed fetched) for a row this component knows is gone,
  // so it drops the line itself instead.
  const [offeredAgain, setOfferedAgain] = useState<readonly string[]>([]);

  const orgNameById = new Map(orgs.map((org) => [org.id, org.displayName]));

  const listed = dedupeReservations(reservations).filter(
    (reservation) => !offeredAgain.includes(reservationKey(reservation)),
  );

  if (listed.length === 0) {
    return null;
  }

  return (
    <details className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm">
      <summary className="cursor-pointer text-muted-foreground">
        {listed.length === 1
          ? "1 booking was skipped because you dismissed it before"
          : `${listed.length} bookings were skipped because you dismissed them before`}
      </summary>
      <ul className="mt-3 flex flex-col gap-3">
        {listed.map((reservation) => (
          <SuppressedReservationRow
            key={reservationKey(reservation)}
            reservation={reservation}
            facilityName={orgNameById.get(reservation.orgId) ?? "That facility"}
            onOfferedAgain={() =>
              setOfferedAgain((keys) => [...keys, reservationKey(reservation)])
            }
          />
        ))}
      </ul>
    </details>
  );
}

/**
 * One suppressed reservation, with the control that deletes the dismissal
 * behind it.
 *
 * Its own component because each row runs its own Server Action, and
 * `useActionState` is per-form. The slot posts back through
 * `DismissedSlotFields`, the very same four hidden inputs the Dismiss that
 * recorded it posted, so what can be dismissed can always be taken back.
 *
 * "Offer this again" rather than "Undismiss" or "Restore": nothing is
 * restored, and no Booking appears. All that happens is the next sync stops
 * skipping this slot, which is exactly what the words say.
 */
function SuppressedReservationRow({
  reservation,
  facilityName,
  onOfferedAgain,
}: {
  reservation: BookingIdentity;
  facilityName: string;
  onOfferedAgain: () => void;
}) {
  const [state, action, pending] = useActionState(offerDismissedReservationAgain, EMPTY);

  useResolveOnSuccess(state, onOfferedAgain);

  return (
    <li className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-muted-foreground">
          {facilityName} · {formatCandidateDate(reservation.date)} ·{" "}
          {formatTimeLabel(reservation.startTime)} ·{" "}
          {formatCourtLabel(reservation.courtLabel)}
        </p>
        <ActionError state={state} />
      </div>
      <form action={action} className="shrink-0">
        <DismissedSlotFields slot={reservation} />
        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
          {pending ? "Offering…" : "Offer this again"}
        </Button>
      </form>
    </li>
  );
}

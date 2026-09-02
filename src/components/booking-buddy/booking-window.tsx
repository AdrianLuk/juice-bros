"use client";

import { useActionState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { OptionalOrgSelect } from "@/components/booking-buddy/org-select";
import { ActionError } from "@/components/booking-buddy/action-error";
import { bookingWindowLabel } from "@/lib/booking-buddy/booking-window";
import { ORGS_PATH } from "@/lib/booking-buddy/routes";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import { setIntendedOrg } from "@/lib/booking-buddy/actions/slots";
import type { Org } from "@/lib/booking-buddy/actions/orgs";

const EMPTY: ActionResult = {};

/**
 * The organizer's hint at which facility they plan to book at for this Slot
 * (issue #36) — a bare proposal has no Org yet (that only ever arrives via a
 * real Booking), so this is separate from actually attaching one.
 */
export function IntendedOrgForm({
  slotId,
  orgs,
  intendedOrgId,
}: {
  slotId: string;
  orgs: Org[];
  intendedOrgId: string | null;
}) {
  const [state, formAction, pending] = useActionState(setIntendedOrg, EMPTY);

  if (orgs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a facility on{" "}
        <Link href={ORGS_PATH} className="underline underline-offset-4">
          Facilities
        </Link>{" "}
        first, then come back here to plan which one you&apos;ll book at.
      </p>
    );
  }

  const selected = orgs.find((org) => org.id === intendedOrgId) ?? null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="slot_id" value={slotId} />

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="intended-org">Planning to book at</Label>
        {/* Keyed on the saved value so a successful save remounts the
            select — see the note on BookingWindowForm in orgs.tsx. */}
        <OptionalOrgSelect
          key={intendedOrgId ?? ""}
          id="intended-org"
          orgs={orgs}
          defaultValue={intendedOrgId ?? ""}
          className="sm:max-w-64"
        />
        <p className="text-xs text-muted-foreground">
          {selected
            ? bookingWindowLabel(selected.bookingWindow)
            : "Pick a place to get a reminder once its booking window opens."}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <ActionError state={state} />
        {/* Only after a save — the form does not start out claiming success. */}
        {state.ok && (
          <p className="text-xs text-muted-foreground" role="status">
            Saved.
          </p>
        )}
      </div>
    </form>
  );
}

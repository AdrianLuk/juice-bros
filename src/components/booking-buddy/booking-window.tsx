"use client";

import { useActionState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/booking-buddy/visibility-select";
import { bookingWindowLabel } from "@/lib/booking-buddy/booking-window";
import { ORGS_PATH } from "@/lib/booking-buddy/routes";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import { setIntendedOrg } from "@/lib/booking-buddy/actions/slots";
import type { Org } from "@/lib/booking-buddy/actions/orgs";

const EMPTY: ActionResult = {};

function ActionError({ state }: { state: ActionResult }) {
  if (!state.error) {
    return null;
  }

  return (
    <p className="text-xs text-red-600" role="alert">
      {state.error}
    </p>
  );
}

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
        Add a place on your{" "}
        <Link href={ORGS_PATH} className="underline underline-offset-4">
          Orgs page
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
        <FormSelect
          id="intended-org"
          name="org_id"
          defaultValue={intendedOrgId ?? ""}
          className="sm:max-w-64"
        >
          <option value="">Not set</option>
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.displayName}
            </option>
          ))}
        </FormSelect>
        <p className="text-xs text-muted-foreground">
          {selected
            ? bookingWindowLabel(selected.bookingWindow)
            : "Pick a place to get a reminder once its booking window opens."}
        </p>
      </div>

      <div className="flex flex-col items-start gap-1">
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

"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ORG_NAME_MAX_LENGTH } from "@/lib/booking-buddy/orgs";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import { createOrg, deleteOrg, type Org } from "@/lib/booking-buddy/actions/orgs";

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
 * The hand-typed path — the only one there is until issue #18 brings the Google
 * search. The copy says as much rather than pretending this is the whole story.
 */
export function CreateOrgForm() {
  const [state, formAction, pending] = useActionState(createOrg, EMPTY);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Label htmlFor="org-name">Place name</Label>
        <Input
          id="org-name"
          name="name"
          placeholder="PicklePlex Downsview"
          maxLength={ORG_NAME_MAX_LENGTH}
          required
        />
      </div>
      <div className="flex flex-col items-start gap-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add place"}
        </Button>
        <ActionError state={state} />
      </div>
    </form>
  );
}

export function OrgRow({ org }: { org: Org }) {
  return (
    <li className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="truncate font-medium">{org.displayName}</p>
        {org.address && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {org.address}
          </p>
        )}
        {org.googlePlaceId && !org.address && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            We couldn&apos;t reach Google for this one. Your bookings here are
            fine.
          </p>
        )}
      </div>
      <DeleteOrgButton org={org} />
    </li>
  );
}

function DeleteOrgButton({ org }: { org: Org }) {
  const [state, formAction, pending] = useActionState(deleteOrg, EMPTY);

  // The form lives inside the dialog so the confirm button is the only thing
  // that can submit it — the same shape as removing a friend or a group.
  const form = (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="org_id" value={org.id} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Removing…" : "Remove place"}
      </Button>
      <ActionError state={state} />
    </form>
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button size="sm" variant="ghost" />}>
        Remove
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Remove &ldquo;{org.displayName}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Every booking you&apos;ve logged here goes with it. That only
            changes what Booking Buddy knows — your actual court reservations
            are unaffected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep place</AlertDialogCancel>
          {form}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

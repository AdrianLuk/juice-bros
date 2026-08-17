"use client";

import { useActionState } from "react";
import { MapPinIcon } from "lucide-react";

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
import {
  BOOKING_WINDOW_DAYS_OPTIONS,
  bookingWindowLabel,
  daysBeforeOptionLabel,
} from "@/lib/booking-buddy/booking-window";
import { HALF_HOUR_TIMES, formatTimeLabel } from "@/lib/booking-buddy/bookings";
import { FormSelect } from "@/components/booking-buddy/visibility-select";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import {
  createOrg,
  deleteOrg,
  updateBookingWindow,
  type Org,
} from "@/lib/booking-buddy/actions/orgs";

const EMPTY: ActionResult = {};

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
 * The hand-typed path — for a venue Google has no listing for.
 *
 * No time-zone field for now: every early User (and everyone they're testing
 * with) is in Toronto, and asking for one on top of "I couldn't even find my
 * club" is a speed bump nobody here needs yet (`DEFAULT_HAND_NAMED_TIME_ZONE`
 * in `orgs.ts`, which has the story on bringing `TimeZoneSelect` back). A
 * Place-backed Org (`place-search.tsx`) derives its zone server-side and has
 * never asked.
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
    <li className="flex flex-col gap-4 px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-accent/25 text-accent-foreground/70">
            <MapPinIcon className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{org.displayName}</p>
            {org.address && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {org.address}
                {" · "}
                <span className="text-muted-foreground/70">Powered by Google</span>
              </p>
            )}
            {org.googlePlaceId && !org.address && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                We couldn&apos;t reach Google for this one. Your bookings here are
                fine.
              </p>
            )}
          </div>
        </div>
        <DeleteOrgButton org={org} />
      </div>
      <BookingWindowForm org={org} />
    </li>
  );
}

/**
 * When this facility opens court bookings — a fact about the place, set once
 * and reused for every Slot pointed at it (issue #36), not something to redo
 * per game. Leaving both fields blank clears it.
 */
function BookingWindowForm({ org }: { org: Org }) {
  const [state, formAction, pending] = useActionState(updateBookingWindow, EMPTY);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-md bg-muted/40 p-3"
    >
      <input type="hidden" name="org_id" value={org.id} />

      <Label htmlFor={`booking-window-days-${org.id}`} className="text-xs font-medium">
        Booking window
      </Label>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          <FormSelect
            id={`booking-window-days-${org.id}`}
            name="booking_window_days_before"
            defaultValue={org.bookingWindow?.daysBefore ?? ""}
            className="w-auto bg-background"
            aria-label="Days before"
          >
            <option value="">—</option>
            {BOOKING_WINDOW_DAYS_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {daysBeforeOptionLabel(days)}
              </option>
            ))}
          </FormSelect>
          <span className="text-sm text-muted-foreground">at</span>
          <FormSelect
            name="booking_window_time"
            defaultValue={org.bookingWindow?.time ?? ""}
            className="w-auto bg-background"
            aria-label="Time the window opens"
          >
            <option value="">—</option>
            {HALF_HOUR_TIMES.map((time) => (
              <option key={time} value={time}>
                {formatTimeLabel(time)}
              </option>
            ))}
          </FormSelect>
        </div>

        <div className="flex flex-col items-start gap-1">
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <ActionError state={state} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {bookingWindowLabel(org.bookingWindow)}
      </p>
    </form>
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

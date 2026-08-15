"use client";

import { useActionState, useState, useSyncExternalStore } from "react";

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
import { FormSelect } from "@/components/booking-buddy/visibility-select";
import { COURT_LABEL_MAX_LENGTH } from "@/lib/booking-buddy/bookings";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import type { Org } from "@/lib/booking-buddy/actions/orgs";
import {
  createBooking,
  deleteBooking,
  type Booking,
} from "@/lib/booking-buddy/actions/bookings";

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

/** A zone never changes mid-session, so there is nothing to subscribe to. */
const subscribeToNothing = () => () => {};

const readBrowserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Which clock the times below are on.
 *
 * A real, visible control rather than a hidden field, for two reasons. The
 * browser is the only thing that knows the User's zone — the server is on UTC
 * in production, and defaulting to it is exactly the bug `bookings.time_zone`
 * exists to prevent — but a field filled in by script alone would break with
 * JavaScript off, which every other Booking Buddy form survives. This way
 * script only *preselects* it, and it stays auditable: a booking stored against
 * the wrong clock is invisible until somebody shows up hours late.
 *
 * The zone list is passed in from the server so both renders agree on it;
 * `Intl.supportedValuesOf` is free to differ between Node's ICU and the
 * browser's, and a hydration mismatch on a 600-option list is not worth
 * discovering later.
 */
function TimeZoneSelect({ id, zones }: { id: string; zones: string[] }) {
  // The browser's own zone is a client-only fact, so it is read as one: the
  // server snapshot is empty, the client's is the real zone, and React swaps
  // them after hydration without either a mismatch or a cascading render.
  const detected = useSyncExternalStore(subscribeToNothing, readBrowserZone, () => "");

  // The detected zone is added to the list when the list doesn't already have
  // it, rather than being discarded as unrecognised. The two sides disagree
  // more than you would hope: Node's ICU here lists 418 zones with the legacy
  // spellings only — `Asia/Calcutta`, `Europe/Kiev`, and no `UTC` at all —
  // while browsers report the canonical ids. Matching strictly against the
  // server's list left a Chrome user in India detected as `Asia/Kolkata`, no
  // match, the disabled placeholder selected, and `required` refusing to submit
  // a form whose list never contained their zone under a name they would look
  // for. Postgres accepts both spellings, so passing theirs straight through is
  // safe.
  const options =
    detected && !zones.includes(detected) ? [detected, ...zones] : zones;

  // Null until the User overrides the detection, so a later render can't
  // clobber a choice they made by hand.
  const [chosen, setChosen] = useState<string | null>(null);
  const zone = chosen ?? detected;

  return (
    <FormSelect
      id={id}
      name="time_zone"
      value={zone}
      onChange={(event) => setChosen(event.target.value)}
      required
    >
      <option value="" disabled>
        Pick your time zone
      </option>
      {options.map((value) => (
        <option key={value} value={value}>
          {value.replaceAll("_", " ")}
        </option>
      ))}
    </FormSelect>
  );
}

export function CreateBookingForm({
  orgs,
  zones,
}: {
  orgs: Org[];
  zones: string[];
}) {
  const [state, formAction, pending] = useActionState(createBooking, EMPTY);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="booking-org">Where</Label>
          <FormSelect id="booking-org" name="org_id" defaultValue="" required>
            <option value="" disabled>
              Pick a place
            </option>
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.displayName}
              </option>
            ))}
          </FormSelect>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="booking-court">Court</Label>
          <Input
            id="booking-court"
            name="court_label"
            placeholder="Court 3"
            maxLength={COURT_LABEL_MAX_LENGTH}
            required
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="booking-date">Date</Label>
          <Input id="booking-date" name="date" type="date" required />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="booking-zone">Time zone</Label>
          <TimeZoneSelect id="booking-zone" zones={zones} />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="booking-start">Start</Label>
          <Input id="booking-start" name="start_time" type="time" required />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="booking-end">End</Label>
          <Input id="booking-end" name="end_time" type="time" required />
        </div>
      </div>

      <div className="flex flex-col items-start gap-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Log booking"}
        </Button>
        <ActionError state={state} />
      </div>
    </form>
  );
}

export function BookingRow({ booking }: { booking: Booking }) {
  return (
    <li className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="truncate font-medium">{booking.when}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {booking.orgName} · {booking.courtLabel}
        </p>
      </div>
      <DeleteBookingButton booking={booking} />
    </li>
  );
}

function DeleteBookingButton({ booking }: { booking: Booking }) {
  const [state, formAction, pending] = useActionState(deleteBooking, EMPTY);

  const form = (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="booking_id" value={booking.id} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Removing…" : "Remove booking"}
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
          <AlertDialogTitle>Remove this booking?</AlertDialogTitle>
          <AlertDialogDescription>
            {booking.when} at {booking.orgName}. This only forgets it here —
            your actual court reservation is untouched, so cancel that on the
            facility&apos;s own site if you meant to.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep booking</AlertDialogCancel>
          {form}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

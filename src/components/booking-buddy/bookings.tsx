"use client";

import { useActionState, useEffect, useRef } from "react";

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
import {
  COURT_LABEL_MAX_LENGTH,
  DEFAULT_BOOKING_FORMAT,
  HOUR_TIMES,
  formatTimeLabel,
} from "@/lib/booking-buddy/bookings";
import { BOOKING_FORMATS, BOOKING_FORMAT_LABEL } from "@/lib/booking-buddy/capacity";
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
    <p className="text-xs text-destructive" role="alert">
      {state.error}
    </p>
  );
}

/**
 * On-the-hour slots only — courts are booked in chunks, not whatever a
 * free-typed or click-dragged time picker happens to land on.
 */
function HourTimeSelect({
  id,
  name,
  defaultValue,
}: {
  id: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <FormSelect id={id} name={name} defaultValue={defaultValue} required>
      {HOUR_TIMES.map((time) => (
        <option key={time} value={time}>
          {formatTimeLabel(time)}
        </option>
      ))}
    </FormSelect>
  );
}

export function CreateBookingForm({
  orgs,
  onLogged,
}: {
  orgs: Org[];
  /** Called once the Booking actually saves — e.g. to close whatever dialog this form sits in. */
  onLogged?: () => void;
}) {
  const [state, formAction, pending] = useActionState(createBooking, EMPTY);
  const formRef = useRef<HTMLFormElement>(null);
  // Falls back to the placeholder when nothing's marked default — same as
  // today's "force an explicit pick" behaviour (issue #47).
  const defaultOrgId = orgs.find((org) => org.isDefault)?.id ?? "";

  // `<form action={formAction}>` resets the form's own uncontrolled fields
  // the instant the action settles, error or not — wiping exactly what the
  // User needs to fix on a validation failure. Driving the submit by hand
  // instead means the fields only clear once `state.ok` says the Booking
  // actually saved.
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      onLogged?.();
    }
  }, [state, onLogged]);

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        formAction(new FormData(event.currentTarget));
      }}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="booking-facility">Facility</Label>
          <FormSelect
            id="booking-facility"
            name="org_id"
            defaultValue={defaultOrgId}
            required
          >
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
          <Label htmlFor="booking-format">Format</Label>
          <FormSelect id="booking-format" name="format" defaultValue={DEFAULT_BOOKING_FORMAT}>
            {BOOKING_FORMATS.map((format) => (
              <option key={format} value={format}>
                {BOOKING_FORMAT_LABEL[format]}
              </option>
            ))}
          </FormSelect>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="booking-date">Date</Label>
          <Input id="booking-date" name="date" type="date" required />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="booking-start">Start</Label>
          <HourTimeSelect id="booking-start" name="start_time" defaultValue="18:00" />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="booking-end">End</Label>
          <HourTimeSelect id="booking-end" name="end_time" defaultValue="19:00" />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="booking-court">Court</Label>
          <Input
            id="booking-court"
            name="court_label"
            type="number"
            inputMode="numeric"
            placeholder="3"
            maxLength={COURT_LABEL_MAX_LENGTH}
            required
          />
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
  // `when` is always the popover's date and time joined with " · " (see
  // `formatInstantRange`) — split back apart so the time gets its own line
  // instead of competing with the date for width next to the Remove button.
  const [whenDate, whenTime] = booking.when.split(" · ");

  return (
    <li className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <div className="sm:hidden">
          <p className="font-medium">{whenDate}</p>
          <p className="font-medium">{whenTime}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            Court {booking.courtLabel} · {BOOKING_FORMAT_LABEL[booking.format]}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {booking.orgName}
          </p>
        </div>
        <div className="hidden sm:block">
          <p className="truncate font-medium">{booking.when}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {booking.orgName} · Court {booking.courtLabel} ·{" "}
            {BOOKING_FORMAT_LABEL[booking.format]}
          </p>
        </div>
      </div>
      <DeleteBookingButton booking={booking} />
    </li>
  );
}

export function DeleteBookingButton({ booking }: { booking: Booking }) {
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
      <AlertDialogTrigger render={<Button size="sm" variant="destructive" />}>
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

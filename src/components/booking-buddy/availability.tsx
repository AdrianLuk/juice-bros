"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormSelect } from "@/components/booking-buddy/visibility-select";
import { ActionError } from "@/components/booking-buddy/action-error";
import { HOUR_TIMES, formatTimeLabel } from "@/lib/booking-buddy/datetime";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import {
  createAvailabilityWindow,
  deleteAvailabilityWindow,
} from "@/lib/booking-buddy/actions/availability";
import type { AvailabilityType } from "@/lib/booking-buddy/availability";

const EMPTY: ActionResult = {};

const TYPE_OPTIONS: { value: AvailabilityType; label: string }[] = [
  { value: "busy", label: "Busy" },
  { value: "looking", label: "Looking to play" },
];

/** On-the-hour slots only, same reasoning and picker as `CreateBookingForm`'s own — courts and calendars alike are read off in hour-long chunks, not whatever a free-typed time lands on. */
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

/**
 * Declares an Availability Window, all day by default — "block off a week"
 * is the case this exists for (CONTEXT.md's own example) — with an "All day"
 * checkbox a User can clear to give a shorter, timed stretch instead (e.g.
 * "busy tonight 6–9pm") without a separate form. Entirely informational
 * (ADR 0006): saving one never stops a friend from proposing a Slot, which
 * the sheet around this form says outright rather than letting a User assume
 * otherwise.
 */
export function CreateAvailabilityWindowForm({
  onSaved,
}: {
  /** Called once the window actually saves — e.g. to close whatever dialog this form sits in. */
  onSaved?: () => void;
} = {}) {
  const [state, formAction, pending] = useActionState(createAvailabilityWindow, EMPTY);
  const [allDay, setAllDay] = useState(true);

  useEffect(() => {
    if (state.ok) {
      onSaved?.();
    }
  }, [state, onSaved]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="availability-type">Mark this as</Label>
        <FormSelect id="availability-type" name="type" defaultValue="busy" className="sm:w-40">
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FormSelect>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="availability-from">From</Label>
          <Input id="availability-from" name="from_date" type="date" required />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="availability-to">To</Label>
          <Input id="availability-to" name="to_date" type="date" required />
        </div>

        {!allDay && (
          <>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="availability-start-time">Start time</Label>
              <HourTimeSelect
                id="availability-start-time"
                name="start_time"
                defaultValue="18:00"
              />
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="availability-end-time">End time</Label>
              <HourTimeSelect
                id="availability-end-time"
                name="end_time"
                defaultValue="21:00"
              />
            </div>
          </>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="all_day"
          checked={allDay}
          onChange={(event) => setAllDay(event.target.checked)}
          className="h-5 w-5 rounded border-input accent-primary"
        />
        All day
      </label>

      <div className="flex flex-col items-end gap-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <ActionError state={state} />
      </div>
    </form>
  );
}

export function AvailabilityWindowRow({
  window,
  rangeLabel,
}: {
  window: { id: string; type: AvailabilityType };
  rangeLabel: string;
}) {
  return (
    <li className="bb-card flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{rangeLabel}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {window.type === "busy" ? "Busy" : "Looking to play"}
        </p>
      </div>
      <DeleteAvailabilityWindowButton windowId={window.id} />
    </li>
  );
}

export function DeleteAvailabilityWindowButton({ windowId }: { windowId: string }) {
  const [state, formAction, pending] = useActionState(deleteAvailabilityWindow, EMPTY);

  // The form lives inside the dialog so the confirm button is the only thing
  // that can submit it — the same shape as removing a booking (`DeleteBookingButton`):
  // a plain dismissable Dialog, and full-width stacked buttons that match on mobile.
  const form = (
    <form className="flex flex-col gap-1" action={formAction}>
      <input type="hidden" name="window_id" value={windowId} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Removing…" : "Remove"}
      </Button>
      <ActionError state={state} />
    </form>
  );

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="destructive" />}>
        Remove
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove this availability?</DialogTitle>
          <DialogDescription>
            This only affects what shows on your calendar, not any actual
            court reservation.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Keep availability
          </DialogClose>
          {form}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/booking-buddy/visibility-select";
import { HALF_HOUR_TIMES, formatTimeLabel } from "@/lib/booking-buddy/datetime";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import {
  createAvailabilityWindow,
  deleteAvailabilityWindow,
} from "@/lib/booking-buddy/actions/availability";
import type { AvailabilityType } from "@/lib/booking-buddy/availability";

const EMPTY: ActionResult = {};

const TYPE_OPTIONS: { value: AvailabilityType; label: string }[] = [
  { value: "busy", label: "Busy" },
  { value: "open", label: "Open" },
];

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

/** Half-hour slots only, same reasoning and picker as `CreateBookingForm`'s own — courts and calendars alike are read off in half-hour chunks, not whatever a free-typed time lands on. */
function HalfHourTimeSelect({
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
      {HALF_HOUR_TIMES.map((time) => (
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
export function CreateAvailabilityWindowForm() {
  const [state, formAction, pending] = useActionState(createAvailabilityWindow, EMPTY);
  const [allDay, setAllDay] = useState(true);

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
              <HalfHourTimeSelect
                id="availability-start-time"
                name="start_time"
                defaultValue="18:00"
              />
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="availability-end-time">End time</Label>
              <HalfHourTimeSelect
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

      <div className="flex flex-col items-start gap-1">
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
          {window.type === "busy" ? "Busy" : "Open"}
        </p>
      </div>
      <DeleteAvailabilityWindowButton windowId={window.id} />
    </li>
  );
}

/**
 * No confirm dialog, unlike `DeleteBookingButton` — a Booking mirrors a real
 * reservation, so removing one by mistake means re-typing it; an Availability
 * Window is a few clicks to redeclare and, per ADR 0006, deleting an unwanted
 * one is the intended way to fix it, not an edge case to guard against.
 */
export function DeleteAvailabilityWindowButton({ windowId }: { windowId: string }) {
  const [state, formAction, pending] = useActionState(deleteAvailabilityWindow, EMPTY);

  return (
    <form action={formAction} className="flex shrink-0 flex-col items-end gap-1">
      <input type="hidden" name="window_id" value={windowId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "Removing…" : "Remove"}
      </Button>
      <ActionError state={state} />
    </form>
  );
}

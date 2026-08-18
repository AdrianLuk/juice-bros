"use client";

import { useActionState, useEffect, useRef, useState } from "react";

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
import { OrgSelect } from "@/components/booking-buddy/org-select";
import {
  COURT_LABEL_MAX_LENGTH,
  DEFAULT_BOOKING_FORMAT,
  DEFAULT_DURATION_HOURS,
  DURATION_PRESET_HOURS,
  HOUR_TIMES,
  addHoursToTime,
  formatCourtLabel,
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
const DEFAULT_START_TIME = "18:00";

/** A duration preset's hour count, or "custom" for a hand-typed one. */
type DurationChoice = `${(typeof DURATION_PRESET_HOURS)[number]}` | "custom";

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
  ...props
}: { id: string; name: string } & Omit<
  React.ComponentProps<"select">,
  "id" | "name" | "children"
>) {
  return (
    <FormSelect id={id} name={name} required {...props}>
      {HOUR_TIMES.map((time) => (
        <option key={time} value={time}>
          {formatTimeLabel(time)}
        </option>
      ))}
    </FormSelect>
  );
}

/**
 * 1/2/3-hour presets plus a hand-typed custom count — same idea as
 * CourtReserve's own Duration control, so the User picks how long they played
 * instead of clicking through an End-time dropdown by hand.
 */
function DurationPicker({
  value,
  onChange,
}: {
  value: DurationChoice;
  onChange: (choice: DurationChoice) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Duration">
      {DURATION_PRESET_HOURS.map((hours) => {
        const choice = String(hours) as DurationChoice;
        return (
          <Button
            key={hours}
            type="button"
            variant={value === choice ? "default" : "outline"}
            role="radio"
            aria-checked={value === choice}
            onClick={() => onChange(choice)}
          >
            {hours} hour{hours === 1 ? "" : "s"}
          </Button>
        );
      })}
      <Button
        type="button"
        variant={value === "custom" ? "default" : "outline"}
        role="radio"
        aria-checked={value === "custom"}
        onClick={() => onChange("custom")}
      >
        Custom
      </Button>
    </div>
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

  // Start and Duration are controlled — the End field is computed from them
  // rather than picked, so both need a live value to derive it from.
  const [startTime, setStartTime] = useState(DEFAULT_START_TIME);
  const [durationChoice, setDurationChoice] = useState<DurationChoice>(
    String(DEFAULT_DURATION_HOURS) as DurationChoice,
  );
  const [customHours, setCustomHours] = useState("");

  // Blank while the User has "Custom" selected but hasn't typed a count yet —
  // distinct from an actually-invalid count, which gets its own message below.
  const hasDurationInput = durationChoice !== "custom" || customHours.trim() !== "";
  const durationHours =
    durationChoice === "custom" ? Number(customHours) : Number(durationChoice);
  const endTime = hasDurationInput ? addHoursToTime(startTime, durationHours) : null;
  const durationOverflows = hasDurationInput && endTime === null;

  // Resets the controlled Start/Duration fields in lockstep with the form's
  // own uncontrolled ones below — done here, during render, rather than in
  // the effect: React state that needs to change in response to a prop/state
  // transition is reset by comparing against the previous value mid-render,
  // not as a side effect of one (https://react.dev/learn/you-might-not-need-an-effect).
  const [resetForState, setResetForState] = useState(state);
  if (resetForState !== state) {
    setResetForState(state);
    if (state.ok) {
      setStartTime(DEFAULT_START_TIME);
      setDurationChoice(String(DEFAULT_DURATION_HOURS) as DurationChoice);
      setCustomHours("");
    }
  }

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
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="booking-facility">Facility</Label>
          <OrgSelect id="booking-facility" orgs={orgs} defaultValue={defaultOrgId} />
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
          <HourTimeSelect
            id="booking-start"
            name="start_time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
          <Label>Duration</Label>
          <DurationPicker value={durationChoice} onChange={setDurationChoice} />
          {durationChoice === "custom" && (
            <div className="flex items-center gap-2 pt-0.5">
              <Input
                id="booking-duration-custom"
                aria-label="Custom duration in hours"
                type="number"
                inputMode="numeric"
                min={1}
                max={23}
                step={1}
                placeholder="Hours"
                value={customHours}
                onChange={(event) => setCustomHours(event.target.value)}
                className="w-20"
              />
              <span className="text-xs text-muted-foreground">hours</span>
            </div>
          )}
          {durationOverflows && (
            <p className="text-xs text-destructive" role="alert">
              That runs past midnight — pick fewer hours or an earlier start.
            </p>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="booking-end">End</Label>
          <Input
            id="booking-end"
            value={endTime ? formatTimeLabel(endTime) : "—"}
            disabled
            readOnly
          />
          <input type="hidden" name="end_time" value={endTime ?? ""} />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="booking-court">Court # (optional)</Label>
          <Input
            id="booking-court"
            name="court_label"
            type="number"
            inputMode="numeric"
            placeholder="3"
            maxLength={COURT_LABEL_MAX_LENGTH}
          />
        </div>
      </div>

      <div className="flex flex-col items-start gap-1">
        <Button type="submit" disabled={pending || endTime === null}>
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
            {formatCourtLabel(booking.courtLabel)} · {BOOKING_FORMAT_LABEL[booking.format]}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {booking.orgName}
          </p>
        </div>
        <div className="hidden sm:block">
          <p className="truncate font-medium">{booking.when}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {booking.orgName} · {formatCourtLabel(booking.courtLabel)} ·{" "}
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

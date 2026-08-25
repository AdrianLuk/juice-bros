"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormSelect } from "@/components/booking-buddy/visibility-select";
import { OrgSelect } from "@/components/booking-buddy/org-select";
import {
  COURT_LABEL_MAX_LENGTH,
  DEFAULT_BOOKING_FORMAT,
  DEFAULT_DURATION_HOURS,
  DURATION_PRESET_HOURS,
  HOUR_TIMES,
  NAME_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  addHoursToTime,
  formatCourtLabel,
  formatTimeLabel,
} from "@/lib/booking-buddy/bookings";
import {
  clockInZone,
  formatInstantDateAndTime,
  todayInZone,
} from "@/lib/booking-buddy/datetime";
import {
  BOOKING_FORMATS,
  BOOKING_FORMAT_LABEL,
  type BookingFormat,
} from "@/lib/booking-buddy/capacity";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import type { Org } from "@/lib/booking-buddy/actions/orgs";
import {
  createBooking,
  deleteBooking,
  updateBooking,
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

/**
 * The field grid `CreateBookingForm` and `EditBookingForm` (issue #97) both
 * render — facility, format, name, date, start, duration/end, court. `idPrefix`
 * keeps `<Label htmlFor>` pairs unique when more than one of these is ever
 * mounted at once, e.g. one `EditBookingForm` per row in the Bookings list
 * (same reasoning `orgs.tsx`'s own per-row booking-window fields already use).
 */
function BookingFieldSet({
  idPrefix,
  orgs,
  defaultOrgId,
  defaultFormat,
  defaultName,
  defaultCourtLabel,
  defaultDate,
  startTime,
  onStartTimeChange,
  durationChoice,
  onDurationChange,
  customHours,
  onCustomHoursChange,
  endTime,
  durationOverflows,
}: {
  idPrefix: string;
  orgs: Org[];
  defaultOrgId: string;
  defaultFormat: BookingFormat;
  defaultName: string;
  defaultCourtLabel: string;
  defaultDate: string;
  startTime: string;
  onStartTimeChange: (time: string) => void;
  durationChoice: DurationChoice;
  onDurationChange: (choice: DurationChoice) => void;
  customHours: string;
  onCustomHoursChange: (value: string) => void;
  endTime: string | null;
  durationOverflows: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-facility`}>Facility</Label>
        <OrgSelect id={`${idPrefix}-facility`} orgs={orgs} defaultValue={defaultOrgId} />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-format`}>Format</Label>
        <FormSelect id={`${idPrefix}-format`} name="format" defaultValue={defaultFormat}>
          {BOOKING_FORMATS.map((format) => (
            <option key={format} value={format}>
              {BOOKING_FORMAT_LABEL[format]}
            </option>
          ))}
        </FormSelect>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Name (optional)</Label>
        <Input
          id={`${idPrefix}-name`}
          name="name"
          type="text"
          defaultValue={defaultName}
          placeholder="Tuesday night rally"
          maxLength={NAME_MAX_LENGTH}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-date`}>Date</Label>
        <Input
          id={`${idPrefix}-date`}
          name="date"
          type="date"
          defaultValue={defaultDate}
          required
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-start`}>Start</Label>
        <HourTimeSelect
          id={`${idPrefix}-start`}
          name="start_time"
          value={startTime}
          onChange={(event) => onStartTimeChange(event.target.value)}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
        <Label>Duration</Label>
        <DurationPicker value={durationChoice} onChange={onDurationChange} />
        {durationChoice === "custom" && (
          <div className="flex items-center gap-2 pt-0.5">
            <Input
              id={`${idPrefix}-duration-custom`}
              aria-label="Custom duration in hours"
              type="number"
              inputMode="numeric"
              min={1}
              max={23}
              step={1}
              placeholder="Hours"
              value={customHours}
              onChange={(event) => onCustomHoursChange(event.target.value)}
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
        <Label htmlFor={`${idPrefix}-end`}>End</Label>
        <Input
          id={`${idPrefix}-end`}
          value={endTime ? formatTimeLabel(endTime) : "—"}
          disabled
          readOnly
        />
        <input type="hidden" name="end_time" value={endTime ?? ""} />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-court`}>Court # (optional)</Label>
        <Input
          id={`${idPrefix}-court`}
          name="court_label"
          type="number"
          inputMode="numeric"
          defaultValue={defaultCourtLabel}
          placeholder="3"
          maxLength={COURT_LABEL_MAX_LENGTH}
        />
      </div>
    </div>
  );
}

/** A duration choice matching `hours` if it's one of the presets, otherwise "custom". */
function durationChoiceForHours(hours: number): DurationChoice {
  return (DURATION_PRESET_HOURS as readonly number[]).includes(hours)
    ? (String(hours) as DurationChoice)
    : "custom";
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
      <BookingFieldSet
        idPrefix="booking"
        orgs={orgs}
        defaultOrgId={defaultOrgId}
        defaultFormat={DEFAULT_BOOKING_FORMAT}
        defaultName=""
        defaultCourtLabel=""
        defaultDate=""
        startTime={startTime}
        onStartTimeChange={setStartTime}
        durationChoice={durationChoice}
        onDurationChange={setDurationChoice}
        customHours={customHours}
        onCustomHoursChange={setCustomHours}
        endTime={endTime}
        durationOverflows={durationOverflows}
      />

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="booking-players">Players (optional)</Label>
        <Input
          id="booking-players"
          name="players"
          type="text"
          placeholder="Amy Ace, Ben Backhand"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="booking-notes">Notes (optional)</Label>
        <Textarea
          id="booking-notes"
          name="notes"
          placeholder="Bring extra balls, meet at the north entrance…"
          maxLength={NOTES_MAX_LENGTH}
        />
      </div>

      <div className="flex flex-col items-end gap-1">
        <Button type="submit" disabled={pending || endTime === null}>
          {pending ? "Saving…" : "Log booking"}
        </Button>
        <ActionError state={state} />
      </div>
    </form>
  );
}

/**
 * Edits an existing Booking in place (issue #97), including its Players
 * (issue #101) — same field set as `CreateBookingForm`, pre-filled from
 * `booking`. Unlike the create form,
 * this component unmounts when its Dialog closes (`EditBookingButton`), so it
 * doesn't need the create form's own mid-render "reset after a successful
 * submit" dance: a fresh open just re-derives its initial state from
 * `booking` again.
 */
export function EditBookingForm({
  booking,
  orgs,
  onSaved,
}: {
  booking: Booking;
  orgs: Org[];
  /** Called once the edit actually saves — e.g. to close the dialog this form sits in. */
  onSaved?: () => void;
}) {
  const [state, formAction, pending] = useActionState(updateBooking, EMPTY);

  // Read off the Booking's own clock (its Org's zone), the same one it was
  // written in — not the browser's, which is exactly the bug `formatBookingWhen`
  // exists to avoid on the display side.
  const initialDate = todayInZone(booking.timeZone, new Date(booking.startsAt));
  const initialStartTime = clockInZone(booking.timeZone, new Date(booking.startsAt));
  const initialEndTime = clockInZone(booking.timeZone, new Date(booking.endsAt));
  const initialHours =
    Number(initialEndTime.slice(0, 2)) - Number(initialStartTime.slice(0, 2));
  const initialDurationChoice = durationChoiceForHours(initialHours);

  const [startTime, setStartTime] = useState(initialStartTime);
  const [durationChoice, setDurationChoice] = useState<DurationChoice>(
    initialDurationChoice,
  );
  const [customHours, setCustomHours] = useState(
    initialDurationChoice === "custom" ? String(initialHours) : "",
  );

  const hasDurationInput = durationChoice !== "custom" || customHours.trim() !== "";
  const durationHours =
    durationChoice === "custom" ? Number(customHours) : Number(durationChoice);
  const endTime = hasDurationInput ? addHoursToTime(startTime, durationHours) : null;
  const durationOverflows = hasDurationInput && endTime === null;

  useEffect(() => {
    if (state.ok) {
      onSaved?.();
    }
  }, [state, onSaved]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="booking_id" value={booking.id} />
      <BookingFieldSet
        idPrefix={`booking-edit-${booking.id}`}
        orgs={orgs}
        defaultOrgId={booking.orgId}
        defaultFormat={booking.format}
        defaultName={booking.name ?? ""}
        defaultCourtLabel={booking.courtLabel ?? ""}
        defaultDate={initialDate}
        startTime={startTime}
        onStartTimeChange={setStartTime}
        durationChoice={durationChoice}
        onDurationChange={setDurationChoice}
        customHours={customHours}
        onCustomHoursChange={setCustomHours}
        endTime={endTime}
        durationOverflows={durationOverflows}
      />

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`booking-edit-${booking.id}-players`}>Players (optional)</Label>
        <Input
          id={`booking-edit-${booking.id}-players`}
          name="players"
          type="text"
          defaultValue={booking.players.join(", ")}
          placeholder="Amy Ace, Ben Backhand"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`booking-edit-${booking.id}-notes`}>Notes (optional)</Label>
        <Textarea
          id={`booking-edit-${booking.id}-notes`}
          name="notes"
          defaultValue={booking.notes ?? ""}
          placeholder="Bring extra balls, meet at the north entrance…"
          maxLength={NOTES_MAX_LENGTH}
        />
      </div>

      <div className="flex flex-col items-end gap-1">
        <Button type="submit" disabled={pending || endTime === null}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <ActionError state={state} />
      </div>
    </form>
  );
}

/** The "Edit" dialog next to "Remove" — Bookings list row and calendar popover alike (issue #97). */
export function EditBookingButton({ booking, orgs }: { booking: Booking; orgs: Org[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        Edit
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit booking</DialogTitle>
          <DialogDescription>
            Update it to match what actually changed on the facility&apos;s own
            booking screen.
          </DialogDescription>
        </DialogHeader>
        <EditBookingForm booking={booking} orgs={orgs} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * All of a Booking's details in one place — the Bookings list's "View"
 * button and the dashboard's "Coming up" sidebar (both read-only entry
 * points) share this instead of each growing its own popup, so Edit/Remove
 * stay one tap away from wherever a Booking is first spotted.
 */
export function BookingDetailsModal({
  booking,
  orgs,
  render,
  children,
  nativeButton = true,
}: {
  booking: Booking;
  orgs: Org[];
  render: React.ReactElement;
  children: React.ReactNode;
  /** Set to `false` when `render` isn't a real `<button>` (e.g. a clickable `<li>`) — see Base UI's Dialog Trigger docs. */
  nativeButton?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { date, time } = formatInstantDateAndTime(booking);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={render} nativeButton={nativeButton}>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{booking.name ?? booking.orgName}</DialogTitle>
          {booking.name && <DialogDescription>{booking.orgName}</DialogDescription>}
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Date</dt>
          <dd>{date}</dd>
          <dt className="text-muted-foreground">Time</dt>
          <dd>{time}</dd>
          <dt className="text-muted-foreground">Facility</dt>
          <dd>{booking.orgName}</dd>
          <dt className="text-muted-foreground">Court</dt>
          <dd>{formatCourtLabel(booking.courtLabel)}</dd>
          <dt className="text-muted-foreground">Format</dt>
          <dd>{BOOKING_FORMAT_LABEL[booking.format]}</dd>
          {booking.players.length > 0 && (
            <>
              <dt className="text-muted-foreground">Players</dt>
              <dd>{booking.players.join(", ")}</dd>
            </>
          )}
          {booking.notes && (
            <>
              <dt className="text-muted-foreground">Notes</dt>
              <dd className="whitespace-pre-wrap">{booking.notes}</dd>
            </>
          )}
        </dl>
        <div className="-mx-4 -mb-4 flex justify-end gap-1.5 border-t border-border p-4">
          <EditBookingButton booking={booking} orgs={orgs} />
          <DeleteBookingButton booking={booking} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BookingRow({ booking, orgs }: { booking: Booking; orgs: Org[] }) {
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
          {booking.name && (
            <p className="truncate text-xs font-medium">{booking.name}</p>
          )}
          <p className="truncate text-xs text-muted-foreground">
            {booking.orgName}
          </p>
          {booking.players.length > 0 && (
            <p className="truncate text-xs text-muted-foreground">
              With: {booking.players.join(", ")}
            </p>
          )}
        </div>
        <div className="hidden sm:block">
          <p className="truncate font-medium">{booking.when}</p>
          {booking.name && (
            <p className="mt-0.5 truncate text-xs font-medium">{booking.name}</p>
          )}
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {booking.orgName} · {formatCourtLabel(booking.courtLabel)} ·{" "}
            {BOOKING_FORMAT_LABEL[booking.format]}
          </p>
          {booking.players.length > 0 && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              With: {booking.players.join(", ")}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <BookingDetailsModal booking={booking} orgs={orgs} render={<Button size="sm" variant="outline" />}>
          View
        </BookingDetailsModal>
        <EditBookingButton booking={booking} orgs={orgs} />
        <DeleteBookingButton booking={booking} />
      </div>
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

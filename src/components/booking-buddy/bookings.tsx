"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { DateField, useDateField } from "@/components/booking-buddy/date-field";
import { OrgSelect } from "@/components/booking-buddy/org-select";
import {
  DurationPicker,
  useDurationInput,
  type DurationChoice,
} from "@/components/booking-buddy/duration-picker";
import {
  COURT_LABEL_MAX_LENGTH,
  DEFAULT_BOOKING_FORMAT,
  DEFAULT_DURATION_HOURS,
  HOUR_TIMES,
  NAME_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  formatCourtLabel,
  formatTimeLabel,
} from "@/lib/booking-buddy/bookings";
import {
  clockInZone,
  formatInstantDateAndTime,
  todayInZone,
} from "@/lib/booking-buddy/datetime";
import { ImminenceBadge } from "@/components/booking-buddy/imminence-badge";
import { ActionError } from "@/components/booking-buddy/action-error";
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
  date,
  onDateChange,
  startTime,
  onStartTimeChange,
  durationChoice,
  onDurationChange,
  customHours,
  onCustomHoursChange,
  endTime,
  endCrossesMidnight,
  durationOverflows,
}: {
  idPrefix: string;
  orgs: Org[];
  defaultOrgId: string;
  defaultFormat: BookingFormat;
  defaultName: string;
  defaultCourtLabel: string;
  date: string;
  onDateChange: (value: string) => void;
  startTime: string;
  onStartTimeChange: (time: string) => void;
  durationChoice: DurationChoice;
  onDurationChange: (choice: DurationChoice) => void;
  customHours: string;
  onCustomHoursChange: (value: string) => void;
  endTime: string | null;
  endCrossesMidnight: boolean;
  durationOverflows: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-facility`}>Facility</Label>
        <OrgSelect
          id={`${idPrefix}-facility`}
          orgs={orgs}
          defaultValue={defaultOrgId}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-format`}>Format</Label>
        <FormSelect
          id={`${idPrefix}-format`}
          name="format"
          defaultValue={defaultFormat}
        >
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
        <DateField
          id={`${idPrefix}-date`}
          name="date"
          value={date}
          onChange={onDateChange}
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
            That&apos;s more than a full day. Pick a shorter duration.
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
        {endCrossesMidnight && (
          <p className="text-xs text-muted-foreground">Next day</p>
        )}
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

export function CreateBookingForm({
  orgs,
  onLogged,
  prefill,
}: {
  orgs: Org[];
  /** Called once the Booking actually saves — e.g. to close whatever dialog this form sits in. */
  onLogged?: () => void;
  /**
   * Set when the form is opened from a calendar cell (issue #303): `date`
   * (ISO `YYYY-MM-DD`, browser-local) seeds the Date field, and `startTime`
   * (`HH:00`, Week-view clicks only) seeds Start — Month clicks omit it and
   * keep the 18:00 default. Its mere presence also stamps a hidden
   * `source=calendar` marker on the submission so the create action can emit
   * the calendar-origin analytics event; `parseNewBooking` ignores the field.
   * A plain FAB / Bookings-page open leaves this undefined and carries no
   * marker. `OwnerDashboardCalendar` keys the form on the prefill so each
   * distinct cell click remounts it fresh.
   */
  prefill?: { date: string; startTime?: string };
}) {
  const [state, formAction, pending] = useActionState(createBooking, EMPTY);
  const formRef = useRef<HTMLFormElement>(null);
  // A brief "it saved" acknowledgement for the inline Bookings-page form —
  // when this form sits in the quick-add dialog it closes on success
  // (`onLogged`), so the calendar updating is the feedback there instead.
  const [saved, setSaved] = useState(false);
  // Falls back to the placeholder when nothing's marked default — same as
  // today's "force an explicit pick" behaviour (issue #47).
  const defaultOrgId = orgs.find((org) => org.isDefault)?.id ?? "";

  const initialStartTime = prefill?.startTime ?? DEFAULT_START_TIME;
  const initialDate = prefill?.date ?? "";

  // Start and Duration are controlled — the End field is computed from them
  // rather than picked, so both need a live value to derive it from.
  const duration = useDurationInput(initialStartTime, DEFAULT_DURATION_HOURS);
  const dateInput = useDateField(initialDate);

  // Resets the controlled Start/Duration fields in lockstep with the form's
  // own uncontrolled ones below — done here, during render, rather than in
  // the effect: React state that needs to change in response to a prop/state
  // transition is reset by comparing against the previous value mid-render,
  // not as a side effect of one (https://react.dev/learn/you-might-not-need-an-effect).
  const [resetForState, setResetForState] = useState(state);
  if (resetForState !== state) {
    setResetForState(state);
    if (state.ok) {
      duration.reset(initialStartTime, DEFAULT_DURATION_HOURS);
      dateInput.reset(initialDate);
      // Same mid-render pattern — a state change in response to the action
      // settling, not a side effect of it.
      setSaved(true);
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

  // Let the acknowledgement clear on its own after a few seconds rather than
  // sit there until the next submit.
  useEffect(() => {
    if (!saved) {
      return;
    }
    const timer = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(timer);
  }, [saved]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      {prefill && <input type="hidden" name="source" value="calendar" />}
      <BookingFieldSet
        idPrefix="booking"
        orgs={orgs}
        defaultOrgId={defaultOrgId}
        defaultFormat={DEFAULT_BOOKING_FORMAT}
        defaultName=""
        defaultCourtLabel=""
        date={dateInput.date}
        onDateChange={dateInput.setDate}
        startTime={duration.startTime}
        onStartTimeChange={duration.setStartTime}
        durationChoice={duration.durationChoice}
        onDurationChange={duration.setDurationChoice}
        customHours={duration.customHours}
        onCustomHoursChange={duration.setCustomHours}
        endTime={duration.endTime}
        endCrossesMidnight={duration.endCrossesMidnight}
        durationOverflows={duration.durationOverflows}
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
        <Button
          type="submit"
          disabled={pending || duration.endTime === null || !dateInput.date}
        >
          {pending ? "Saving…" : "Log booking"}
        </Button>
        <ActionError state={state} />
        {saved && !pending && !state.error && (
          <p
            className="bb-anim-in flex items-center gap-1.5 text-xs font-medium text-primary"
            role="status"
          >
            <CheckIcon className="bb-check-pop size-3.5" aria-hidden="true" />
            Locked in. It&apos;s on your calendar.
          </p>
        )}
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
  const initialStartTime = clockInZone(
    booking.timeZone,
    new Date(booking.startsAt),
  );
  const initialEndTime = clockInZone(
    booking.timeZone,
    new Date(booking.endsAt),
  );
  // A Booking that ran past midnight (start 21:00, end 01:00) has an End clock
  // that reads earlier than its Start — its real length is the wrapped gap, so
  // "Custom" pre-fills with e.g. 4 hours rather than -20.
  const rawHours =
    Number(initialEndTime.slice(0, 2)) - Number(initialStartTime.slice(0, 2));
  const initialHours = rawHours > 0 ? rawHours : rawHours + 24;

  const duration = useDurationInput(initialStartTime, initialHours);
  const dateInput = useDateField(initialDate);

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
        date={dateInput.date}
        onDateChange={dateInput.setDate}
        startTime={duration.startTime}
        onStartTimeChange={duration.setStartTime}
        durationChoice={duration.durationChoice}
        onDurationChange={duration.setDurationChoice}
        customHours={duration.customHours}
        onCustomHoursChange={duration.setCustomHours}
        endTime={duration.endTime}
        endCrossesMidnight={duration.endCrossesMidnight}
        durationOverflows={duration.durationOverflows}
      />

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`booking-edit-${booking.id}-players`}>
          Players (optional)
        </Label>
        <Input
          id={`booking-edit-${booking.id}-players`}
          name="players"
          type="text"
          defaultValue={booking.players.join(", ")}
          placeholder="Amy Ace, Ben Backhand"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor={`booking-edit-${booking.id}-notes`}>
          Notes (optional)
        </Label>
        <Textarea
          id={`booking-edit-${booking.id}-notes`}
          name="notes"
          defaultValue={booking.notes ?? ""}
          placeholder="Bring extra balls, meet at the north entrance…"
          maxLength={NOTES_MAX_LENGTH}
        />
      </div>

      <div className="flex flex-col items-end gap-1">
        <Button
          type="submit"
          disabled={pending || duration.endTime === null || !dateInput.date}
        >
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <ActionError state={state} />
      </div>
    </form>
  );
}

/** The "Edit" dialog next to "Remove" — Bookings list row and calendar popover alike (issue #97). */
export function EditBookingButton({
  booking,
  orgs,
}: {
  booking: Booking;
  orgs: Org[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        Edit
      </DialogTrigger>
      <DialogContent className="bb-theme sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit booking</DialogTitle>
          <DialogDescription>
            Update it to match what actually changed on the facility&apos;s own
            booking screen.
          </DialogDescription>
        </DialogHeader>
        <EditBookingForm
          booking={booking}
          orgs={orgs}
          onSaved={() => setOpen(false)}
        />
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
      <DialogContent className="bb-theme sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{booking.name ?? booking.orgName}</DialogTitle>
          {booking.name && (
            <DialogDescription>{booking.orgName}</DialogDescription>
          )}
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

export function BookingRow({
  booking,
  orgs,
  nowIso,
}: {
  booking: Booking;
  orgs: Org[];
  /**
   * When set, an upcoming Booking gets a "Today" / "Tonight" / "Tomorrow"
   * badge — the same imminence cue the dashboard's "Coming up" sidebar
   * shows. Left unset for the History list, where it never applies.
   */
  nowIso?: string;
}) {
  // `when` is always the popover's date and time joined with " · " (see
  // `formatInstantRange`) — split back apart so the time gets its own line
  // instead of competing with the date for width next to the Remove button.
  const [whenDate, whenTime] = booking.when.split(" · ");

  return (
    <li className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        {nowIso && (
          <ImminenceBadge nowIso={nowIso} startsAt={booking.startsAt} />
        )}
        <div className="sm:hidden">
          <p className="font-medium">{whenDate}</p>
          <p className="font-medium">{whenTime}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {formatCourtLabel(booking.courtLabel)} ·{" "}
            {BOOKING_FORMAT_LABEL[booking.format]}
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
            <p className="mt-0.5 truncate text-xs font-medium">
              {booking.name}
            </p>
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
      {/* `gap-2.5` (not the tighter `gap-1.5` these buttons default to)
          keeps "Remove" from sitting right under "Edit" — confirmed behind
          a confirmation dialog either way, but a stray tap shouldn't land
          this close to a destructive action's trigger. */}
      <div className="flex flex-col items-end gap-2.5">
        <BookingDetailsModal
          booking={booking}
          orgs={orgs}
          render={<Button size="sm" variant="outline" />}
        >
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
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="booking_id" value={booking.id} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Removing…" : "Remove booking"}
      </Button>
      <ActionError state={state} />
    </form>
  );

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="destructive" />}>
        Remove
      </DialogTrigger>
      <DialogContent className="bb-theme">
        <DialogHeader>
          <DialogTitle>Remove this booking?</DialogTitle>
          <DialogDescription>
            {booking.when} at {booking.orgName}. This only forgets it here. Your
            actual court reservation is untouched, so cancel that on the
            facility&apos;s own site if you meant to.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Keep booking
          </DialogClose>
          {form}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

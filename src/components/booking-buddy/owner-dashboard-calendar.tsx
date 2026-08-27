"use client";

import type { CSSProperties } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { BOOKINGS_PATH, SLOTS_PATH } from "@/lib/booking-buddy/routes";
import {
  CalendarEventPopover,
  AGENDA_EVENT_CLASS,
  MONTH_EVENT_CLASS,
  WEEK_EVENT_CLASS,
} from "@/components/booking-buddy/calendar-event-popover";
import { DashboardCalendar } from "@/components/booking-buddy/dashboard-calendar";
import {
  eventChipLineBudget,
  type EventRange,
} from "@/components/booking-buddy/dashboard-week-view";
import { DashboardQuickActions } from "@/components/booking-buddy/dashboard-quick-add";
import { DeleteBookingButton, EditBookingButton } from "@/components/booking-buddy/bookings";
import { BOOKING_FORMAT_LABEL } from "@/lib/booking-buddy/capacity";
import {
  formatInstantDateAndTime,
  formatTimeLabelFromMs,
} from "@/lib/booking-buddy/datetime";
import { formatCourtLabel } from "@/lib/booking-buddy/bookings";
import type { Booking } from "@/lib/booking-buddy/actions/bookings";
import type { Org } from "@/lib/booking-buddy/actions/orgs";
import type { AvailabilityWindow } from "@/lib/booking-buddy/availability";

function BookingPopoverDetails({ booking, orgs }: { booking: Booking; orgs: Org[] }) {
  const { date, time } = formatInstantDateAndTime(booking);

  return (
    <div className="flex flex-col gap-2">
      {booking.name && (
        <p className="font-heading text-sm font-semibold">{booking.name}</p>
      )}
      <p className="font-heading text-sm font-semibold">{booking.orgName}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <dt>Date</dt>
        <dd className="text-foreground">{date}</dd>
        <dt>Time</dt>
        <dd className="text-foreground">{time}</dd>
        <dt>Court</dt>
        <dd className="text-foreground">{booking.courtLabel ?? "Not noted"}</dd>
        <dt>Format</dt>
        <dd className="text-foreground">
          {BOOKING_FORMAT_LABEL[booking.format]}
        </dd>
      </dl>
      <div className="mt-1 flex justify-end gap-1.5 border-t border-border pt-2.5">
        <EditBookingButton booking={booking} orgs={orgs} />
        <DeleteBookingButton booking={booking} />
      </div>
    </div>
  );
}

/**
 * The owner's own dashboard calendar (issue #23) — the original
 * `DashboardCalendar` before it became the generic shell reused by the
 * friend calendar (issue #61). Same rendering as before that refactor,
 * just expressed as this file's own render props rather than hardcoded
 * inside the shell: the Week/Month/Agenda views and the popover mechanics
 * moved out to be shared, but nothing about what the owner sees changed.
 */
export function OwnerDashboardCalendar({
  bookings,
  availabilityWindows,
  orgs,
}: {
  bookings: Booking[];
  availabilityWindows: AvailabilityWindow[];
  orgs: Org[];
}) {
  return (
    <DashboardCalendar
      events={bookings}
      availabilityWindows={availabilityWindows}
      quickActions={<DashboardQuickActions orgs={orgs} />}
      agendaEmptyMessage={
        <div className="mx-auto flex max-w-sm flex-col items-center gap-4">
          <p>
            Your games and bookings show up here. Log a court reservation, or
            post a time for your group to respond to.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href={BOOKINGS_PATH}
              className={cn(buttonVariants({ variant: "default", size: "sm" }))}
            >
              Log a booking
            </Link>
            <Link
              href={SLOTS_PATH}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Post a time
            </Link>
          </div>
        </div>
      }
      renderWeekEvent={(
        booking,
        style: CSSProperties,
        { startMs, endMs }: EventRange,
      ) => {
        // A short booking's chip is too short to hold all 3 lines without
        // clipping one under `overflow-hidden` — see `eventChipLineBudget`.
        // Drop the least essential line(s) first (court, then time) rather
        // than let the box clip whichever line happens to fall last; the
        // popover this chip opens always has the full detail.
        const lines = eventChipLineBudget(Number(style.height) || 0);
        const title = booking.name || booking.orgName;
        const showOrgLine = booking.name && lines >= 2;
        const showTimeLine = lines >= (booking.name ? 3 : 2);
        const showCourtLine = lines >= 3;

        return (
          <CalendarEventPopover
            key={booking.id}
            event={booking}
            className={WEEK_EVENT_CLASS}
            style={style}
            renderDetails={(b) => <BookingPopoverDetails booking={b} orgs={orgs} />}
          >
            <p className="truncate font-medium">{title}</p>
            {showOrgLine && (
              <p className="truncate font-medium">{booking.orgName}</p>
            )}
            {showTimeLine && (
              <p className="truncate opacity-90">
                {formatTimeLabelFromMs(startMs)} – {formatTimeLabelFromMs(endMs)}
                {showCourtLine && ` · ${formatCourtLabel(booking.courtLabel)}`}
              </p>
            )}
          </CalendarEventPopover>
        );
      }}
      renderMonthEvent={(booking) => (
        <CalendarEventPopover
          key={booking.id}
          event={booking}
          className={MONTH_EVENT_CLASS}
          renderDetails={(b) => <BookingPopoverDetails booking={b} orgs={orgs} />}
        >
          {booking.name && <p className="truncate">{booking.name}</p>}
          <p className="truncate">{booking.orgName}</p>
          <p className="truncate opacity-90">
            {formatTimeLabelFromMs(new Date(booking.startsAt).getTime())} –{" "}
            {formatTimeLabelFromMs(new Date(booking.endsAt).getTime())} ·{" "}
            {formatCourtLabel(booking.courtLabel)}
          </p>
        </CalendarEventPopover>
      )}
      renderAgendaEvent={(booking) => (
        <CalendarEventPopover
          key={booking.id}
          event={booking}
          className={AGENDA_EVENT_CLASS}
          renderDetails={(b) => <BookingPopoverDetails booking={b} orgs={orgs} />}
        >
          <span className="font-medium">
            {formatTimeLabelFromMs(new Date(booking.startsAt).getTime())}
          </span>
          <span className="min-w-0 flex-1">
            {booking.name && (
              <span className="block truncate">{booking.name}</span>
            )}
            <span className="block truncate text-muted-foreground">
              {booking.orgName} · {formatCourtLabel(booking.courtLabel)}
            </span>
          </span>
        </CalendarEventPopover>
      )}
    />
  );
}

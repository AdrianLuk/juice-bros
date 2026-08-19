"use client";

import type { CSSProperties } from "react";

import {
  CalendarEventPopover,
  AGENDA_EVENT_CLASS,
  MONTH_EVENT_CLASS,
  WEEK_EVENT_CLASS,
} from "@/components/booking-buddy/calendar-event-popover";
import { DashboardCalendar } from "@/components/booking-buddy/dashboard-calendar";
import type { EventRange } from "@/components/booking-buddy/dashboard-week-view";
import { DashboardQuickActions } from "@/components/booking-buddy/dashboard-quick-add";
import { DeleteBookingButton } from "@/components/booking-buddy/bookings";
import { BOOKING_FORMAT_LABEL } from "@/lib/booking-buddy/capacity";
import {
  formatInstantDateAndTime,
  formatTimeLabelFromMs,
} from "@/lib/booking-buddy/datetime";
import { formatCourtLabel } from "@/lib/booking-buddy/bookings";
import type { Booking } from "@/lib/booking-buddy/actions/bookings";
import type { Org } from "@/lib/booking-buddy/actions/orgs";
import type { AvailabilityWindow } from "@/lib/booking-buddy/availability";

function BookingPopoverDetails({ booking }: { booking: Booking }) {
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
      <div className="mt-1 flex justify-end border-t border-border pt-2.5">
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
      agendaEmptyMessage="Nothing coming up. Bookings you log will show up here, grouped by day."
      renderWeekEvent={(
        booking,
        style: CSSProperties,
        { startMs, endMs }: EventRange,
      ) => (
        <CalendarEventPopover
          key={booking.id}
          event={booking}
          className={WEEK_EVENT_CLASS}
          style={style}
          renderDetails={(b) => <BookingPopoverDetails booking={b} />}
        >
          {booking.name && (
            <p className="truncate font-medium">{booking.name}</p>
          )}
          <p className="truncate font-medium">{booking.orgName}</p>
          {/* Fixed-height, absolutely-positioned chip (WEEK_EVENT_CLASS) — a
              1-hour booking barely fits the pre-existing 3 lines already, so
              a name folds time and court onto one line to hold the line
              count steady rather than clipping the court label out of view. */}
          {booking.name ? (
            <p className="truncate opacity-90">
              {formatTimeLabelFromMs(startMs)} – {formatTimeLabelFromMs(endMs)} ·{" "}
              {formatCourtLabel(booking.courtLabel)}
            </p>
          ) : (
            <>
              <p className="truncate opacity-90">
                {formatTimeLabelFromMs(startMs)} – {formatTimeLabelFromMs(endMs)}
              </p>
              <p className="truncate opacity-90">
                {formatCourtLabel(booking.courtLabel)}
              </p>
            </>
          )}
        </CalendarEventPopover>
      )}
      renderMonthEvent={(booking) => (
        <CalendarEventPopover
          key={booking.id}
          event={booking}
          className={MONTH_EVENT_CLASS}
          renderDetails={(b) => <BookingPopoverDetails booking={b} />}
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
          renderDetails={(b) => <BookingPopoverDetails booking={b} />}
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

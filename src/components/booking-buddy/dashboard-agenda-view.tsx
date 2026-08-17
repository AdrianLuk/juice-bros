"use client";

import { useMemo } from "react";

import { dayLabel, groupByLocalDay, upcomingBookings } from "@/lib/booking-buddy/calendar";
import type { Booking } from "@/lib/booking-buddy/actions/bookings";
import { DashboardBookingPopover } from "@/components/booking-buddy/dashboard-booking-popover";

const TIME_LABEL = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

/**
 * The day-grouped list view (issue #23, lowest priority of the three) —
 * forward-looking only, same "future Bookings, soonest first" read as the
 * sidebar (`upcomingBookings`, just uncapped here), with no navigation of
 * its own: it's a second lens onto "everything ahead," not a third
 * independently-scrollable calendar range.
 */
export function DashboardAgendaView({
  bookings,
  now,
  onDayClick,
}: {
  bookings: Booking[];
  now: Date;
  onDayClick: (day: Date) => void;
}) {
  const upcoming = useMemo(
    () => upcomingBookings(bookings, now, Number.POSITIVE_INFINITY),
    [bookings, now],
  );
  const groups = useMemo(
    () => groupByLocalDay(upcoming, (booking) => new Date(booking.startsAt)),
    [upcoming],
  );

  if (upcoming.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        Nothing coming up. Bookings you log will show up here, grouped by day.
      </p>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border/60 overflow-hidden bb-card">
      {[...groups.entries()].map(([key, dayBookings]) => {
        const day = new Date(dayBookings[0].startsAt);

        return (
          <div key={key} className="flex flex-col gap-2 p-3">
            <button
              type="button"
              onClick={() => onDayClick(day)}
              aria-label={`Go to the week of ${day.toDateString()}`}
              className="w-fit text-left text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline"
            >
              {dayLabel(day)}
            </button>
            <ul className="flex flex-col gap-1.5">
              {dayBookings.map((booking) => (
                <li key={booking.id}>
                  <DashboardBookingPopover
                    booking={booking}
                    className="flex w-full items-center gap-3 rounded-md bg-muted/60 px-3 py-2 text-sm hover:bg-muted"
                  >
                    <span className="font-medium">
                      {TIME_LABEL.format(new Date(booking.startsAt))}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {booking.orgName} · {booking.courtLabel}
                    </span>
                  </DashboardBookingPopover>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

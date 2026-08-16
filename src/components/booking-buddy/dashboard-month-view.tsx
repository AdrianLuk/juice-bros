"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import {
  groupByLocalDay,
  isSameDay,
  localDayKey,
  monthGridDays,
} from "@/lib/booking-buddy/calendar";
import {
  resolveAvailabilitySegments,
  type AvailabilityWindow,
  type BusyInterval,
} from "@/lib/booking-buddy/availability";
import type { Booking } from "@/lib/booking-buddy/actions/bookings";
import { DashboardBookingPopover } from "@/components/booking-buddy/dashboard-booking-popover";

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const VISIBLE_PER_DAY = 2;

const TIME_LABEL = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export function DashboardMonthView({
  month,
  today,
  bookings,
  busyIntervals,
  windows,
  onDayClick,
}: {
  month: Date;
  today: Date;
  bookings: Booking[];
  busyIntervals: BusyInterval[];
  windows: AvailabilityWindow[];
  onDayClick: (day: Date) => void;
}) {
  const days = useMemo(() => monthGridDays(month), [month]);
  const currentMonth = month.getMonth();

  const bookingsByDay = useMemo(
    () => groupByLocalDay(bookings, (booking) => new Date(booking.startsAt)),
    [bookings],
  );

  // One sweep across the whole visible grid rather than 42 separate resolver
  // calls — `resolveAvailabilitySegments` already returns segments in range
  // order, so grouping them by the day they fall on is enough.
  const availabilityByDay = useMemo(() => {
    const rangeStart = days[0];
    const rangeEnd = new Date(days[days.length - 1]);
    rangeEnd.setDate(rangeEnd.getDate() + 1);
    const segments = resolveAvailabilitySegments({ rangeStart, rangeEnd, busyIntervals, windows });
    return groupByLocalDay(segments, (segment) => new Date(segment.startsAt));
  }, [days, busyIntervals, windows]);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* Shared horizontal scroller for the weekday header and the day grid
          below it, same reasoning as the Week view's — 7 evenly-divided
          columns are too cramped on a phone to show a booking's time and
          court label, so each column gets a comfortable minimum width and
          the two rows scroll together as one unit. */}
      <div className="overflow-x-auto">
        <div className="grid grid-cols-[repeat(7,minmax(6rem,1fr))] border-b border-border bg-card text-center text-[11px] font-medium text-muted-foreground">
          {WEEKDAY_HEADERS.map((weekday) => (
            <div key={weekday} className="py-2">
              {weekday}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[repeat(7,minmax(6rem,1fr))]">
          {days.map((day) => {
            const key = localDayKey(day);
            const dayBookings = (bookingsByDay.get(key) ?? []).sort(
              (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
            );
            const availabilityTypes = new Set(
              (availabilityByDay.get(key) ?? []).map((segment) => segment.type),
            );
            const overflow = dayBookings.length - VISIBLE_PER_DAY;

            return (
              <div
                key={key}
                className={cn(
                  "flex min-h-24 flex-col gap-1 border-t border-l border-border p-1 first:border-l-0 sm:min-h-28 sm:p-1.5",
                  day.getMonth() !== currentMonth && "bg-muted/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onDayClick(day)}
                    aria-label={`Go to the week of ${day.toDateString()}`}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs font-medium hover:bg-muted",
                      day.getMonth() !== currentMonth && "text-muted-foreground",
                      isSameDay(day, today) && "bg-primary text-primary-foreground hover:bg-primary/90",
                    )}
                  >
                    {day.getDate()}
                  </button>
                  {availabilityTypes.size > 0 && (
                    <span className="flex gap-0.5" aria-hidden>
                      {availabilityTypes.has("open") && (
                        <span
                          title="Open time declared"
                          className="size-1.5 rounded-full border border-accent-foreground/40"
                        />
                      )}
                      {availabilityTypes.has("busy") && (
                        <span
                          title="Busy time declared"
                          className="size-1.5 rounded-full bg-muted-foreground/50"
                        />
                      )}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-0.5">
                  {dayBookings.slice(0, VISIBLE_PER_DAY).map((booking) => (
                    <DashboardBookingPopover
                      key={booking.id}
                      booking={booking}
                      className="block w-full truncate rounded-sm bg-primary/90 px-1 py-0.5 text-[10px] font-medium text-primary-foreground"
                    >
                      {TIME_LABEL.format(new Date(booking.startsAt))} {booking.courtLabel}
                    </DashboardBookingPopover>
                  ))}
                  {overflow > 0 && (
                    <button
                      type="button"
                      onClick={() => onDayClick(day)}
                      className="truncate rounded-sm px-1 py-0.5 text-left text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                    >
                      +{overflow} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

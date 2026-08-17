"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import {
  groupByLocalDay,
  isSameDay,
  layoutMultiDaySpans,
  localDayKey,
  monthGridDays,
} from "@/lib/booking-buddy/calendar";
import {
  resolveAvailabilitySegments,
  type AvailabilitySegment,
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
  // order, so laying them out across the grid days is enough.
  //
  // `layoutMultiDaySpans`, not `groupByLocalDay`: a segment spanning several
  // days ("a whole week off is one window" — CONTEXT.md) has to render in
  // every cell it crosses, connecting edge-to-edge, not just appear once on
  // the day it started (see dashboard-availability-sidebar.tsx's own note on
  // why the calendar overlay is the thing this bar exists to fix).
  const availabilitySpansByDay = useMemo(() => {
    const rangeStart = days[0];
    const rangeEnd = new Date(days[days.length - 1]);
    rangeEnd.setDate(rangeEnd.getDate() + 1);
    const segments = resolveAvailabilitySegments({ rangeStart, rangeEnd, busyIntervals, windows });
    return layoutMultiDaySpans(days, segments);
  }, [days, busyIntervals, windows]);

  return (
    <div className="overflow-hidden bb-card">
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
            const availabilitySpans = availabilitySpansByDay.get(key) ?? [];
            const overflow = dayBookings.length - VISIBLE_PER_DAY;

            return (
              <div
                key={key}
                className={cn(
                  "flex min-h-24 flex-col gap-1 border-t border-l border-border p-1 first:border-l-0 sm:min-h-28 sm:p-1.5",
                  day.getMonth() !== currentMonth && "bg-muted/40",
                )}
              >
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

                {availabilitySpans.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    {availabilitySpans.map(({ event: segment, isStart, isEnd }) => (
                      <AvailabilitySpanBar
                        key={`${segment.type}-${segment.startsAt}`}
                        segment={segment}
                        isStart={isStart}
                        isEnd={isEnd}
                      />
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-0.5">
                  {dayBookings.slice(0, VISIBLE_PER_DAY).map((booking) => (
                    <DashboardBookingPopover
                      key={booking.id}
                      booking={booking}
                      className="block w-full overflow-hidden rounded-sm bg-primary/90 px-1 py-0.5 text-[10px] font-medium text-primary-foreground"
                    >
                      <p className="truncate">{booking.orgName}</p>
                      <p className="truncate opacity-90">
                        {TIME_LABEL.format(new Date(booking.startsAt))} –{" "}
                        {TIME_LABEL.format(new Date(booking.endsAt))} · Court {booking.courtLabel}
                      </p>
                    </DashboardBookingPopover>
                  ))}
                  {overflow > 0 && (
                    <button
                      type="button"
                      onClick={() => onDayClick(day)}
                      className="truncate rounded-sm px-1 py-0.5 text-left text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
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

/**
 * One cell's worth of a Month-view Availability bar (Google Calendar's own
 * multi-day all-day-event look) — a day the bar merely passes through bleeds
 * full-width into its neighbours via a negative margin equal to the cell's
 * own padding, so two adjacent cells' bars touch with no gap and read as one
 * continuous strip; only the day the span actually starts or ends gets a
 * rounded cap. The label renders once, on the start day, the same way a real
 * cross-cell bar would only need to say "Busy" once.
 */
function AvailabilitySpanBar({
  segment,
  isStart,
  isEnd,
}: {
  segment: AvailabilitySegment;
  isStart: boolean;
  isEnd: boolean;
}) {
  const label = segment.type === "busy" ? "Busy" : "Open";

  return (
    <div
      aria-hidden={!isStart}
      className={cn(
        "h-4 truncate px-1 text-left text-[10px] leading-4 font-medium",
        isStart ? "rounded-l-sm" : "-ml-1 sm:-ml-1.5",
        isEnd ? "rounded-r-sm" : "-mr-1 sm:-mr-1.5",
        segment.type === "busy"
          ? "bg-muted-foreground/20 text-foreground/70"
          : "bg-accent/60 text-accent-foreground",
      )}
    >
      {isStart ? label : null}
    </div>
  );
}

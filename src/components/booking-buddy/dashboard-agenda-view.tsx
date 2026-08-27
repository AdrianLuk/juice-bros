"use client";

import { useMemo, type ReactNode } from "react";

import {
  dayLabel,
  groupByLocalDay,
  upcomingBookings,
  type CalendarEvent,
} from "@/lib/booking-buddy/calendar";

/**
 * The day-grouped list view (issue #23, lowest priority of the three) —
 * forward-looking only, same "future events, soonest first" read as the
 * sidebar (`upcomingBookings`, just uncapped here), with no navigation of
 * its own: it's a second lens onto "everything ahead," not a third
 * independently-scrollable calendar range.
 *
 * Generic over what an "event" is — see `dashboard-week-view.tsx`'s own
 * note. `renderEvent` renders one row; the day grouping stays owned here.
 */
export function DashboardAgendaView<T extends CalendarEvent>({
  events,
  now,
  onDayClick,
  renderEvent,
  emptyMessage,
}: {
  events: T[];
  now: Date;
  onDayClick: (day: Date) => void;
  renderEvent: (event: T) => ReactNode;
  emptyMessage: ReactNode;
}) {
  const upcoming = useMemo(
    () => upcomingBookings(events, now, Number.POSITIVE_INFINITY),
    [events, now],
  );
  const groups = useMemo(
    () => groupByLocalDay(upcoming, (event) => new Date(event.startsAt)),
    [upcoming],
  );

  if (upcoming.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border/60 overflow-hidden bb-card">
      {[...groups.entries()].map(([key, dayEvents]) => {
        const day = new Date(dayEvents[0].startsAt);

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
              {dayEvents.map((event) => (
                <li key={event.id}>{renderEvent(event)}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

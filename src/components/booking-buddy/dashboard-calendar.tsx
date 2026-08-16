"use client";

import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  addDays,
  addMonths,
  monthLabel,
  startOfDay,
  startOfWeek,
  weekRangeLabel,
  type CalendarView,
} from "@/lib/booking-buddy/calendar";
import type { Booking } from "@/lib/booking-buddy/actions/bookings";
import type { Org } from "@/lib/booking-buddy/actions/orgs";
import type { AvailabilityWindow } from "@/lib/booking-buddy/availability";
import { DashboardWeekView } from "@/components/booking-buddy/dashboard-week-view";
import { DashboardMonthView } from "@/components/booking-buddy/dashboard-month-view";
import { DashboardAgendaView } from "@/components/booking-buddy/dashboard-agenda-view";
import { QuickAddBooking } from "@/components/booking-buddy/dashboard-quick-add";

const VIEWS: { id: CalendarView; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "agenda", label: "Agenda" },
];

export function DashboardCalendar({
  bookings,
  availabilityWindows,
  orgs,
}: {
  bookings: Booking[];
  availabilityWindows: AvailabilityWindow[];
  orgs: Org[];
}) {
  const [view, setView] = useState<CalendarView>("week");
  // "Today" as of first render — a stable reference for the session rather
  // than something re-read on every keystroke, matching how the rest of this
  // app treats `now` as a value passed in, not a hidden clock read mid-render.
  const [now] = useState(() => new Date());
  const [anchor, setAnchor] = useState(() => startOfDay(now));

  const busyIntervals = useMemo(
    () => bookings.map((booking) => ({ startsAt: booking.startsAt, endsAt: booking.endsAt })),
    [bookings],
  );

  function goToday() {
    setAnchor(startOfDay(now));
  }

  function goBack() {
    setAnchor((current) => (view === "month" ? addMonths(current, -1) : addDays(current, -7)));
  }

  function goForward() {
    setAnchor((current) => (view === "month" ? addMonths(current, 1) : addDays(current, 7)));
  }

  function goToDay(day: Date) {
    setAnchor(startOfDay(day));
    setView("week");
  }

  const weekStart = startOfWeek(anchor);
  const rangeLabel =
    view === "month"
      ? monthLabel(anchor)
      : view === "week"
        ? weekRangeLabel(weekStart)
        : "Coming up";

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5">
          {view !== "agenda" && (
            <>
              <Button variant="outline" size="icon-sm" onClick={goBack} aria-label="Previous">
                <ChevronLeftIcon />
              </Button>
              <Button variant="outline" size="sm" onClick={goToday}>
                Today
              </Button>
              <Button variant="outline" size="icon-sm" onClick={goForward} aria-label="Next">
                <ChevronRightIcon />
              </Button>
            </>
          )}
          <h2 className="font-heading ml-1 text-base font-semibold tracking-tight">
            {rangeLabel}
          </h2>
        </div>

        <div
          role="group"
          aria-label="Calendar view"
          className="flex w-fit gap-0.5 self-start rounded-lg border border-border p-0.5"
        >
          {VIEWS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={view === option.id}
              onClick={() => setView(option.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                view === option.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {view === "week" && (
        <DashboardWeekView
          weekStart={weekStart}
          today={now}
          bookings={bookings}
          busyIntervals={busyIntervals}
          windows={availabilityWindows}
          onDayClick={goToDay}
        />
      )}
      {view === "month" && (
        <DashboardMonthView
          month={anchor}
          today={now}
          bookings={bookings}
          busyIntervals={busyIntervals}
          windows={availabilityWindows}
          onDayClick={goToDay}
        />
      )}
      {view === "agenda" && (
        <DashboardAgendaView bookings={bookings} now={now} onDayClick={goToDay} />
      )}

      <QuickAddBooking orgs={orgs} />
    </div>
  );
}

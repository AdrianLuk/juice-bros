"use client";

import { useEffect, useMemo, useState } from "react";
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
import { DashboardQuickActions } from "@/components/booking-buddy/dashboard-quick-add";

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
  //
  // Deliberately *not* a `useState(() => new Date())` lazy initializer: that
  // initializer would run during SSR (in the server's timezone) and again
  // during client hydration (in the browser's), and every date function in
  // calendar.ts is intentionally browser-local — so near a local midnight the
  // two runs can land on different calendar days and trip a hydration
  // mismatch. Computing `now` in an effect instead means the first client
  // render matches the server's placeholder exactly; the real date lands a
  // tick later, client-only.
  const [now, setNow] = useState<Date | null>(null);
  const [anchor, setAnchor] = useState<Date | null>(null);

  useEffect(() => {
    const clientNow = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot read of the client's clock on mount, not derived state
    setNow(clientNow);
    setAnchor(startOfDay(clientNow));
  }, []);

  const busyIntervals = useMemo(
    () => bookings.map((booking) => ({ startsAt: booking.startsAt, endsAt: booking.endsAt })),
    [bookings],
  );

  if (!now || !anchor) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-150 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  // Rebound to a non-nullable local: the `if (!now)` guard above narrows
  // `now` itself, but that narrowing doesn't survive into the closures below.
  const today = now;

  function goToday() {
    setAnchor(startOfDay(today));
  }

  function goBack() {
    setAnchor((current) =>
      current ? (view === "month" ? addMonths(current, -1) : addDays(current, -7)) : current,
    );
  }

  function goForward() {
    setAnchor((current) =>
      current ? (view === "month" ? addMonths(current, 1) : addDays(current, 7)) : current,
    );
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
        {/* Date on the left, nav buttons pushed to the right on mobile
            (`justify-between` + explicit `order`) — grouped together on the
            left instead, buttons first, on `sm:` and up, matching how this
            row read before the date/button split. */}
        <div className="flex items-center justify-between gap-1.5 sm:justify-start">
          <h2 className="font-heading order-1 text-base font-semibold tracking-tight sm:order-2 sm:ml-1">
            {rangeLabel}
          </h2>
          {view !== "agenda" && (
            <div className="order-2 flex items-center gap-1.5 sm:order-1">
              <Button variant="outline" size="icon-sm" onClick={goBack} aria-label="Previous">
                <ChevronLeftIcon />
              </Button>
              <Button variant="outline" size="sm" onClick={goToday}>
                Today
              </Button>
              <Button variant="outline" size="icon-sm" onClick={goForward} aria-label="Next">
                <ChevronRightIcon />
              </Button>
            </div>
          )}
        </div>

        <div
          role="group"
          aria-label="Calendar view"
          className="flex w-fit gap-0.5 self-center rounded-lg border border-border p-0.5 sm:self-start"
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
          today={today}
          bookings={bookings}
          busyIntervals={busyIntervals}
          windows={availabilityWindows}
          onDayClick={goToDay}
        />
      )}
      {view === "month" && (
        <DashboardMonthView
          month={anchor}
          today={today}
          bookings={bookings}
          busyIntervals={busyIntervals}
          windows={availabilityWindows}
          onDayClick={goToDay}
        />
      )}
      {view === "agenda" && (
        <DashboardAgendaView bookings={bookings} now={today} onDayClick={goToDay} />
      )}

      <DashboardQuickActions orgs={orgs} />
    </div>
  );
}

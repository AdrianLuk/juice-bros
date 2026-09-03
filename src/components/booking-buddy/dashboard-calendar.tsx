"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  addDays,
  addMonths,
  monthLabel,
  notEndedBefore,
  startOfDay,
  startOfMonth,
  startOfWeek,
  weekRangeLabel,
  type CalendarEvent,
  type CalendarView,
} from "@/lib/booking-buddy/calendar";
import type { AvailabilityWindow } from "@/lib/booking-buddy/availability";
import {
  DashboardWeekView,
  type EventRange,
} from "@/components/booking-buddy/dashboard-week-view";
import { DashboardMonthView } from "@/components/booking-buddy/dashboard-month-view";
import { DashboardAgendaView } from "@/components/booking-buddy/dashboard-agenda-view";

const VIEWS: { id: CalendarView; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "agenda", label: "Agenda" },
];

/**
 * The Month/Week/Agenda shell (issue #23): navigation chrome, view
 * switching, and "today" resolution — reused as-is by the owner's own
 * dashboard (`OwnerDashboardCalendar`) and the friend calendar (issue #61,
 * `FriendDashboardCalendar`). Generic over what an "event" is; each caller
 * supplies its own chip/detail rendering, so this file never needs to know
 * whether an event is a Booking with a court label or a friend's stripped
 * busy time.
 *
 * `quickActions` is a slot rather than a hardcoded `DashboardQuickActions`
 * — the friend calendar has no creation affordances at all (issue #61),
 * and `undefined` here simply renders nothing.
 *
 * `onQuickCreate` is the same story for the calendar-cell quick-create
 * (issue #303): the owner's dashboard passes it and the friend calendar
 * leaves it out, so the friend grid stays creation-free. The Week view
 * (#306) passes the clicked row's hour; the Month view (#307) passes `null`
 * and lets the form keep its own default start time, hence the
 * `number | null` in the signature.
 *
 * `restrictToFuture`, when set, is two bounds sharing one floor
 * (`minAnchor`, below), not one: navigation can't move the anchor earlier
 * than today (`clampToMin`, applied everywhere the anchor can change), *and*
 * `events`/`availabilityWindows` are pre-filtered to drop anything that
 * ended before today — otherwise the currently-displayed week or month,
 * which always renders as a full grid, would still show the friend's real
 * past busy/looking-to-play time on any day before today that happens to fall in the
 * *current* week/month (e.g. Sunday–Tuesday of the week "today" sits in).
 * Filtering the data is what actually satisfies "a friend cannot see your
 * past," not just the navigation bound — issue #61's own acceptance
 * criterion. Deliberately not a `minDate` prop taking an arbitrary caller-
 * supplied `Date`: "today" here has to be the same client-resolved `now`
 * this component already computes below (browser-local, read in an effect
 * to dodge the SSR/hydration mismatch the comment above explains) — a
 * second, independently-computed "today" handed down as a prop could disagree
 * with it near a local midnight.
 */
export function DashboardCalendar<T extends CalendarEvent>({
  events,
  availabilityWindows,
  quickActions,
  onQuickCreate,
  restrictToFuture = false,
  renderWeekEvent,
  renderMonthEvent,
  renderAgendaEvent,
  agendaEmptyMessage,
}: {
  events: T[];
  availabilityWindows: AvailabilityWindow[];
  quickActions?: ReactNode;
  /**
   * When set, an empty non-past calendar cell is a quick-create target (a
   * hover-revealed `+` on a pointer, a bare tap target on touch — #327) that
   * calls this with the cell's day and, from the Week view, the clicked row's
   * hour (the Month view, #307, passes `null` and keeps the form's default
   * start). Absent on the friend calendar, which renders no creation
   * affordances.
   */
  onQuickCreate?: (date: Date, startHour: number | null) => void;
  restrictToFuture?: boolean;
  renderWeekEvent: (
    event: T,
    style: CSSProperties,
    range: EventRange,
  ) => ReactNode;
  renderMonthEvent: (event: T) => ReactNode;
  renderAgendaEvent: (event: T) => ReactNode;
  agendaEmptyMessage: ReactNode;
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

  // While true, the grid body and its day-number cells carry
  // `view-transition-name`s (see `dashboard-week-view` / `dashboard-month-view`)
  // so a Week↔Month switch reflows through a View Transition: the shared day
  // cells travel between their two positions, the rest of the grid cross-fades,
  // the box tweens its height. The names are only present for the length of the
  // transition — left on permanently they'd pull the calendar out of the page's
  // own route transition into a separate group.
  //
  // Reserved for the switches where the reflow *is* the point (Month↔Week, and
  // click-a-day-into-Week). Period navigation (prev/next/today) is deliberately
  // instant: it's the most-repeated calendar action, it shares no cells to
  // travel, and `flushSync`-ing a full grid re-render on every arrow press is
  // exactly the "laggy on click" feel to avoid.
  const [gridTransitioning, setGridTransitioning] = useState(false);

  function animateGrid(update: () => void) {
    if (
      typeof document === "undefined" ||
      typeof document.startViewTransition !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      update();
      return;
    }

    flushSync(() => setGridTransitioning(true));
    const transition = document.startViewTransition(() => flushSync(update));
    transition.finished.finally(() => setGridTransitioning(false));
  }

  useEffect(() => {
    const clientNow = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot read of the client's clock on mount, not derived state
    setNow(clientNow);
    setAnchor(startOfDay(clientNow));
  }, []);

  // `now` rather than the later-rebound `today`: this has to run unconditionally,
  // before the loading-skeleton return below, so it can't depend on a value
  // only defined past that guard. `null` until mount, same as `now` itself —
  // harmless, since nothing downstream reads `visibleEvents`/`visibleWindows`
  // before that guard passes either.
  const minAnchor = restrictToFuture && now ? startOfDay(now) : null;

  // The navigation clamp (`clampToMin`, below) only bounds where the anchor
  // can move to — it doesn't stop the *currently displayed* week or month,
  // which always renders as a full grid, from showing days before today that
  // happen to fall in the current period (e.g. Sunday–Tuesday of the week
  // "today" sits in). Filtering here is what actually keeps a friend's past
  // busy/looking-to-play time off the screen, not the navigation bound alone.
  const visibleEvents = useMemo(
    () => (minAnchor ? notEndedBefore(events, minAnchor) : events),
    [events, minAnchor],
  );

  const visibleWindows = useMemo(
    () =>
      minAnchor
        ? notEndedBefore(availabilityWindows, minAnchor)
        : availabilityWindows,
    [availabilityWindows, minAnchor],
  );

  const busyIntervals = useMemo(
    () =>
      visibleEvents.map((event) => ({
        startsAt: event.startsAt,
        endsAt: event.endsAt,
      })),
    [visibleEvents],
  );

  if (!now || !anchor) {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="h-9 w-48 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        <div className="h-150 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
      </div>
    );
  }

  // Rebound to a non-nullable local: the `if (!now)` guard above narrows
  // `now` itself, but that narrowing doesn't survive into the closures below.
  // `minAnchor` itself was already computed above (off `now`, not `today`) so
  // it could feed the `visibleEvents`/`visibleWindows` memos ahead of this
  // guard — reused here rather than recomputed.
  const today = now;

  function clampToMin(date: Date): Date {
    return minAnchor && date < minAnchor ? minAnchor : date;
  }

  function goToday() {
    setAnchor(clampToMin(startOfDay(today)));
  }

  function goBack() {
    setAnchor((current) =>
      current
        ? clampToMin(
            view === "month" ? addMonths(current, -1) : addDays(current, -7),
          )
        : current,
    );
  }

  function goForward() {
    setAnchor((current) =>
      current
        ? view === "month"
          ? addMonths(current, 1)
          : addDays(current, 7)
        : current,
    );
  }

  function goToDay(day: Date) {
    animateGrid(() => {
      setAnchor(clampToMin(startOfDay(day)));
      setView("week");
    });
  }

  const weekStart = startOfWeek(anchor);
  const rangeLabel =
    view === "month"
      ? monthLabel(anchor)
      : view === "week"
        ? weekRangeLabel(weekStart)
        : "Coming up";

  // "Previous" is disabled once the visible period already contains
  // `minAnchor` — nothing earlier is reachable, so a live but no-op button
  // would just be confusing. Not evaluated for the Agenda view, which has no
  // navigation of its own and is already forward-looking only.
  //
  // Deliberately a *period-start* comparison, not a reuse of `clampToMin`'s
  // day-level one: `clampToMin` answers "is this exact date before the
  // floor," which is right for clamping an arbitrary target (`goToDay`'s
  // `day`, `goToday`'s `today`) but wrong for gating this button — `anchor`
  // itself can sit anywhere inside the floor's own week/month (e.g. today
  // is Wednesday; `anchor` is Wednesday, not the week's Sunday) without
  // being *equal* to `minAnchor`, and a day-level check would then read
  // "still earlier than the floor" and leave Previous clickable one period
  // too late. Comparing period starts is what correctly reads "we're
  // already showing the floor's own week/month," which is the question
  // this button actually needs answered.
  const periodStart =
    view === "month" ? startOfMonth(anchor) : startOfWeek(anchor);
  const minPeriodStart = minAnchor
    ? view === "month"
      ? startOfMonth(minAnchor)
      : startOfWeek(minAnchor)
    : null;
  const canGoBack = !minPeriodStart || periodStart > minPeriodStart;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Date on the left, nav buttons pushed to the right on mobile
            (`justify-between` + explicit `order`) — grouped together on the
            left instead, buttons first, on `sm:` and up, matching how this
            row read before the date/button split. */}
        <div className="flex items-center justify-between gap-1.5 sm:justify-start">
          <h2 className="font-bb-body order-1 text-base font-semibold tracking-tight sm:order-2 sm:ml-1">
            {rangeLabel}
          </h2>
          {view !== "agenda" && (
            <div className="order-2 flex items-center gap-1.5 sm:order-1">
              {/* `icon-sm`/`sm` (28px) is the shared Button scale used
                  site-wide — grown here per-instance with a padded tap
                  target instead of touching that shared primitive, since
                  these three sit close enough together (`gap-1.5`, 6px)
                  that a bigger visual size would start crowding them. */}
              <Button
                variant="outline"
                size="icon-sm"
                onClick={goBack}
                disabled={!canGoBack}
                aria-label="Previous"
                className="relative after:absolute after:-inset-1 after:content-['']"
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToday}
                className="relative after:absolute after:-inset-1 after:content-['']"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={goForward}
                aria-label="Next"
                className="relative after:absolute after:-inset-1 after:content-['']"
              >
                <ChevronRightIcon />
              </Button>
            </div>
          )}
        </div>

        <div
          role="group"
          aria-label="Calendar view"
          className="flex w-fit gap-0.5 self-center rounded-sm border border-border p-0.5 sm:self-start"
        >
          {VIEWS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={view === option.id}
              onClick={() => animateGrid(() => setView(option.id))}
              className={cn(
                "relative rounded-[3px] px-2.5 py-1 font-bb-sign text-[0.68rem] tracking-[0.08em] uppercase transition-colors after:absolute after:-inset-1 after:content-['']",
                // Ink, not orange — orange is reserved for the one commit action.
                view === option.id
                  ? "bg-foreground text-[var(--card)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {quickActions ? (
        <div className="flex flex-wrap items-center gap-2.5">
          {quickActions}
        </div>
      ) : null}

      <div
        style={
          gridTransitioning ? { viewTransitionName: "bb-cal-body" } : undefined
        }
      >
        {view === "week" && (
          <DashboardWeekView
            weekStart={weekStart}
            today={today}
            events={visibleEvents}
            busyIntervals={busyIntervals}
            windows={visibleWindows}
            onDayClick={goToDay}
            onQuickCreate={
              onQuickCreate
                ? (day, hour) => onQuickCreate(day, hour)
                : undefined
            }
            renderEvent={renderWeekEvent}
            minDay={minAnchor}
            sharedDayNames={gridTransitioning}
          />
        )}
        {view === "month" && (
          <DashboardMonthView
            month={anchor}
            today={today}
            events={visibleEvents}
            busyIntervals={busyIntervals}
            windows={visibleWindows}
            onDayClick={goToDay}
            onQuickCreate={
              onQuickCreate ? (day) => onQuickCreate(day, null) : undefined
            }
            renderEvent={renderMonthEvent}
            minDay={minAnchor}
            sharedDayNames={gridTransitioning}
          />
        )}
        {view === "agenda" && (
          <DashboardAgendaView
            events={visibleEvents}
            now={today}
            onDayClick={goToDay}
            renderEvent={renderAgendaEvent}
            emptyMessage={agendaEmptyMessage}
          />
        )}
      </div>
    </div>
  );
}

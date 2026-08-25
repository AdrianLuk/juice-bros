"use client";

import { useMemo, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  groupByLocalDay,
  isSameDay,
  layoutMultiDaySpans,
  localDayKey,
  monthGridDays,
  type CalendarEvent,
} from "@/lib/booking-buddy/calendar";
import {
  resolveAvailabilitySegments,
  type AvailabilitySegment,
  type AvailabilityWindow,
  type BusyInterval,
} from "@/lib/booking-buddy/availability";
import { formatTimeLabelFromMs } from "@/lib/booking-buddy/datetime";

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const VISIBLE_PER_DAY = 2;
const SPAN_DATE_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

/** "Busy: Aug 3, 9:00 AM – Aug 5, 5:00 PM" — the Week view's block always
 * builds a range label (`dashboard-week-view.tsx`); this bar previously read
 * only "Busy"/"Open" to a screen reader, with no indication of when. */
function formatSpanLabel(segment: AvailabilitySegment): string {
  const startMs = new Date(segment.startsAt).getTime();
  const endMs = new Date(segment.endsAt).getTime();
  const label = segment.type === "busy" ? "Busy" : "Open";
  return `${label}: ${SPAN_DATE_LABEL.format(startMs)}, ${formatTimeLabelFromMs(startMs)} – ${SPAN_DATE_LABEL.format(endMs)}, ${formatTimeLabelFromMs(endMs)}`;
}

/**
 * The Month grid shell (issue #23), generic over what an "event" is — see
 * `dashboard-week-view.tsx`'s own note. `renderEvent` renders one visible
 * cell entry (up to `VISIBLE_PER_DAY` per day); the overflow "+N more"
 * button and the day-grid/Availability-bar layout stay owned here.
 *
 * `minDay`, when set (the friend calendar, issue #61), disables a day
 * cell's own "go to this week" button (the day number) for any day before
 * it — see `dashboard-week-view.tsx`'s own note on why: without it, a click
 * on a past day silently lands on today's week instead, contradicting its
 * own `aria-label`.
 */
export function DashboardMonthView<T extends CalendarEvent>({
  month,
  today,
  events,
  busyIntervals,
  windows,
  onDayClick,
  renderEvent,
  minDay,
}: {
  month: Date;
  today: Date;
  events: T[];
  busyIntervals: BusyInterval[];
  windows: AvailabilityWindow[];
  onDayClick: (day: Date) => void;
  renderEvent: (event: T) => ReactNode;
  minDay?: Date | null;
}) {
  const days = useMemo(() => monthGridDays(month), [month]);
  const currentMonth = month.getMonth();

  const eventsByDay = useMemo(
    () => groupByLocalDay(events, (event) => new Date(event.startsAt)),
    [events],
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
    const segments = resolveAvailabilitySegments({
      rangeStart,
      rangeEnd,
      busyIntervals,
      windows,
    });
    return layoutMultiDaySpans(days, segments);
  }, [days, busyIntervals, windows]);

  return (
    <div className="overflow-hidden bb-card">
      {/* Shared horizontal scroller for the weekday header and the day grid
          below it, same reasoning as the Week view's — 7 evenly-divided
          columns are too cramped on a phone to show an event's time and
          detail, so each column gets a comfortable minimum width and the
          two rows scroll together as one unit. */}
      <div role="group" aria-label="Month calendar" className="overflow-x-auto">
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
            const dayEvents = (eventsByDay.get(key) ?? []).sort(
              (a, b) =>
                new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
            );
            const availabilitySpans = availabilitySpansByDay.get(key) ?? [];
            const overflow = dayEvents.length - VISIBLE_PER_DAY;
            const disabled = Boolean(minDay && day < minDay);

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
                  disabled={disabled}
                  aria-label={`Go to the week of ${day.toDateString()}`}
                  aria-current={isSameDay(day, today) ? "date" : undefined}
                  className={cn(
                    // `size-6` (24px) stays the deliberately compact visual
                    // size a 7-column phone grid needs; `after:` pads the
                    // actual tap target a further 6px per side (~36px total)
                    // without growing the circle itself. Kept tighter than
                    // the full 44px guideline on purpose — this cell also
                    // stacks an availability bar and event chips a few px
                    // below the button, and a bigger bleed would swallow taps
                    // meant for those.
                    "relative flex size-6 items-center justify-center rounded-full text-xs font-medium hover:bg-muted after:absolute after:-inset-1.5 after:content-['']",
                    day.getMonth() !== currentMonth && "text-muted-foreground",
                    isSameDay(day, today) &&
                      "bg-primary text-event-foreground hover:bg-primary/90",
                    disabled && "pointer-events-none opacity-40",
                  )}
                >
                  {day.getDate()}
                </button>

                {availabilitySpans.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    {availabilitySpans.map(
                      ({ event: segment, isStart, isEnd }) => (
                        <AvailabilitySpanBar
                          key={`${segment.type}-${segment.startsAt}`}
                          segment={segment}
                          isStart={isStart}
                          isEnd={isEnd}
                        />
                      ),
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-0.5">
                  {dayEvents
                    .slice(0, VISIBLE_PER_DAY)
                    .map((event) => renderEvent(event))}
                  {overflow > 0 && (
                    <button
                      type="button"
                      onClick={() => onDayClick(day)}
                      className="truncate rounded-sm px-1.5 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
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
      aria-label={isStart ? formatSpanLabel(segment) : undefined}
      className={cn(
        "h-4 truncate px-1 text-left text-[10px] leading-4 font-medium",
        isStart ? "rounded-l-sm" : "-ml-1 sm:-ml-1.5",
        isEnd ? "rounded-r-sm" : "-mr-1 sm:-mr-1.5",
        segment.type === "busy"
          ? "bg-muted-foreground/25 text-foreground"
          : "bg-accent/60 text-accent-foreground",
      )}
    >
      {isStart ? label : null}
    </div>
  );
}

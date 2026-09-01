"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

import { PlusIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  bookedDayHours,
  dayLabel,
  isPastDay,
  isSameDay,
  layoutDayEvents,
  localDayKey,
  weekDays,
  type CalendarEvent,
} from "@/lib/booking-buddy/calendar";
import {
  resolveAvailabilitySegments,
  type AvailabilityWindow,
  type BusyInterval,
} from "@/lib/booking-buddy/availability";
import { DashboardAvailabilityBlock } from "@/components/booking-buddy/dashboard-availability-block";
import { formatTimeLabelFromMs } from "@/lib/booking-buddy/datetime";

const HOUR_HEIGHT = 48;
const DAY_HEIGHT = HOUR_HEIGHT * 24;
// Scrolled to on mount so a typical evening booking doesn't need scrolling
// to reach — the whole 24 hours is still there above and below it.
const DEFAULT_SCROLL_HOUR = 7;

const HOUR_LABEL = new Intl.DateTimeFormat("en-US", { hour: "numeric" });
const WEEKDAY_LABEL = new Intl.DateTimeFormat("en-US", { weekday: "short" });

// Below `lg`, columns keep a comfortable minimum width and the row scrolls
// sideways (see the scroller comment below). At `lg` and up there's reliably
// enough room for 7 columns, so they shrink-to-fit instead of forcing a
// horizontal scrollbar.
const DAY_GRID_COLS =
  "grid-cols-[repeat(7,minmax(7rem,1fr))] lg:grid-cols-[repeat(7,minmax(0,1fr))]";

/**
 * Pixels from the top of a day column for an instant `dayStartMs` +
 * elapsed-ms into that day — never local `getHours()`/`getMinutes()` on the
 * instant itself, which reads midnight-next-day (a clamped span's own end)
 * as hour 0 rather than hour 24.
 */
function offsetFor(atMs: number, dayStartMs: number): number {
  return ((atMs - dayStartMs) / 60_000 / 60) * HOUR_HEIGHT;
}

/** Clips a span at the browser-local day boundary — see calendar.ts's own note on why an event is never split across two day columns. */
function clampToDay(
  startMs: number,
  endMs: number,
  dayStartMs: number,
  dayEndMs: number,
): [number, number] {
  return [Math.max(startMs, dayStartMs), Math.min(endMs, dayEndMs)];
}

/** The day-clamped start/end a laid-out event actually occupies — what a block's own time label should read, not the event's raw (possibly cross-day) instants. */
export type EventRange = { startMs: number; endMs: number };

// WEEK_EVENT_CLASS renders at `text-[13px] leading-tight` with `py-1` — one
// line needs ~25px (16.25px line + 8px padding), a second ~16px more, a
// third ~16px more. (Bumped from 11px in the white-on-orange a11y pass —
// still short of the 18.66px+bold "large text" AA threshold, which the
// HOUR_HEIGHT=48 grid can't fit even for a 30-min slot; this is as far as
// size goes without also rescaling the grid.) A chip shorter than a line
// budget's floor clips that line's text under `overflow-hidden` instead of
// showing it, so callers use this to pick how many lines of detail to
// render rather than always assuming all three fit.
export function eventChipLineBudget(heightPx: number): 1 | 2 | 3 {
  if (heightPx >= 57) return 3;
  if (heightPx >= 41) return 2;
  return 1;
}

/**
 * The Week grid shell (issue #23), generic over what an "event" is — a
 * Booking on the owner's own dashboard, a friend's busy time on the friend
 * calendar (issue #61). The grid, scroll sync, and overlap layout
 * (`layoutDayEvents`) are the reusable part; `renderEvent` is what turns a
 * laid-out event into the actual popover block, entirely owned by the
 * caller so the trigger's visual chip and the panel's detail content can
 * differ per caller without this file knowing what either looks like.
 *
 * `minDay`, when set (the friend calendar, issue #61), disables a day
 * header's own "go to this week" button for any day before it — without
 * this, clicking a visible-but-already-past day (Sunday of the week
 * "today" sits in, say) would silently no-op via `DashboardCalendar`'s own
 * navigation clamp, which reads as broken rather than as "that's as far
 * back as this goes."
 *
 * `onQuickCreate`, when set (the owner's dashboard, issue #303), puts a
 * hover-revealed `+` on every empty hour row of a non-past day — clicking
 * it opens the shared booking dialog prefilled with that cell's day and
 * floored start hour. Rows a Booking already covers, and every row of a
 * past day, get no `+`. Absent on the friend calendar.
 */
export function DashboardWeekView<T extends CalendarEvent>({
  weekStart,
  today,
  events,
  busyIntervals,
  windows,
  onDayClick,
  onQuickCreate,
  renderEvent,
  minDay,
  sharedDayNames = false,
}: {
  weekStart: Date;
  today: Date;
  events: T[];
  busyIntervals: BusyInterval[];
  windows: AvailabilityWindow[];
  onDayClick: (day: Date) => void;
  onQuickCreate?: (day: Date, hour: number) => void;
  renderEvent: (event: T, style: CSSProperties, range: EventRange) => ReactNode;
  minDay?: Date | null;
  /** During a Week/Month switch, the day-number cells carry a
   * `bb-cal-day-<iso>` `view-transition-name` so the ones this view shares
   * with the Month grid travel to their new spot instead of cross-fading —
   * see `dashboard-calendar.tsx`. */
  sharedDayNames?: boolean;
}) {
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const todayColumnRef = useRef<HTMLDivElement>(null);
  // The body always has a vertical scrollbar (24h of content never fits
  // `max-h-136`); the header never does. Left unaccounted for, the
  // scrollbar's own width narrows the body's day columns relative to the
  // header's, so the two grids drift out of alignment — worse on Windows'
  // ~17px scrollbar than macOS's overlay one, but present either way. This
  // reserves matching space in the header rather than depending on any one
  // platform's scrollbar width.
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const measure = () =>
      setScrollbarWidth(body.offsetWidth - body.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: DEFAULT_SCROLL_HOUR * HOUR_HEIGHT });
  }, [weekStart]);

  // Below `lg` the day columns keep a minimum width wider than a phone
  // screen (see `DAY_GRID_COLS`), so only the first few days are visible
  // without scrolling sideways — on a Thursday that leaves "today" off
  // screen. When the visible week contains today, center its column in the
  // scroller on mount/week change; no-ops at `lg`+ where columns shrink to
  // fit and nothing overflows, and no-ops on other weeks where today's
  // column doesn't exist.
  useEffect(() => {
    const body = bodyRef.current;
    const column = todayColumnRef.current;
    if (!body || !column) return;
    if (body.scrollWidth <= body.clientWidth) return;

    const bodyRect = body.getBoundingClientRect();
    const columnRect = column.getBoundingClientRect();
    const columnLeft = columnRect.left - bodyRect.left + body.scrollLeft;
    const target = columnLeft + columnRect.width / 2 - body.clientWidth / 2;
    const max = body.scrollWidth - body.clientWidth;
    body.scrollLeft = Math.max(0, Math.min(target, max));
  }, [weekStart]);

  /**
   * The header (day names) has no vertical scroll of its own — only the body
   * below does, since the header row has to stay put while hours scroll. So
   * the body is the *one* real two-axis scroll surface (a drag anywhere in
   * the grid moves both), and the header passively mirrors its horizontal
   * position; `overflow-hidden` still accepts a programmatic `scrollLeft`,
   * it just never shows its own scrollbar or takes a drag directly.
   */
  const syncHeaderScroll = useCallback(() => {
    if (headerRef.current && bodyRef.current) {
      headerRef.current.scrollLeft = bodyRef.current.scrollLeft;
    }
  }, []);

  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, hour) => hour),
    [],
  );

  return (
    <div className="overflow-hidden bb-card">
      <div className="flex border-b border-border bg-card">
        <div className="w-12 shrink-0 sm:w-14" />
        <div ref={headerRef} className="flex-1 overflow-hidden">
          <div className={cn("grid", DAY_GRID_COLS)}>
            {days.map((day) => {
              const disabled = Boolean(minDay && day < minDay);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => onDayClick(day)}
                  disabled={disabled}
                  aria-label={`Go to the week of ${day.toDateString()}`}
                  aria-current={isSameDay(day, today) ? "date" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-1 border-l border-border py-2 first:border-l-0 hover:bg-muted",
                    disabled && "pointer-events-none opacity-40",
                  )}
                >
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {WEEKDAY_LABEL.format(day)}
                  </span>
                  <span
                    style={
                      sharedDayNames
                        ? { viewTransitionName: `bb-cal-day-${localDayKey(day)}` }
                        : undefined
                    }
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-sm font-medium",
                      isSameDay(day, today) &&
                        "bg-primary text-primary-foreground",
                    )}
                  >
                    {day.getDate()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div
          aria-hidden
          style={{ width: scrollbarWidth }}
          className="shrink-0"
        />
      </div>

      {/* The one real scroller, both axes — cramped otherwise on a narrow
          phone: 7 columns divided evenly across ~340px leaves no room for a
          booking's time and court label, so each column keeps a comfortable
          minimum width and the row scrolls sideways to reach the rest. */}
      <div
        ref={bodyRef}
        onScroll={syncHeaderScroll}
        role="group"
        aria-label="Week calendar"
        className="bb-scroll-x max-h-136 overflow-auto"
      >
        {/* `w-fit` is load-bearing: a plain `flex` block child sizes to its
            *container's* width (the scroller's visible width) and lets its
            items merely overflow it — which is fine for scrolling, but
            leaves the sticky gutter's containing block too narrow to mean
            anything, so it "sticks" to a box that isn't the real scrolled
            content. `w-fit` makes this row size to its own content (the
            gutter plus all 7 day columns), matching what's actually
            scrolling and giving `sticky left-0` a coherent edge to pin to.
            At `lg` and up the day columns shrink-to-fit instead of holding a
            minimum width, so there's nothing to overflow — `lg:w-full` lets
            the row (and its `flex-1` grid) claim the scroller's actual width
            rather than collapsing to the gutter's own zero-width content. */}
        <div className="flex w-fit lg:w-full">
          <div className="sticky left-0 z-10 w-12 shrink-0 bg-background sm:w-14">
            {hours.map((hour) => (
              <div
                key={hour}
                className="relative"
                style={{ height: HOUR_HEIGHT }}
              >
                {hour > 0 && (
                  <span className="absolute -top-2 right-1.5 text-[10px] text-muted-foreground">
                    {HOUR_LABEL.format(new Date(2000, 0, 1, hour))}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className={cn("grid flex-1", DAY_GRID_COLS)}>
            {days.map((day) => (
              <DayColumn
                key={day.toISOString()}
                day={day}
                hours={hours}
                events={events}
                busyIntervals={busyIntervals}
                windows={windows}
                renderEvent={renderEvent}
                onQuickCreate={
                  onQuickCreate && !isPastDay(day, today)
                    ? onQuickCreate
                    : undefined
                }
                columnRef={isSameDay(day, today) ? todayColumnRef : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayColumn<T extends CalendarEvent>({
  day,
  hours,
  events,
  busyIntervals,
  windows,
  renderEvent,
  onQuickCreate,
  columnRef,
}: {
  day: Date;
  hours: number[];
  events: T[];
  busyIntervals: BusyInterval[];
  windows: AvailabilityWindow[];
  renderEvent: (event: T, style: CSSProperties, range: EventRange) => ReactNode;
  /** Set only for a non-past day on the owner's dashboard (issue #303) — an empty hour row then reveals a `+` that calls this with the day and that row's hour. */
  onQuickCreate?: (day: Date, hour: number) => void;
  columnRef?: RefObject<HTMLDivElement | null>;
}) {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const dayStartMs = dayStart.getTime();
  const dayEndMs = dayEnd.getTime();

  const dayEvents = events.filter((event) => {
    const start = new Date(event.startsAt).getTime();
    const end = new Date(event.endsAt).getTime();
    return start < dayEndMs && end > dayStartMs;
  });

  const laidOut = layoutDayEvents(dayEvents);

  // Hour rows a Booking already fills get no `+` — the quick-create affordance
  // is only for the genuinely empty ones (issue #303).
  const bookedHours = onQuickCreate ? bookedDayHours(dayEvents, day) : null;

  const segments = resolveAvailabilitySegments({
    rangeStart: dayStart,
    rangeEnd: dayEnd,
    busyIntervals,
    windows,
  });

  return (
    <div
      ref={columnRef}
      className="relative border-l border-border first:border-l-0"
      style={{ height: DAY_HEIGHT }}
    >
      {hours.map((hour) => (
        <div
          key={hour}
          className="absolute inset-x-0 border-b border-border/50"
          style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}
        />
      ))}

      {/* One `+` per empty hour row of a non-past day (issue #303), rendered
          under the Availability blocks and event chips below so those keep
          their own hover/tooltip and click behaviour untouched — the `+` is
          only ever reached on a row with neither. Each button spans exactly
          one hour row, so its `hour` is already the floored start hour
          `hourFromOffset` would compute for a free click. */}
      {onQuickCreate &&
        hours.map((hour) =>
          bookedHours?.has(hour) ? null : (
            <button
              key={`quick-add-${hour}`}
              type="button"
              onClick={() => onQuickCreate(day, hour)}
              aria-label={`Log a booking on ${dayLabel(day)} at ${HOUR_LABEL.format(new Date(2000, 0, 1, hour))}`}
              className="bb-week-quick-add absolute inset-x-0 flex items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
              style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}
            >
              <span
                aria-hidden
                className="bb-week-quick-add-mark flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm ring-1 ring-border"
              >
                <PlusIcon className="size-3.5" />
              </span>
            </button>
          ),
        )}

      {segments.map((segment) => {
        const [start, end] = clampToDay(
          new Date(segment.startsAt).getTime(),
          new Date(segment.endsAt).getTime(),
          dayStartMs,
          dayEndMs,
        );
        const top = offsetFor(start, dayStartMs);
        return (
          <DashboardAvailabilityBlock
            key={`${segment.type}-${segment.startsAt}`}
            type={segment.type}
            label={`${segment.type === "looking" ? "Looking to play" : "Busy"}: ${formatTimeLabelFromMs(start)} – ${formatTimeLabelFromMs(end)}`}
            className="absolute inset-x-0.5"
            style={{
              top,
              height: Math.max(offsetFor(end, dayStartMs) - top, 4),
            }}
          />
        );
      })}

      {laidOut.map(({ event, column, columns }) => {
        const [start, end] = clampToDay(
          new Date(event.startsAt).getTime(),
          new Date(event.endsAt).getTime(),
          dayStartMs,
          dayEndMs,
        );
        const top = offsetFor(start, dayStartMs);
        const width = 100 / columns;

        return renderEvent(
          event,
          {
            top,
            // 22px, not 44px: this is a fixed-height time-grid, and a floor
            // near the full touch-target guideline would make short bookings
            // visually read as much longer than they are. 22px is the
            // shortest a single truncated line (`eventChipLineBudget`) can
            // render without clipping, and still a real improvement on the
            // previous 18px floor.
            height: Math.max(offsetFor(end, dayStartMs) - top, 22),
            left: `calc(${column * width}% + 2px)`,
            width: `calc(${width}% - 4px)`,
          },
          { startMs: start, endMs: end },
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  personLabel,
  personOptionLabel,
} from "@/lib/booking-buddy/connections";
import {
  AVAILABILITY_PATH,
  FRIENDS_PATH,
  proposeGameHref,
} from "@/lib/booking-buddy/routes";
import {
  addDays,
  addMonths,
  dayLabel,
  localDayKey,
  startOfDay,
} from "@/lib/booking-buddy/calendar";
import { formatTimeLabelFromMs } from "@/lib/booking-buddy/datetime";
import { resolveCommonOpenSegments } from "@/lib/booking-buddy/availability";
import {
  getFriendAvailability,
  type OverlapFriend,
} from "@/lib/booking-buddy/actions/overlap";
import type {
  AvailabilityWindow,
  BusyInterval,
} from "@/lib/booking-buddy/availability";

/**
 * "Find a time" (issue #195): pick a set of friends, pick a range, and see the
 * days/times you're *all* free — where free means nobody has a court booked
 * and nobody has marked that stretch busy (`resolveCommonOpenSegments`, which
 * treats "unspecified" as free). Each free day deep-links into the Games form,
 * prefilled with the date and a start time.
 *
 * Only friends who currently grant the viewer `open_time` Visibility reach
 * here (`getOverlapPageData` filters them) — the same gate the one-friend
 * calendar uses. This view never widens what a friend exposes.
 *
 * On TanStack Query per CLAUDE.md's interactive-route trigger: the friends'
 * availability re-fetches as the selection changes, while the viewer's own
 * data and the range are local state.
 */

// The result list only shows free time inside civilised playing hours — a
// fully-unconstrained day would otherwise render as "12:00 AM – 11:59 PM".
// The intersection math itself stays full-day; this is display-only.
const DAY_OPEN_HOUR = 7;
const DAY_CLOSE_HOUR = 23;

type RangeChoice = "week" | "month";

type DayBlock = {
  startMs: number;
  endMs: number;
  /** The whole displayable daytime window is free — render as "Any time". */
  anyTime: boolean;
};

type FreeDay = {
  dateKey: string;
  dayStartMs: number;
  blocks: DayBlock[];
};

/** `date` rounded forward to the next whole hour (unchanged if already on one). */
function ceilToHour(date: Date): Date {
  const result = new Date(date);
  if (
    result.getMinutes() === 0 &&
    result.getSeconds() === 0 &&
    result.getMilliseconds() === 0
  ) {
    return result;
  }
  result.setHours(result.getHours() + 1, 0, 0, 0);
  return result;
}

/**
 * The range starts at the next whole hour from *now*, not local midnight — so
 * hours already gone today aren't offered as free and a "Propose a game" link
 * for today can't seed a start time in the past. The end is anchored to
 * midnight so "week"/"month" cover whole calendar days forward.
 */
function rangeFor(choice: RangeChoice, now: Date): { start: Date; end: Date } {
  const anchor = startOfDay(now);
  return {
    start: ceilToHour(now),
    end: choice === "week" ? addDays(anchor, 7) : addMonths(anchor, 1),
  };
}

/**
 * Splits the common-free segments into per-local-day blocks, each clipped to
 * daytime hours, dropping days left with nothing showable.
 */
function groupFreeByDay(
  segments: { startsAt: string; endsAt: string }[],
): FreeDay[] {
  const byDay = new Map<string, { dayStartMs: number; blocks: DayBlock[] }>();

  for (const segment of segments) {
    let cursorMs = new Date(segment.startsAt).getTime();
    const segmentEndMs = new Date(segment.endsAt).getTime();

    while (cursorMs < segmentEndMs) {
      const dayStart = startOfDay(new Date(cursorMs));
      const nextDayMs = addDays(dayStart, 1).getTime();
      const pieceEndMs = Math.min(segmentEndMs, nextDayMs);

      const dayOpen = new Date(dayStart);
      dayOpen.setHours(DAY_OPEN_HOUR, 0, 0, 0);
      const dayClose = new Date(dayStart);
      dayClose.setHours(DAY_CLOSE_HOUR, 0, 0, 0);

      const blockStartMs = Math.max(cursorMs, dayOpen.getTime());
      const blockEndMs = Math.min(pieceEndMs, dayClose.getTime());

      if (blockEndMs > blockStartMs) {
        const key = localDayKey(dayStart);
        const day = byDay.get(key) ?? {
          dayStartMs: dayStart.getTime(),
          blocks: [],
        };
        day.blocks.push({
          startMs: blockStartMs,
          endMs: blockEndMs,
          anyTime:
            blockStartMs <= dayOpen.getTime() &&
            blockEndMs >= dayClose.getTime(),
        });
        byDay.set(key, day);
      }

      cursorMs = pieceEndMs;
    }
  }

  return [...byDay.entries()]
    .map(([dateKey, { dayStartMs, blocks }]) => ({
      dateKey,
      dayStartMs,
      blocks,
    }))
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

/** The hour a Game would start, as an on-the-hour `"HH:00"` — the block's start, rounded up if it isn't already on the hour. `null` if that lands past the last bookable hour. */
function proposedStartTime(block: DayBlock): string | null {
  const start = new Date(block.startMs);
  const hour =
    start.getMinutes() === 0 ? start.getHours() : start.getHours() + 1;
  if (hour > 23) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * The hour a game would end, as an on-the-hour `"HH:00"` — the block's end
 * floored to the hour, so it never runs past the free window. `null` unless
 * that leaves a sensible single-game length (1–3 hours) from the start, in
 * which case the form keeps its own default duration. Blocks are already
 * clipped to a single local day, so this never wraps past midnight.
 */
function proposedEndTime(
  block: DayBlock,
  startTime: string | null,
): string | null {
  if (!startTime) {
    return null;
  }
  const endHour = new Date(block.endMs).getHours();
  const hours = endHour - Number(startTime.slice(0, 2));
  if (hours < 1 || hours > 3) {
    return null;
  }
  return `${String(endHour).padStart(2, "0")}:00`;
}

/** Deep-links the Games form to one specific free window — a day split by a midday busy stretch gets a link per window, each seeding its own start (and, for a short window, a matching duration). */
function proposeHref(dateKey: string, block: DayBlock): string {
  const startTime = proposedStartTime(block);
  return proposeGameHref({
    date: dateKey,
    startTime,
    endTime: proposedEndTime(block, startTime),
  });
}

function blockLabel(block: DayBlock): string {
  if (block.anyTime) {
    return "Any time";
  }
  return `${formatTimeLabelFromMs(block.startMs)} – ${formatTimeLabelFromMs(block.endMs)}`;
}

type LookingSpan = { name: string; startMs: number; endMs: number };

/** The picked friends who have marked a "Looking to play" window overlapping `block`. */
function lookersForBlock(spans: LookingSpan[], block: DayBlock): string[] {
  const names = spans
    .filter((span) => span.startMs < block.endMs && span.endMs > block.startMs)
    .map((span) => span.name);
  return [...new Set(names)];
}

/** "Ben is looking to play" / "Ben and Dana are…" / "Ben, Dana and 2 others are…" */
function lookersLine(names: string[]): string {
  const verb = names.length === 1 ? "is" : "are";
  let subject: string;
  if (names.length === 1) {
    subject = names[0];
  } else if (names.length === 2) {
    subject = `${names[0]} and ${names[1]}`;
  } else if (names.length === 3) {
    subject = `${names[0]}, ${names[1]} and ${names[2]}`;
  } else {
    subject = `${names[0]}, ${names[1]} and ${names.length - 2} others`;
  }
  return `${subject} ${verb} looking to play`;
}

const RANGE_OPTIONS: { id: RangeChoice; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

export function GroupOverlapFinder({
  friends,
  viewerBusy,
  viewerWindows,
}: {
  friends: OverlapFriend[];
  viewerBusy: BusyInterval[];
  viewerWindows: AvailabilityWindow[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rangeChoice, setRangeChoice] = useState<RangeChoice>("week");

  // "Today" resolved client-side, in an effect — the same SSR/hydration dodge
  // `DashboardCalendar` uses, since every date helper here is browser-local.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot clock read on mount
    setNow(new Date());
  }, []);

  const selectedIds = useMemo(
    () => [...selected].sort((a, b) => a.localeCompare(b)),
    [selected],
  );

  const friendQuery = useQuery({
    queryKey: ["booking-buddy", "overlap", selectedIds],
    queryFn: () => getFriendAvailability(selectedIds),
    enabled: selectedIds.length > 0,
  });

  const range = useMemo(
    () => (now ? rangeFor(rangeChoice, now) : null),
    [now, rangeChoice],
  );

  const people = useMemo(() => {
    const viewer = { busyIntervals: viewerBusy, windows: viewerWindows };
    const friendPeople = (friendQuery.data ?? []).map((entry) => ({
      busyIntervals: entry.busyIntervals,
      windows: entry.windows,
    }));
    return [viewer, ...friendPeople];
  }, [viewerBusy, viewerWindows, friendQuery.data]);

  // `getFriendAvailability` drops any id the viewer no longer has `open_time`
  // into — so an empty result for a non-empty selection means none of the
  // picked friends are visible any more, and an "overlap" computed from the
  // viewer alone would be a lie.
  const visibleFriendCount = friendQuery.data?.length ?? 0;
  const noneVisible =
    selectedIds.length > 0 && friendQuery.isSuccess && visibleFriendCount === 0;
  const missingCount =
    friendQuery.data && visibleFriendCount < selectedIds.length
      ? selectedIds.length - visibleFriendCount
      : 0;

  const freeDays = useMemo(() => {
    if (
      !range ||
      selectedIds.length === 0 ||
      !friendQuery.data ||
      visibleFriendCount === 0
    ) {
      return [];
    }
    return groupFreeByDay(
      resolveCommonOpenSegments({
        rangeStart: range.start,
        rangeEnd: range.end,
        people,
      }),
    );
  }, [range, people, friendQuery.data, selectedIds.length, visibleFriendCount]);

  // Which picked friends have a "Looking to play" window open over each free
  // block (#230) — surfaced as a nudge under the block, without changing which
  // blocks are shown (that stays the pure not-busy intersection).
  const lookingSpans = useMemo<LookingSpan[]>(() => {
    const nameById = new Map(
      friends.map((friend) => [friend.userId, personLabel(friend)]),
    );
    return (friendQuery.data ?? []).flatMap((entry) =>
      entry.windows
        .filter((window) => window.type === "looking")
        .map((window) => ({
          name: nameById.get(entry.userId) ?? "A friend",
          startMs: new Date(window.startsAt).getTime(),
          endMs: new Date(window.endsAt).getTime(),
        })),
    );
  }, [friends, friendQuery.data]);

  function toggle(userId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  if (friends.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-4 text-sm text-muted-foreground">
        Nobody to compare with yet. This fills up once a friend gives you{" "}
        <Link href={FRIENDS_PATH} className="underline underline-offset-4">
          availability visibility
        </Link>{" "}
        into their calendar.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      <section>
        <h2 className="bb-h text-[1.05rem]">Who are you playing with?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick everyone who needs to be there. Only friends who share their
          availability with you show up here.
        </p>

        <ul className="mt-4 divide-y divide-border/60 overflow-hidden bb-card">
          {friends.map((friend) => {
            const checked = selected.has(friend.userId);
            return (
              <li key={friend.userId}>
                <label className="flex cursor-pointer items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/60">
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-brand-orange"
                    checked={checked}
                    onChange={() => toggle(friend.userId)}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {personOptionLabel(friend)}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="bb-h text-[1.05rem]">When you&apos;re all free</h2>
          <div
            role="group"
            aria-label="Range"
            className="flex w-fit gap-0.5 rounded-lg border border-border p-0.5"
          >
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={rangeChoice === option.id}
                onClick={() => setRangeChoice(option.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  rangeChoice === option.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Time nobody&apos;s booked and nobody&apos;s marked busy, from today.
          Blocking off busy stretches on{" "}
          <Link
            href={AVAILABILITY_PATH}
            className="underline underline-offset-4"
          >
            Availability
          </Link>{" "}
          makes this sharper.
        </p>

        <div className="mt-4">
          {!now ? (
            <div className="h-24 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
          ) : selectedIds.length === 0 ? (
            <p className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-4 text-sm text-muted-foreground">
              Pick one or more friends above to see when you&apos;re all free.
            </p>
          ) : friendQuery.isPending ? (
            <p className="text-sm text-muted-foreground">
              Working out the overlap…
            </p>
          ) : friendQuery.isError ? (
            <p className="text-sm text-destructive">
              Couldn&apos;t read your friends&apos; availability. Try again in a
              moment.
            </p>
          ) : noneVisible ? (
            <p className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-4 text-sm text-muted-foreground">
              {selectedIds.length === 1
                ? "That friend no longer shares their availability with you."
                : "None of the friends you picked share their availability with you any more."}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {missingCount > 0 && (
                <p className="rounded-lg border border-accent-foreground/25 bg-accent/25 px-4 py-3 text-sm">
                  {missingCount === 1
                    ? "One friend no longer shares their availability with you, so they're not in this result."
                    : `${missingCount} friends no longer share their availability with you, so they're not in this result.`}
                </p>
              )}

              {freeDays.length === 0 ? (
                <p className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-4 text-sm text-muted-foreground">
                  No shared free time in this range. Try Month, or check
                  who&apos;s marked themselves busy.
                </p>
              ) : (
                <ul className="divide-y divide-border/60 overflow-hidden bb-card">
                  {freeDays.map((day) => (
                    <li key={day.dateKey} className="px-5 py-4">
                      <p className="font-medium">
                        {dayLabel(new Date(day.dayStartMs))}
                      </p>
                      {/* One row per free window: a day split by a midday busy
                          stretch shows a morning window and an evening one,
                          each with its own "Propose a game" seeding that
                          window's start time. */}
                      <ul className="mt-1.5 flex flex-col gap-1.5">
                        {day.blocks.map((block) => {
                          const lookers = lookersForBlock(lookingSpans, block);
                          return (
                            <li
                              key={block.startMs}
                              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5"
                            >
                              <span className="min-w-0">
                                <span className="text-sm text-muted-foreground">
                                  {blockLabel(block)}
                                </span>
                                {lookers.length > 0 && (
                                  <span className="mt-0.5 block text-xs font-medium text-primary">
                                    {lookersLine(lookers)}
                                  </span>
                                )}
                              </span>
                              <Link
                                href={proposeHref(day.dateKey, block)}
                                className={cn(
                                  buttonVariants({
                                    variant: "outline",
                                    size: "sm",
                                  }),
                                  "shrink-0",
                                )}
                              >
                                Propose a game
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

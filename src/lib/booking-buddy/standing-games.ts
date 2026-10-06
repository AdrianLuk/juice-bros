/**
 * Pure logic for Standing Games (CONTEXT.md, ADR 0023): which weeks are due to
 * post, how a Standing Game's form is read, and how its day and time are
 * written back. A Standing Game is the organizer's template; every week it
 * posts is a plain Slot, so nothing here is ever consulted by code that reads
 * Slots.
 *
 * Free of Next.js and Supabase imports on purpose, and relative imports only,
 * so `node --test` can load it: the cron route and the server actions do the
 * reads and writes, this module decides.
 */

import { clockInZone, formatTimeLabel, isHourTime, todayInZone } from "./datetime.ts";
import { parseDivision, type Division } from "./division.ts";
import { MAX_ROTATION_BUFFER } from "./capacity.ts";
import {
  DEFAULT_REMINDER_OFFSET_MINUTES,
  MAX_REMINDER_OFFSET_MINUTES,
  MIN_REMINDER_OFFSET_MINUTES,
} from "./reminders.ts";
import { parseSlotNotes } from "./slots.ts";

/** A week is posted this many days ahead at the least (ADR 0023). */
export const MIN_POSTING_LEAD_DAYS = 7;

/** What the posting planner needs to know about one Standing Game. */
export type StandingGameSchedule = {
  id: string;
  /** 0 = Sunday … 6 = Saturday, the same numbering as `Date#getUTCDay` and Postgres `extract(dow …)`. */
  weekday: number;
  /** Start hour, 0–23, on the wall clock of `timeZone`. */
  startHour: number;
  timeZone: string;
  /** Set once the organizer ends it. An ended Standing Game never posts again. */
  endedAt: string | null;
  /** The Intended Org's Booking Window lead in days, or `null` when there is no Intended Org or it has no window. */
  bookingWindowDaysBefore: number | null;
};

/** `date` shifted by whole calendar days. UTC-based, since this is date-only arithmetic, not an instant. */
function shiftDate(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

/** The weekday (0 = Sunday) a `YYYY-MM-DD` calendar date falls on. */
export function weekdayOfDate(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/**
 * How many calendar days ahead a Standing Game posts its weeks: a week, or
 * the Booking Window lead plus one day when that is longer, so a week's Slot
 * is always on the board at least a day before its court can be booked and
 * the Booking Reminder has something to fire for.
 */
export function postingLeadDays(bookingWindowDaysBefore: number | null): number {
  if (bookingWindowDaysBefore === null) {
    return MIN_POSTING_LEAD_DAYS;
  }
  return Math.max(MIN_POSTING_LEAD_DAYS, bookingWindowDaysBefore + 1);
}

/**
 * Every game date (`YYYY-MM-DD`, the Standing Game's own zone) that should be
 * posted now and hasn't been, soonest first.
 *
 * Reasoned in calendar days on the Standing Game's own wall clock rather than
 * in instants, so a daylight saving change can't move a week in or out of
 * range: today's date in the zone, then each later date up to the posting
 * lead. Today's own game counts only while its start hour is still ahead.
 * `alreadyPosted` is every date this Standing Game has a week recorded for
 * (`standing_game_weeks`), posted or skipped; the unique constraint on that
 * table is what actually stops a duplicate, this only avoids asking.
 */
export function dueStandingGameWeeks(
  game: StandingGameSchedule,
  alreadyPosted: ReadonlySet<string>,
  now: Date,
): string[] {
  if (game.endedAt !== null) {
    return [];
  }

  const today = todayInZone(game.timeZone, now);
  const startClock = hourClock(game.startHour);
  const due: string[] = [];

  for (let offset = 0; offset <= postingLeadDays(game.bookingWindowDaysBefore); offset += 1) {
    const date = shiftDate(today, offset);
    if (weekdayOfDate(date) !== game.weekday) {
      continue;
    }
    if (offset === 0 && clockInZone(game.timeZone, now) >= startClock) {
      continue;
    }
    if (!alreadyPosted.has(date)) {
      due.push(date);
    }
  }

  return due;
}

export type StandingGamePost = { standingGameId: string; gameDate: string };

export type PlanStandingGamePostingRunInput = {
  /** Every Standing Game the route read, live or ended. */
  games: readonly StandingGameSchedule[];
  /** Per Standing Game, every date already recorded in `standing_game_weeks`. A missing entry means none. */
  postedDatesByGame: ReadonlyMap<string, ReadonlySet<string>>;
  now: Date;
};

/**
 * Every week the daily cron should post this run, the decision half of the
 * `post-standing-game-weeks` route (the same split `planAttendeeReminderRun`
 * makes for Reminders). The route posts each one through
 * `post_standing_game_week`, whose unique constraint makes a rerun or a race
 * with the creation action harmless.
 */
export function planStandingGamePostingRun(input: PlanStandingGamePostingRunInput): {
  posts: StandingGamePost[];
  checked: number;
} {
  const posts: StandingGamePost[] = [];
  for (const game of input.games) {
    const posted = input.postedDatesByGame.get(game.id) ?? new Set<string>();
    for (const gameDate of dueStandingGameWeeks(game, posted, input.now)) {
      posts.push({ standingGameId: game.id, gameDate });
    }
  }
  return { posts, checked: input.games.length };
}

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** `2` → `"Every Tuesday"`: the chip on a posted game, and the Weekly games row's day. */
export function everyWeekdayLabel(weekday: number): string {
  return `Every ${WEEKDAY_NAMES[weekday] ?? "week"}`;
}

/** `"20:00"`-style clock for a 0–23 hour. */
export function hourClock(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** A Standing Game's hours as the rest of the app writes a time range. An end at or before the start is the next day, as for any game. */
export function standingGameTimeLabel(game: { startHour: number; endHour: number }): string {
  return `${formatTimeLabel(hourClock(game.startHour))} – ${formatTimeLabel(hourClock(game.endHour))}`;
}

/**
 * The chip a Standing Game's posted Slot carries, read off the Slot alone:
 * friends can't read `standing_games`, and don't need to, since a posted
 * Slot's own date already falls on the day it repeats. The weekday is the
 * Slot's own zone's, so an 11pm game is still on its Tuesday.
 */
export function slotRepeatsLabel(slot: { proposedStart: string; timeZone: string }): string {
  return everyWeekdayLabel(weekdayOfDate(todayInZone(slot.timeZone, new Date(slot.proposedStart))));
}

/** Everything a Standing Game holds that the organizer sets, as read off its form. The time zone is not here: the action takes it from the Intended Org. */
export type StandingGameFields = {
  weekday: number;
  startHour: number;
  endHour: number;
  division: Division;
  orgId: string | null;
  notes: string | null;
  rotationBuffer: number;
  reminderOffsetMinutes: number;
};

/**
 * Reads a Standing Game off either form that writes one: the Post a game form
 * with "Repeats weekly" ticked (which has no rotation buffer or reminder
 * fields, so those take a Slot's own defaults) and the Standing Game page's
 * edit form (which has both). The limits are the `standing_games`
 * migration's, which mirror `slots`.
 */
export function parseStandingGameForm(formData: FormData): StandingGameFields | { error: string } {
  const rawWeekday = String(formData.get("weekday") ?? "").trim();
  const weekday = Number(rawWeekday);
  if (rawWeekday === "" || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return { error: "Pick the day this game repeats on." };
  }

  const startTime = String(formData.get("start_time") ?? "").trim();
  const endTime = String(formData.get("end_time") ?? "").trim();
  if (!isHourTime(startTime) || !isHourTime(endTime)) {
    return { error: "Pick a start and end time." };
  }
  // An end at or before the start runs past midnight, as for any game. Only a
  // zero-length range is refused.
  if (startTime === endTime) {
    return { error: "The end time can't be the same as the start time." };
  }

  const notesResult = parseSlotNotes(String(formData.get("notes") ?? ""));
  if ("error" in notesResult) {
    return notesResult;
  }

  const rawBuffer = String(formData.get("rotation_buffer") ?? "").trim();
  const rotationBuffer = rawBuffer === "" ? 0 : Number(rawBuffer);
  if (!Number.isInteger(rotationBuffer) || rotationBuffer < 0 || rotationBuffer > MAX_ROTATION_BUFFER) {
    return { error: `A rotation buffer is a whole number of extra players, ${MAX_ROTATION_BUFFER} at most.` };
  }

  const rawOffset = String(formData.get("reminder_offset_minutes") ?? "").trim();
  const reminderOffsetMinutes = rawOffset === "" ? DEFAULT_REMINDER_OFFSET_MINUTES : Number(rawOffset);
  if (
    !Number.isInteger(reminderOffsetMinutes) ||
    reminderOffsetMinutes < MIN_REMINDER_OFFSET_MINUTES ||
    reminderOffsetMinutes > MAX_REMINDER_OFFSET_MINUTES
  ) {
    return { error: "Pick when the reminder goes out." };
  }

  return {
    weekday,
    startHour: Number(startTime.slice(0, 2)),
    endHour: Number(endTime.slice(0, 2)),
    division: parseDivision(String(formData.get("division") ?? "")),
    orgId: String(formData.get("org_id") ?? "").trim() || null,
    notes: notesResult.notes,
    rotationBuffer,
    reminderOffsetMinutes,
  };
}

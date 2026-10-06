/**
 * Pure logic for skipping a Standing Game's week (issue #578, CONTEXT.md,
 * ADR 0023): which dates are still to come, which can be skipped ahead of
 * time, which week is really next, and who hears that a posted week is off.
 *
 * A skipped week is a `standing_game_weeks` row like a posted one, so the
 * posting planner (`dueStandingGameWeeks`) already treats it as done and never
 * posts it. Nothing here needs to change that; this module only reasons about
 * dates for the Standing Game page and the Weekly games row.
 *
 * Relative imports only, so `node --test` can load it.
 */

import { clockInZone, isRealDate, todayInZone } from "./datetime.ts";
import type { ResponseAnswer } from "./responses.ts";
import { hourClock, weekdayOfDate, type StandingGameSchedule } from "./standing-games.ts";

type GameDay = Pick<StandingGameSchedule, "weekday" | "startHour" | "timeZone">;

function shiftDate(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

/**
 * Whether `date` is one of this game's weeks that hasn't started yet: on its
 * weekday, and later than today on its own wall clock, or today before its
 * start hour.
 */
export function isUpcomingGameDate(game: GameDay, date: string, now: Date): boolean {
  if (!isRealDate(date) || weekdayOfDate(date) !== game.weekday) {
    return false;
  }
  const today = todayInZone(game.timeZone, now);
  if (date !== today) {
    return date > today;
  }
  return clockInZone(game.timeZone, now) < hourClock(game.startHour);
}

/** The next `count` game dates (`YYYY-MM-DD`, the game's own zone), soonest first, posted or not. */
export function upcomingGameDates(game: GameDay, now: Date, count: number): string[] {
  const today = todayInZone(game.timeZone, now);
  let first = shiftDate(today, (game.weekday - weekdayOfDate(today) + 7) % 7);
  if (!isUpcomingGameDate(game, first, now)) {
    first = shiftDate(first, 7);
  }
  return Array.from({ length: count }, (_, index) => shiftDate(first, index * 7));
}

/**
 * The dates the Standing Game page offers to skip ahead of time: upcoming
 * weeks with nothing recorded yet. A posted week is skipped from its own
 * game page instead, and a skipped one is already in the skipped list.
 */
export function skippableGameDates(
  game: GameDay,
  recordedDates: ReadonlySet<string>,
  now: Date,
  count: number,
): string[] {
  return upcomingGameDates(game, now, count + recordedDates.size)
    .filter((date) => !recordedDates.has(date))
    .slice(0, count);
}

/** How far ahead `nextGameDate` looks before giving up: two years of weeks. */
const NEXT_GAME_HORIZON_WEEKS = 104;

/**
 * The next week that will actually be played: the first upcoming date not in
 * `skippedDates`. The Weekly games row shows it when that week isn't posted
 * yet. `null` for an ended Standing Game.
 */
export function nextGameDate(
  game: GameDay & Pick<StandingGameSchedule, "endedAt">,
  skippedDates: ReadonlySet<string>,
  now: Date,
): string | null {
  if (game.endedAt !== null) {
    return null;
  }
  return (
    upcomingGameDates(game, now, NEXT_GAME_HORIZON_WEEKS).find((date) => !skippedDates.has(date)) ??
    null
  );
}

export type GameOffResponder = { userId: string | null; answer: ResponseAnswer };

/**
 * Who hears that a skipped week is off: every User who answered yes or maybe,
 * once each. Not "no" answerers, not Guests (no address), and not the
 * organizer, who is the one skipping. Nobody at all once the game has
 * started: there is nothing left to call off.
 */
export function gameOffRecipients(
  responses: readonly GameOffResponder[],
  ownerId: string,
  options: { started?: boolean } = {},
): string[] {
  if (options.started) {
    return [];
  }
  const recipients = new Set<string>();
  for (const response of responses) {
    if (response.userId !== null && response.userId !== ownerId && response.answer !== "no") {
      recipients.add(response.userId);
    }
  }
  return [...recipients];
}

/** The line in the skip confirm that says who will be told. */
export function skipWeekNotice(recipientCount: number, options: { started?: boolean } = {}): string {
  if (options.started) {
    return "This game has already started, so nobody gets an email.";
  }
  if (recipientCount === 0) {
    return "Nobody has said yes or maybe yet, so nobody gets an email.";
  }
  if (recipientCount === 1) {
    return "The 1 person who said yes or maybe gets an email saying it's off.";
  }
  return `The ${recipientCount} people who said yes or maybe get an email saying it's off.`;
}

/** `"2026-10-20"` → `"Tue, Oct 20"`, the way a posted game's day reads on the Weekly games row. */
export function gameDateLabel(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

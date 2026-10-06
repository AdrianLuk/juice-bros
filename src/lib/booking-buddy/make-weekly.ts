/**
 * "Make this weekly" (issue #581): turning a one-off game into a Standing
 * Game. It is a link, not a second form. The game's page builds a Games page
 * link whose search params carry everything the Post a game form needs, with
 * "Repeats weekly" ticked, and the Games page reads them back. The original
 * game is never touched: it stays a one-off. The link does carry its id,
 * though, so the new Standing Game can treat that game's date as covered and
 * start posting from the week after (no second game that day).
 *
 * Free of Next.js and Supabase imports on purpose, and relative imports only,
 * so `node --test` can load it.
 */

import { clockInZone, isHourTime, todayInZone } from "./datetime.ts";
import { parseDivision, type Division } from "./division.ts";
import { MAX_ROTATION_BUFFER } from "./capacity.ts";
import {
  DEFAULT_REMINDER_OFFSET_MINUTES,
  MAX_REMINDER_OFFSET_MINUTES,
  MIN_REMINDER_OFFSET_MINUTES,
} from "./reminders.ts";
import { parseSlotNotes } from "./slots.ts";
import { SLOTS_PATH } from "./routes.ts";
import { hourClock, weekdayOfDate } from "./standing-games.ts";
import { isUuid } from "./uuid.ts";

/** Everything the Post a game form is seeded with when it opens from "Make this weekly". */
export type WeeklyPrefill = {
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** On-the-hour `"HH:00"`. */
  startTime: string;
  /** On-the-hour `"HH:00"`, never equal to `startTime`; at or before it means the next day. */
  endTime: string;
  division: Division;
  orgId: string | null;
  notes: string | null;
  rotationBuffer: number;
  reminderOffsetMinutes: number;
  /** Users ticked as Regulars. */
  regularIds: string[];
  /** The one-off game this came from, whose date the new Standing Game won't post again. */
  sourceSlotId: string | null;
};

/** The Post a game field that carries `sourceSlotId` to `createStandingGame`. */
export const SOURCE_SLOT_FIELD = "source_slot_id";

/** The source game's id off the submitted form, or `null` when there is none or it isn't an id. */
export function parseSourceSlotId(formData: FormData): string | null {
  const value = String(formData.get(SOURCE_SLOT_FIELD) ?? "").trim();
  return isUuid(value) ? value : null;
}

/** What "Make this weekly" reads off the game it starts from. */
export type WeeklySourceSlot = {
  id: string;
  proposedStart: string;
  proposedEnd: string;
  timeZone: string;
  division: Division;
  intendedOrgId: string | null;
  notes: string | null;
  rotationBuffer: number;
  reminderOffsetMinutes: number;
};

/** The hour a moment falls in on the zone's wall clock, as `"HH:00"`. A Standing Game runs on whole hours. */
function hourInZone(zone: string, at: Date): string {
  return `${clockInZone(zone, at).slice(0, 2)}:00`;
}

/**
 * The prefill for a game the organizer wants to repeat: its own weekday and
 * hours on its own zone's wall clock (so a Tuesday 8pm game stays a Tuesday
 * 8pm game whatever UTC says), the rest of its settings, and the Users who
 * answered yes as Regulars. Guests have no account to be a Regular with, and
 * the organizer is never their own Regular.
 */
export function weeklyPrefillFromSlot(
  slot: WeeklySourceSlot,
  responses: readonly { userId: string | null; answer: string }[],
  ownerId: string,
): WeeklyPrefill {
  const start = new Date(slot.proposedStart);
  const startTime = hourInZone(slot.timeZone, start);
  let endTime = hourInZone(slot.timeZone, new Date(slot.proposedEnd));
  if (endTime === startTime) {
    // Only a game shorter than an hour lands here: give it the hour.
    endTime = hourClock((Number(startTime.slice(0, 2)) + 1) % 24);
  }

  const regularIds: string[] = [];
  for (const response of responses) {
    if (
      response.answer === "yes" &&
      response.userId !== null &&
      response.userId !== ownerId &&
      !regularIds.includes(response.userId)
    ) {
      regularIds.push(response.userId);
    }
  }

  return {
    weekday: weekdayOfDate(todayInZone(slot.timeZone, start)),
    startTime,
    endTime,
    division: slot.division,
    orgId: slot.intendedOrgId,
    notes: slot.notes,
    rotationBuffer: slot.rotationBuffer,
    reminderOffsetMinutes: slot.reminderOffsetMinutes,
    regularIds,
    sourceSlotId: slot.id,
  };
}

/** The prefill as search params, in a fixed order so equal prefills give equal strings. */
function weeklySearch(prefill: WeeklyPrefill): string {
  const params = new URLSearchParams();
  params.set("weekly", "1");
  params.set("weekday", String(prefill.weekday));
  params.set("start", prefill.startTime);
  params.set("end", prefill.endTime);
  params.set("division", prefill.division);
  if (prefill.orgId) {
    params.set("org", prefill.orgId);
  }
  if (prefill.notes) {
    params.set("notes", prefill.notes);
  }
  params.set("buffer", String(prefill.rotationBuffer));
  params.set("reminder", String(prefill.reminderOffsetMinutes));
  if (prefill.regularIds.length > 0) {
    params.set("regulars", prefill.regularIds.join(","));
  }
  if (prefill.sourceSlotId) {
    params.set("from", prefill.sourceSlotId);
  }
  return params.toString();
}

/** The "Make this weekly" link: the Games page's Post a game form, prefilled. */
export function makeWeeklyHref(prefill: WeeklyPrefill): string {
  return `${SLOTS_PATH}?${weeklySearch(prefill)}#post-a-game`;
}

/**
 * A stable signature of the prefill, for `key={}` on the form: a second
 * "Make this weekly" link to the same route only changes the query string,
 * and the form's mount-time state would otherwise keep the first one.
 */
export function weeklyPrefillKey(prefill: WeeklyPrefill): string {
  return `weekly|${weeklySearch(prefill)}`;
}

type SearchParams = Record<string, string | string[] | undefined>;

function single(params: SearchParams, name: string): string {
  const value = params[name];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function wholeNumberIn(raw: string, min: number, max: number): number | null {
  if (raw === "") {
    return null;
  }
  const value = Number(raw);
  return Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/**
 * Reads a "Make this weekly" link back off the Games page's search params,
 * or `null` when the visit isn't one. The link is just a URL, so nothing in
 * it is trusted: no usable day or hours means no prefill, a Facility the
 * visitor doesn't own or a Regular who isn't their friend drops out, and any
 * other bad value takes the form's own default.
 */
export function parseWeeklyPrefill(
  params: SearchParams,
  known: { orgIds: readonly string[]; friendIds: readonly string[] },
): WeeklyPrefill | null {
  if (single(params, "weekly") !== "1") {
    return null;
  }

  const weekday = wholeNumberIn(single(params, "weekday"), 0, 6);
  const startTime = single(params, "start");
  const endTime = single(params, "end");
  if (weekday === null || !isHourTime(startTime) || !isHourTime(endTime) || startTime === endTime) {
    return null;
  }

  const orgId = single(params, "org");
  const from = single(params, "from");
  const notesResult = parseSlotNotes(single(params, "notes"));

  const regularIds: string[] = [];
  for (const id of single(params, "regulars").split(",")) {
    if (known.friendIds.includes(id) && !regularIds.includes(id)) {
      regularIds.push(id);
    }
  }

  return {
    weekday,
    startTime,
    endTime,
    division: parseDivision(single(params, "division")),
    orgId: known.orgIds.includes(orgId) ? orgId : null,
    notes: "error" in notesResult ? null : notesResult.notes,
    rotationBuffer: wholeNumberIn(single(params, "buffer"), 0, MAX_ROTATION_BUFFER) ?? 0,
    reminderOffsetMinutes:
      wholeNumberIn(single(params, "reminder"), MIN_REMINDER_OFFSET_MINUTES, MAX_REMINDER_OFFSET_MINUTES) ??
      DEFAULT_REMINDER_OFFSET_MINUTES,
    regularIds,
    // Ownership is the database's check, when the Standing Game is created.
    sourceSlotId: isUuid(from) ? from : null,
  };
}

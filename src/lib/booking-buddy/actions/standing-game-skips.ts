"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { absoluteAppUrl } from "../request-origin.ts";
import { SLOTS_PATH, standingGamePath } from "../routes.ts";
import { formatSlotWhen } from "../slots.ts";
import { formatShortDateLabel, todayInZone } from "../datetime.ts";
import { standingGameSchedule, stillUpcomingCutoffDate } from "../standing-games.ts";
import {
  gameOffRecipients,
  isUpcomingGameDate,
  skippableGameDates,
} from "../standing-game-skips.ts";
import { postDueWeeks } from "../standing-game-posting.ts";
import { notifyGameOff } from "../game-off-notify.ts";
import { readFailed, type ActionResult } from "./result.ts";
import { listOrgs } from "./orgs.ts";

/** A week of a Standing Game as the skip controls show it. */
export type GameWeek = { date: string; label: string };

export type StandingGameSkips = {
  /** Skipped weeks still to come, soonest first. Each can be un-skipped. */
  skipped: GameWeek[];
  /** Upcoming weeks with nothing posted or skipped yet, offered to skip ahead of time. */
  skippable: GameWeek[];
};

/** How many weeks ahead the Standing Game page offers to skip. */
const SKIPPABLE_WEEKS = 12;

type ScheduleRow = {
  id: string;
  weekday: number;
  start_hour: number;
  time_zone: string;
  intended_org_id: string | null;
  ended_at: string | null;
};

async function readSchedule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  standingGameId: string,
): Promise<ScheduleRow | null> {
  const { data, error } = await supabase
    .from("standing_games")
    .select("id, weekday, start_hour, time_zone, intended_org_id, ended_at")
    .eq("id", standingGameId)
    .maybeSingle();
  if (error) {
    readFailed("that weekly game", error);
  }
  return (data as ScheduleRow | null) ?? null;
}

function toGameDay(row: ScheduleRow) {
  return { weekday: row.weekday, startHour: row.start_hour, timeZone: row.time_zone };
}

function week(date: string): GameWeek {
  return { date, label: formatShortDateLabel(date) };
}

/** The Standing Game page's skip section: skipped dates to come, and dates that can still be skipped. */
export async function getStandingGameSkips(standingGameId: string): Promise<StandingGameSkips> {
  await verifySession();
  const supabase = await createClient();

  const schedule = await readSchedule(supabase, standingGameId);
  if (!schedule || schedule.ended_at !== null) {
    return { skipped: [], skippable: [] };
  }

  const { data, error } = await supabase
    .from("standing_game_weeks")
    .select("game_date, skipped_at")
    .eq("standing_game_id", standingGameId)
    .gte("game_date", stillUpcomingCutoffDate(new Date()))
    .order("game_date", { ascending: true });
  if (error) {
    readFailed("your weekly game's skipped weeks", error);
  }

  const now = new Date();
  const day = toGameDay(schedule);
  const rows = data ?? [];
  return {
    skipped: rows
      .filter((row) => row.skipped_at !== null && isUpcomingGameDate(day, row.game_date, now))
      .map((row) => week(row.game_date)),
    skippable: skippableGameDates(
      day,
      new Set(rows.map((row) => row.game_date)),
      now,
      SKIPPABLE_WEEKS,
    ).map(week),
  };
}

/**
 * "Skip this week" on a Standing Game's posted Slot. Reads who said yes or
 * maybe first (their Responses go with the Slot), then marks the week skipped
 * and deletes the Slot in one database call, then emails them from `after()`
 * so a failed send never blocks the skip. Lands on the Standing Game's page,
 * where the date now shows as skipped.
 */
export async function skipPostedWeek(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await verifySession();

  const slotId = String(formData.get("slot_id") ?? "").trim();
  if (!slotId) {
    return { error: "Which game is this?" };
  }

  const supabase = await createClient();
  const { data: slot } = await supabase
    .from("slots")
    .select("id, owner_id, standing_game_id, proposed_start, proposed_end, time_zone")
    .eq("id", slotId)
    .maybeSingle();

  if (!slot || slot.owner_id !== session.userId || !slot.standing_game_id) {
    return { error: "Couldn't skip that week. Try again." };
  }

  const { data: responses, error: responsesError } = await supabase
    .from("responses")
    .select("user_id, answer")
    .eq("slot_id", slotId);
  if (responsesError) {
    return { error: "Couldn't skip that week. Try again." };
  }

  const recipientIds = gameOffRecipients(
    (responses ?? []).map((row) => ({ userId: row.user_id, answer: row.answer })),
    session.userId,
    { started: new Date(slot.proposed_start) <= new Date() },
  );
  const gamesUrl = await absoluteAppUrl(SLOTS_PATH);
  const slotWhen = formatSlotWhen({
    proposedStart: slot.proposed_start,
    proposedEnd: slot.proposed_end,
    timeZone: slot.time_zone,
  });

  const { data: skippedDate, error } = await supabase.rpc("skip_posted_standing_game_week", {
    target_slot: slotId,
  });
  if (error) {
    console.error("booking-buddy: skipping a posted week failed", error);
    return { error: "Couldn't skip that week. Try again." };
  }

  // The RPC returns the week's date; the Slot's own wall clock is the same day.
  const gameDate =
    typeof skippedDate === "string"
      ? skippedDate
      : todayInZone(slot.time_zone, new Date(slot.proposed_start));
  after(() =>
    notifyGameOff({
      recipientIds,
      ownerId: session.userId,
      standingGameId: slot.standing_game_id,
      slotWhen,
      gameDate,
      gamesUrl,
    }),
  );

  revalidatePath(SLOTS_PATH);
  revalidatePath(standingGamePath(slot.standing_game_id));
  redirect(standingGamePath(slot.standing_game_id));
}

function readWeekForm(formData: FormData): { standingGameId: string; gameDate: string } | null {
  const standingGameId = String(formData.get("standing_game_id") ?? "").trim();
  const gameDate = String(formData.get("game_date") ?? "").trim();
  return standingGameId && gameDate ? { standingGameId, gameDate } : null;
}

/** Skip a week that hasn't been posted yet, from the Standing Game page. It is then never posted. */
export async function skipStandingGameDate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();

  const target = readWeekForm(formData);
  if (!target) {
    return { error: "Pick a week to skip." };
  }

  const supabase = await createClient();
  const schedule = await readSchedule(supabase, target.standingGameId);
  if (!schedule || schedule.ended_at !== null) {
    return { error: "Couldn't skip that week. Try again." };
  }
  if (!isUpcomingGameDate(toGameDay(schedule), target.gameDate, new Date())) {
    return { error: "Pick one of the weeks still to come." };
  }

  const { data, error } = await supabase.rpc("skip_standing_game_date", {
    target_standing_game: target.standingGameId,
    target_game_date: target.gameDate,
  });
  if (error) {
    console.error("booking-buddy: skipping a weekly game's date failed", error);
    return { error: "Couldn't skip that week. Try again." };
  }
  if (data === "posted") {
    return { error: "That week's game is already posted. Open it to skip it, so the people who said yes hear it's off." };
  }

  revalidatePath(SLOTS_PATH);
  revalidatePath(standingGamePath(target.standingGameId));
  return { ok: true };
}

/**
 * Take back a skip while the date is still to come. If that week is already
 * due to be on the board, it posts now rather than waiting for the next
 * daily run, which could come after the game.
 */
export async function unskipStandingGameDate(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();

  const target = readWeekForm(formData);
  if (!target) {
    return { error: "Which week is this?" };
  }

  const supabase = await createClient();
  const schedule = await readSchedule(supabase, target.standingGameId);
  if (!schedule || schedule.ended_at !== null) {
    return { error: "Couldn't put that week back. Try again." };
  }
  if (!isUpcomingGameDate(toGameDay(schedule), target.gameDate, new Date())) {
    return { error: "That week has already gone." };
  }

  const { data: unskipped, error } = await supabase.rpc("unskip_standing_game_date", {
    target_standing_game: target.standingGameId,
    target_game_date: target.gameDate,
  });
  if (error || unskipped !== true) {
    if (error) {
      console.error("booking-buddy: un-skipping a weekly game's date failed", error);
    }
    return { error: "Couldn't put that week back. Try again." };
  }

  const org = schedule.intended_org_id
    ? (await listOrgs()).find((candidate) => candidate.id === schedule.intended_org_id)
    : undefined;
  // A week put back on inside the posting window posts now, invites and
  // all (#579); one further out waits for the daily run like any other.
  try {
    await postDueWeeks(
      supabase,
      [standingGameSchedule(schedule, org?.bookingWindow?.daysBefore ?? null)],
      { now: new Date(), invites: "in-background" },
    );
  } catch (postError) {
    console.error("booking-buddy: posting an un-skipped week failed", postError);
  }

  revalidatePath(SLOTS_PATH);
  revalidatePath(standingGamePath(target.standingGameId));
  return { ok: true };
}

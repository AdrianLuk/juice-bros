"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { trackFirstSlot, trackFirstStandingGame } from "../analytics.ts";
import { SLOTS_PATH, standingGamePath } from "../routes.ts";
import { DEFAULT_HAND_NAMED_TIME_ZONE } from "../orgs.ts";
import { formatSlotWhen } from "../slots.ts";
import { isDivision, type Division } from "../division.ts";
import {
  dueStandingGameWeeks,
  parseStandingGameForm,
  type StandingGameFields,
} from "../standing-games.ts";
import { postStandingGameWeeks } from "../standing-game-posting.ts";
import { readFailed, type ActionResult } from "./result.ts";
import { listOrgs, type Org } from "./orgs.ts";
import type { CreateSlotResult } from "./slots.ts";

/** A Standing Game as its owner sees it. Friends never get one of these (owner-only RLS). */
export type StandingGame = {
  id: string;
  weekday: number;
  startHour: number;
  endHour: number;
  timeZone: string;
  division: Division;
  intendedOrgId: string | null;
  /** The Intended Org's display name, resolved from the owner's own Orgs. */
  facilityName: string | null;
  notes: string | null;
  rotationBuffer: number;
  reminderOffsetMinutes: number;
  endedAt: string | null;
};

/** One posted, not-yet-finished week of a Standing Game. */
export type PostedGame = { id: string; when: string; proposedStart: string };

export type StandingGameSummary = StandingGame & {
  /** The soonest posted Slot still to finish, or `null` before the cron has posted the next one. */
  nextGame: PostedGame | null;
};

export type StandingGameDetail = {
  game: StandingGame;
  /** Every posted Slot of this Standing Game still to finish, soonest first. */
  upcoming: PostedGame[];
  ownedOrgs: Org[];
};

const STANDING_GAME_COLUMNS =
  "id, weekday, start_hour, end_hour, time_zone, division, intended_org_id, notes, rotation_buffer, reminder_offset_minutes, ended_at";

type StandingGameRow = {
  id: string;
  weekday: number;
  start_hour: number;
  end_hour: number;
  time_zone: string;
  division: string;
  intended_org_id: string | null;
  notes: string | null;
  rotation_buffer: number;
  reminder_offset_minutes: number;
  ended_at: string | null;
};

function toStandingGame(row: StandingGameRow, orgs: readonly Org[]): StandingGame {
  return {
    id: row.id,
    weekday: row.weekday,
    startHour: row.start_hour,
    endHour: row.end_hour,
    timeZone: row.time_zone,
    division: isDivision(row.division) ? row.division : "open",
    intendedOrgId: row.intended_org_id,
    facilityName: orgs.find((org) => org.id === row.intended_org_id)?.displayName ?? null,
    notes: row.notes,
    rotationBuffer: row.rotation_buffer,
    reminderOffsetMinutes: row.reminder_offset_minutes,
    endedAt: row.ended_at,
  };
}

/** Posted Slots of these Standing Games still to finish, grouped by Standing Game, soonest first. */
async function upcomingPostedGames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  standingGameIds: string[],
): Promise<Map<string, PostedGame[]>> {
  const byGame = new Map<string, PostedGame[]>();
  if (standingGameIds.length === 0) {
    return byGame;
  }

  const { data, error } = await supabase
    .from("slots")
    .select("id, standing_game_id, proposed_start, proposed_end, time_zone")
    .in("standing_game_id", standingGameIds)
    .gte("proposed_end", new Date().toISOString())
    .order("proposed_start", { ascending: true });

  if (error) {
    readFailed("your weekly games' upcoming games", error);
  }

  for (const row of data ?? []) {
    const list = byGame.get(row.standing_game_id) ?? [];
    list.push({
      id: row.id,
      proposedStart: row.proposed_start,
      when: formatSlotWhen({
        proposedStart: row.proposed_start,
        proposedEnd: row.proposed_end,
        timeZone: row.time_zone,
      }),
    });
    byGame.set(row.standing_game_id, list);
  }
  return byGame;
}

/** The caller's live Standing Games, for the Weekly games section. Ended ones drop off. */
export async function listStandingGames(): Promise<StandingGameSummary[]> {
  await verifySession();
  const supabase = await createClient();

  const [{ data, error }, orgs] = await Promise.all([
    supabase
      .from("standing_games")
      .select(STANDING_GAME_COLUMNS)
      .is("ended_at", null)
      .order("created_at", { ascending: true }),
    listOrgs(),
  ]);

  if (error) {
    readFailed("your weekly games", error);
  }

  const rows = (data ?? []) as StandingGameRow[];
  const upcoming = await upcomingPostedGames(
    supabase,
    rows.map((row) => row.id),
  );

  return rows.map((row) => ({
    ...toStandingGame(row, orgs),
    nextGame: upcoming.get(row.id)?.[0] ?? null,
  }));
}

/** Everything the Standing Game page renders, or `null` when it doesn't exist or isn't the caller's (RLS makes those the same). */
export async function getStandingGame(standingGameId: string): Promise<StandingGameDetail | null> {
  await verifySession();
  const supabase = await createClient();

  const [{ data, error }, orgs] = await Promise.all([
    supabase
      .from("standing_games")
      .select(STANDING_GAME_COLUMNS)
      .eq("id", standingGameId)
      .maybeSingle(),
    listOrgs(),
  ]);

  if (error) {
    readFailed("that weekly game", error);
  }
  if (!data) {
    return null;
  }

  const upcoming = await upcomingPostedGames(supabase, [standingGameId]);
  return {
    game: toStandingGame(data as StandingGameRow, orgs),
    upcoming: upcoming.get(standingGameId) ?? [],
    ownedOrgs: orgs,
  };
}

/**
 * The zone and Booking Window lead a Standing Game takes from its Intended
 * Org: the Org's own zone, else the Toronto fallback every bare Slot uses.
 * `null` when the picked Org isn't one of the caller's.
 */
function scheduleFromOrg(
  fields: StandingGameFields,
  orgs: readonly Org[],
): { timeZone: string; bookingWindowDaysBefore: number | null } | null {
  if (fields.orgId === null) {
    return { timeZone: DEFAULT_HAND_NAMED_TIME_ZONE, bookingWindowDaysBefore: null };
  }
  const org = orgs.find((candidate) => candidate.id === fields.orgId);
  if (!org) {
    return null;
  }
  return { timeZone: org.timeZone, bookingWindowDaysBefore: org.bookingWindow?.daysBefore ?? null };
}

function standingGameColumns(fields: StandingGameFields, timeZone: string) {
  return {
    weekday: fields.weekday,
    start_hour: fields.startHour,
    end_hour: fields.endHour,
    time_zone: timeZone,
    division: fields.division,
    intended_org_id: fields.orgId,
    notes: fields.notes,
    rotation_buffer: fields.rotationBuffer,
    reminder_offset_minutes: fields.reminderOffsetMinutes,
  };
}

/**
 * "Repeats weekly" on Post a game: create the Standing Game and post every
 * week already due, which is always at least the next occurrence of its day
 * and time (and the week after too when the facility's Booking Window opens
 * more than a week ahead). The daily cron posts every week after that.
 *
 * If not even the first week posts, the Standing Game is removed again so a
 * retry doesn't leave a second one behind.
 */
export async function createStandingGame(
  _prev: CreateSlotResult,
  formData: FormData,
): Promise<CreateSlotResult> {
  const session = await verifySession();

  const fields = parseStandingGameForm(formData);
  if ("error" in fields) {
    return fields;
  }

  const orgs = await listOrgs();
  const schedule = scheduleFromOrg(fields, orgs);
  if (!schedule) {
    return { error: "Pick one of your own facilities, or none." };
  }

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("standing_games")
    .insert({ owner_id: session.userId, ...standingGameColumns(fields, schedule.timeZone) })
    .select("id")
    .single();

  if (error || !created) {
    return { error: "Couldn't set up that weekly game. Try again." };
  }

  const dueDates = dueStandingGameWeeks(
    {
      id: created.id,
      weekday: fields.weekday,
      startHour: fields.startHour,
      timeZone: schedule.timeZone,
      endedAt: null,
      bookingWindowDaysBefore: schedule.bookingWindowDaysBefore,
    },
    new Set(),
    new Date(),
  );

  const { posted, failed } = await postStandingGameWeeks(
    supabase,
    dueDates.map((gameDate) => ({ standingGameId: created.id, gameDate })),
  );

  if (posted.length === 0) {
    console.error("booking-buddy: a new Standing Game posted no week", failed);
    await supabase.from("standing_games").delete().eq("id", created.id);
    return { error: "Couldn't post this week's game. Try again." };
  }

  after(async () => {
    await trackFirstStandingGame(session.userId);
    await trackFirstSlot(session.userId, posted.length);
  });

  revalidatePath(SLOTS_PATH);
  return { ok: true, slotId: posted[0].slotId };
}

/**
 * Edit a live Standing Game. Only weeks it hasn't posted yet change: a posted
 * Slot keeps what it was posted with (ADR 0023), and the next week the cron
 * posts carries the new values.
 */
export async function updateStandingGame(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();

  const standingGameId = String(formData.get("standing_game_id") ?? "").trim();
  if (!standingGameId) {
    return { error: "Which weekly game is this?" };
  }

  const fields = parseStandingGameForm(formData);
  if ("error" in fields) {
    return fields;
  }

  const schedule = scheduleFromOrg(fields, await listOrgs());
  if (!schedule) {
    return { error: "Pick one of your own facilities, or none." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("standing_games")
    .update(standingGameColumns(fields, schedule.timeZone))
    .eq("id", standingGameId)
    .is("ended_at", null)
    .select("id");

  if (error || !data?.length) {
    return { error: "Couldn't save that weekly game. Try again." };
  }

  revalidatePath(SLOTS_PATH);
  revalidatePath(standingGamePath(standingGameId));
  return { ok: true };
}

/**
 * End a Standing Game for good: it posts nothing more, and there is no
 * restart. Slots it already posted stay as real games.
 */
export async function endStandingGame(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();

  const standingGameId = String(formData.get("standing_game_id") ?? "").trim();
  if (!standingGameId) {
    return { error: "Which weekly game is this?" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("standing_games")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", standingGameId)
    .is("ended_at", null)
    .select("id");

  if (error || !data?.length) {
    return { error: "Couldn't end that weekly game. Try again." };
  }

  revalidatePath(SLOTS_PATH);
  revalidatePath(standingGamePath(standingGameId));
  redirect(SLOTS_PATH);
}

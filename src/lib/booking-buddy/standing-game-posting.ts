import "server-only";

import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { trackFunnelEvent } from "./analytics.ts";
import {
  planStandingGamePostingRun,
  postedWeekNumbers,
  stillUpcomingCutoffDate,
  type StandingGameSchedule,
} from "./standing-games.ts";
import {
  sendWeeklyInvites,
  sendWeeklyInvitesInBackground,
  type WeeklyInviteRunResult,
} from "./weekly-invite-sending.ts";

/** One week a Standing Game just posted. */
export type PostedWeek = {
  standingGameId: string;
  gameDate: string;
  slotId: string;
};

export type PostWeeksResult = {
  posted: PostedWeek[];
  /** Weeks the database refused (the past-Slot trigger, say). Logged, never thrown: one bad week must not stop the rest. */
  failed: { standingGameId: string; gameDate: string; message: string }[];
};

/**
 * The one place a Standing Game's week becomes a Slot, shared by the
 * creation action (the organizer's own session) and the daily cron
 * (`service_role`). Each week goes through `post_standing_game_week`, which
 * records the week under its unique key and inserts the Slot in one
 * transaction, so a week already recorded comes back as `null` and is simply
 * not in `posted`.
 *
 * Anything that must happen once a week is posted hangs off `posted`, never
 * off a Slot trigger: a posted Slot is a plain Slot (ADR 0023). Callers go
 * through `postDueWeeks` below, which does those things; this is its step
 * that writes.
 */
async function postStandingGameWeeks(
  supabase: SupabaseClient,
  weeks: readonly { standingGameId: string; gameDate: string }[],
): Promise<PostWeeksResult> {
  const result: PostWeeksResult = { posted: [], failed: [] };

  for (const week of weeks) {
    const { data, error } = await supabase.rpc("post_standing_game_week", {
      target_standing_game: week.standingGameId,
      target_game_date: week.gameDate,
    });

    if (error) {
      result.failed.push({ ...week, message: error.message });
      continue;
    }
    if (typeof data === "string") {
      result.posted.push({ ...week, slotId: data });
    }
  }

  return result;
}

/** How a `postDueWeeks` caller wants the Weekly Invites for what it posted sent. */
export type InviteDelivery =
  /** In this request, through the caller's own admin client (the cron, which reports the counts). */
  | { origin: string }
  /** After the response, through a fresh admin client (a server action running as the organizer). */
  | "in-background";

export type PostDueWeeksResult = PostWeeksResult & {
  /** Standing Games looked at. */
  checked: number;
  /** What the in-request send did; `null` when it ran in the background. */
  invites: WeeklyInviteRunResult | null;
};

/**
 * Post every week now due for these Standing Games, then do what a posted
 * week always brings: its Weekly Invite to the Regulars (#579) and one
 * `bb_standing_game_week_posted` Funnel Event carrying `{ week }`, the nth
 * week posted for that Standing Game (spec #576).
 *
 * The one path a week posts by, for all three callers: the daily cron,
 * creating a Standing Game, and putting a skipped week back on. Which weeks
 * are due is `planStandingGamePostingRun` against the weeks already recorded
 * (posted, skipped, or covered by "Make this weekly"), read here.
 *
 * `supabase` is the caller's client: the organizer's session for the actions
 * (owner-only RLS on both tables), `service_role` for the cron. Throws when
 * the read of recorded weeks fails, before anything is posted.
 */
export async function postDueWeeks(
  supabase: SupabaseClient,
  games: readonly StandingGameSchedule[],
  options: { now: Date; invites: InviteDelivery },
): Promise<PostDueWeeksResult> {
  if (games.length === 0) {
    return { checked: 0, posted: [], failed: [], invites: null };
  }

  const { data: weekRows, error: weeksError } = await supabase
    .from("standing_game_weeks")
    .select("standing_game_id, game_date")
    .in(
      "standing_game_id",
      games.map((game) => game.id),
    )
    .gte("game_date", stillUpcomingCutoffDate(options.now));
  if (weeksError) {
    throw new Error(`reading recorded weeks failed: ${weeksError.message}`);
  }

  const plan = planStandingGamePostingRun({
    games: [...games],
    postedDatesByGame: datesByGame(weekRows ?? []),
    now: options.now,
  });
  const { posted, failed } = await postStandingGameWeeks(supabase, plan.posts);
  for (const week of failed) {
    console.error("booking-buddy: posting a Standing Game week failed", week);
  }

  if (posted.length > 0) {
    const weeks = await postedWeekIndexes(supabase, posted);
    after(async () => {
      for (const week of weeks) {
        await trackFunnelEvent("bb_standing_game_week_posted", { week });
      }
    });
  }

  let invites: WeeklyInviteRunResult | null = null;
  if (options.invites === "in-background") {
    await sendWeeklyInvitesInBackground(posted);
  } else {
    invites = await sendWeeklyInvites(supabase, posted, options.invites.origin);
  }

  return { checked: plan.checked, posted, failed, invites };
}

function datesByGame(
  rows: readonly { standing_game_id: string; game_date: string }[],
): Map<string, Set<string>> {
  const byGame = new Map<string, Set<string>>();
  for (const row of rows) {
    const dates = byGame.get(row.standing_game_id) ?? new Set<string>();
    dates.add(row.game_date);
    byGame.set(row.standing_game_id, dates);
  }
  return byGame;
}

/**
 * Each just-posted week's place among its Standing Game's posted weeks
 * (`postedWeekNumbers`), from every week row that has a Slot. `null` per week
 * when that read fails: the event still counts, without its index.
 */
async function postedWeekIndexes(
  supabase: SupabaseClient,
  posted: readonly PostedWeek[],
): Promise<(number | null)[]> {
  const { data, error } = await supabase
    .from("standing_game_weeks")
    .select("standing_game_id, game_date")
    .in("standing_game_id", [...new Set(posted.map((week) => week.standingGameId))])
    .not("slot_id", "is", null);
  if (error) {
    console.error("booking-buddy: reading posted weeks for the funnel event failed", error);
    return posted.map(() => null);
  }
  return postedWeekNumbers(posted, datesByGame(data ?? []));
}

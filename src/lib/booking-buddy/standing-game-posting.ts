import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

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
 * Anything that must happen once a week is posted hangs off `posted` at the
 * callers, never off a Slot trigger: a posted Slot is a plain Slot (ADR 0023).
 * Every caller sends the Weekly Invite (#579) for what it posted: the cron
 * with `sendWeeklyInvites`, the server actions with
 * `inviteRegularsAfterResponse` (both in `weekly-invite-sending.ts`).
 */
export async function postStandingGameWeeks(
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

import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/booking-buddy/supabase/admin";
import { trackFunnelEvent } from "@/lib/booking-buddy/analytics";
import { postStandingGameWeeks } from "@/lib/booking-buddy/standing-game-posting";
import {
  planStandingGamePostingRun,
  type StandingGameSchedule,
} from "@/lib/booking-buddy/standing-games";

export const runtime = "nodejs";

/**
 * The daily job that posts each Standing Game's coming weeks as plain Slots
 * (issue #577, ADR 0023). Its own route rather than a step in one of the
 * Reminder jobs, for the reason `send-booking-window-reminders` gives for
 * standing apart from `send-reminders`: a different trigger and a different
 * job. It also must not share their early exit when Resend isn't configured,
 * since posting a game needs no email.
 *
 * Which weeks post is `planStandingGamePostingRun` (`standing-games.ts`), unit
 * tested; this route is the I/O around it. Each week goes through
 * `post_standing_game_week`, whose unique key on (Standing Game, date) is what
 * makes a rerun, or a race with the creation action, post a week at most once.
 *
 * `vercel.json` runs this daily at 12:00 UTC, an hour before
 * `send-booking-window-reminders`, so a week posted the day before its
 * facility's Booking Window opens is on the board when that job looks for it.
 * Weeks post a week ahead or more, so once a day is plenty; a more frequent
 * schedule needs no change here.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("post-standing-game-weeks: CRON_SECRET is not configured.");
    return NextResponse.json({ error: "Not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  const { data: scheduleRows, error: schedulesError } = await supabase
    .from("standing_game_schedules")
    .select("id, weekday, start_hour, time_zone, ended_at, booking_window_days_before")
    .is("ended_at", null);

  if (schedulesError) {
    console.error("post-standing-game-weeks: reading standing games failed", schedulesError);
    return NextResponse.json({ error: "Read failed." }, { status: 502 });
  }

  const games: StandingGameSchedule[] = (scheduleRows ?? []).map((row) => ({
    id: row.id,
    weekday: row.weekday,
    startHour: row.start_hour,
    timeZone: row.time_zone,
    endedAt: row.ended_at,
    bookingWindowDaysBefore: row.booking_window_days_before,
  }));

  if (games.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, posted: 0, failed: 0 });
  }

  // Only weeks from yesterday (UTC) on can still be due in any zone; older
  // rows can't affect this run.
  const since = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: weekRows, error: weeksError } = await supabase
    .from("standing_game_weeks")
    .select("standing_game_id, game_date")
    .in(
      "standing_game_id",
      games.map((game) => game.id),
    )
    .gte("game_date", since);

  if (weeksError) {
    console.error("post-standing-game-weeks: reading posted weeks failed", weeksError);
    return NextResponse.json({ error: "Read failed." }, { status: 502 });
  }

  const postedDatesByGame = new Map<string, Set<string>>();
  for (const row of weekRows ?? []) {
    const dates = postedDatesByGame.get(row.standing_game_id) ?? new Set<string>();
    dates.add(row.game_date);
    postedDatesByGame.set(row.standing_game_id, dates);
  }

  const plan = planStandingGamePostingRun({ games, postedDatesByGame, now });
  const { posted, failed } = await postStandingGameWeeks(supabase, plan.posts);

  for (const week of failed) {
    console.error("post-standing-game-weeks: posting a week failed", week);
  }
  for (let index = 0; index < posted.length; index += 1) {
    await trackFunnelEvent("bb_standing_game_week_posted");
  }

  return NextResponse.json({
    ok: true,
    checked: plan.checked,
    posted: posted.length,
    failed: failed.length,
  });
}

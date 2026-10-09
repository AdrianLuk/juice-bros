import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/booking-buddy/supabase/admin";
import { postDueWeeks } from "@/lib/booking-buddy/standing-game-posting";
import { standingGameSchedule } from "@/lib/booking-buddy/standing-games";

export const runtime = "nodejs";

/**
 * The daily job that posts each Standing Game's coming weeks as plain Slots
 * (issue #577, ADR 0023). Its own route rather than a step in one of the
 * Reminder jobs, for the reason `send-booking-window-reminders` gives for
 * standing apart from `send-reminders`: a different trigger and a different
 * job. It also must not share their early exit when Resend isn't configured,
 * since posting a game needs no email.
 *
 * The posting itself is `postDueWeeks` (`standing-game-posting.ts`), the same
 * path creating a Standing Game and un-skipping a week take: it plans the due
 * weeks, posts each through `post_standing_game_week` (whose unique key on
 * (Standing Game, date) makes a rerun, or a race with an action, post a week
 * at most once), fires the week-posted Funnel Event, and sends the Weekly
 * Invites in this same run. A missing Resend or VAPID config skips that
 * channel there; it never stops the posting.
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

  const games = (scheduleRows ?? []).map((row) =>
    standingGameSchedule(row, row.booking_window_days_before),
  );

  let result;
  try {
    result = await postDueWeeks(supabase, games, {
      now,
      invites: { origin: request.nextUrl.origin },
    });
  } catch (error) {
    console.error("post-standing-game-weeks: reading posted weeks failed", error);
    return NextResponse.json({ error: "Read failed." }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    checked: result.checked,
    posted: result.posted.length,
    failed: result.failed.length,
    invitesSent: result.invites?.sent ?? 0,
    invitesFailed: result.invites?.failed ?? 0,
    invitesSkipped: result.invites?.skipped ?? 0,
    invitesRunFailed: result.invites?.runFailed ?? false,
  });
}

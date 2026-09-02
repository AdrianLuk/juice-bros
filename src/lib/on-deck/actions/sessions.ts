"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifyOrganizer } from "../dal.ts";
import { getOwnedClub, updateClubDefaults } from "../clubs.ts";
import { getOpenSessionForClub } from "../sessions.ts";
import {
  ON_DECK_HOME_PATH,
  ON_DECK_SETTINGS_PATH,
  sessionPath,
} from "../routes.ts";

/**
 * Opens tonight's Session from the Club's saved defaults with one tap.
 *
 * The session row and its `SESSION_STARTED` event are written together by the
 * `on_deck_start_session` RPC — one transaction, so a failure never leaves an
 * eventless open Session behind. "Only one open Session per Club" is enforced
 * by a partial unique index; a race-loser's `unique_violation` is turned here
 * into landing on the Session that already opened.
 */
export async function startSession(input?: {
  /** The Organizer's local calendar date (`YYYY-MM-DD`), from the browser, so
   * "is a scheduled session due today" is judged in their time zone and not
   * the server's UTC. Absent, the RPC falls back to `current_date`. */
  today?: string;
}): Promise<void> {
  await verifyOrganizer();
  const supabase = await createClient();

  const club = await getOwnedClub(supabase);
  if (!club) {
    // No Club seeded for this account — nothing to start. The home screen
    // renders that state; bounce back to it.
    redirect(ON_DECK_HOME_PATH);
  }

  const existing = await getOpenSessionForClub(supabase, club.id);
  if (existing) {
    redirect(sessionPath(existing.config.sessionId));
  }

  const today =
    typeof input?.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.today)
      ? input.today
      : null;

  const { data: sessionId, error } = await supabase.rpc("on_deck_start_session", {
    p_club_id: club.id,
    p_today: today,
  });

  if (error) {
    // 23505 = unique_violation: another tab won the one-open-Session race.
    if (error.code === "23505") {
      const raced = await getOpenSessionForClub(supabase, club.id);
      if (raced) {
        redirect(sessionPath(raced.config.sessionId));
      }
    }
    throw new Error(`starting the Session failed: ${error.message}`);
  }

  revalidatePath(ON_DECK_HOME_PATH);
  redirect(sessionPath(sessionId as string));
}

export type SessionSettingsResult = { ok: true } | { ok?: false; error: string };

const COURT_COUNT = { min: 1, max: 40 };
const GROUP_CAP = { min: 2, max: 8 };
const VENUE_MAX = 120;

/** `YYYY-MM-DD`, and a real calendar date. */
function parseIsoDate(raw: string): string | null {
  const value = raw?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  // Reject an overflowed date like 2026-02-31 that `Date` silently rolls over.
  return parsed.toISOString().slice(0, 10) === value ? value : null;
}

type SessionFields = {
  venueName?: string;
  courtCount?: number;
  groupCap?: number;
  scheduledFor?: string;
};

/**
 * Shared validation for the Club-defaults and scheduled-Session forms. Returns
 * the cleaned values, or a one-line error for the form to show.
 */
function validateFields(
  input: SessionFields,
  need: { date: boolean; groupCap: boolean },
):
  | { ok: true; venueName: string; courtCount: number; groupCap: number; scheduledFor: string | null }
  | { ok: false; error: string } {
  const venueName = input.venueName?.trim().replace(/\s+/g, " ") ?? "";
  if (!venueName) return { ok: false, error: "Enter a venue name." };
  if (venueName.length > VENUE_MAX) {
    return { ok: false, error: `Keep the venue name under ${VENUE_MAX} characters.` };
  }

  const courtCount = Number(input.courtCount);
  if (
    !Number.isInteger(courtCount) ||
    courtCount < COURT_COUNT.min ||
    courtCount > COURT_COUNT.max
  ) {
    return {
      ok: false,
      error: `Court count has to be a whole number from ${COURT_COUNT.min} to ${COURT_COUNT.max}.`,
    };
  }

  let groupCap = GROUP_CAP.min;
  if (need.groupCap) {
    groupCap = Number(input.groupCap);
    if (
      !Number.isInteger(groupCap) ||
      groupCap < GROUP_CAP.min ||
      groupCap > GROUP_CAP.max
    ) {
      return {
        ok: false,
        error: `Group cap has to be a whole number from ${GROUP_CAP.min} to ${GROUP_CAP.max}.`,
      };
    }
  }

  let scheduledFor: string | null = null;
  if (need.date) {
    scheduledFor = parseIsoDate(input.scheduledFor ?? "");
    if (!scheduledFor) return { ok: false, error: "Pick a valid date." };
  }

  return { ok: true, venueName, courtCount, groupCap, scheduledFor };
}

/**
 * Saves the Club's saved Session defaults (issue #254, user story 44). Only the
 * Club owner reaches this — `verifyOrganizer` plus the RPC's own ownership
 * check — and only venue / court count / group cap move.
 */
export async function saveClubDefaults(input: {
  venueName: string;
  courtCount: number;
  groupCap: number;
}): Promise<SessionSettingsResult> {
  await verifyOrganizer();

  const valid = validateFields(input, { date: false, groupCap: true });
  if (!valid.ok) return valid;

  const supabase = await createClient();
  const club = await getOwnedClub(supabase);
  if (!club) return { error: "No club is set up for this account yet." };

  try {
    await updateClubDefaults(supabase, {
      venueName: valid.venueName,
      courtCount: valid.courtCount,
      groupCap: valid.groupCap,
    });
  } catch (error) {
    console.error("on-deck: saving Club defaults failed", error);
    return { error: "Couldn't save your defaults just now. Try again." };
  }

  revalidatePath(ON_DECK_HOME_PATH);
  revalidatePath(ON_DECK_SETTINGS_PATH);
  return { ok: true };
}

/**
 * Creates a Session ahead of time (issue #254, user story 43). Group cap and
 * Floor Mode come from the Club — only the date, venue, and court count are
 * per-night. The RPC checks Club ownership; a clash on the date is surfaced
 * rather than thrown.
 */
export async function createScheduledSession(input: {
  scheduledFor: string;
  venueName: string;
  courtCount: number;
}): Promise<{ ok: true; sessionId: string } | { ok?: false; error: string }> {
  await verifyOrganizer();

  const valid = validateFields(input, { date: true, groupCap: false });
  if (!valid.ok) return valid;

  const supabase = await createClient();
  const club = await getOwnedClub(supabase);
  if (!club) return { error: "No club is set up for this account yet." };

  const { data: sessionId, error } = await supabase.rpc(
    "on_deck_create_scheduled_session",
    {
      p_club_id: club.id,
      p_scheduled_for: valid.scheduledFor,
      p_venue_name: valid.venueName,
      p_court_count: valid.courtCount,
    },
  );

  if (error) {
    if (error.code === "23505") {
      return { error: "You already have a session scheduled for that date." };
    }
    console.error("on-deck: scheduling a Session failed", error);
    return { error: "Couldn't schedule that session just now. Try again." };
  }

  revalidatePath(ON_DECK_HOME_PATH);
  return { ok: true, sessionId: sessionId as string };
}

/** Edits a not-yet-open Session (issue #254, user story 43). */
export async function updateScheduledSession(input: {
  sessionId: string;
  scheduledFor: string;
  venueName: string;
  courtCount: number;
}): Promise<SessionSettingsResult> {
  await verifyOrganizer();

  const valid = validateFields(input, { date: true, groupCap: false });
  if (!valid.ok) return valid;

  const supabase = await createClient();
  const { error } = await supabase.rpc("on_deck_update_scheduled_session", {
    p_session_id: input.sessionId,
    p_scheduled_for: valid.scheduledFor,
    p_venue_name: valid.venueName,
    p_court_count: valid.courtCount,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You already have a session scheduled for that date." };
    }
    if (error.code === "42501") {
      return { error: "That scheduled session isn't yours to edit." };
    }
    console.error("on-deck: editing a scheduled Session failed", error);
    return { error: "Couldn't save that change just now. Try again." };
  }

  revalidatePath(ON_DECK_HOME_PATH);
  return { ok: true };
}

/** Drops a planned Session before it opens (issue #254). */
export async function deleteScheduledSession(
  sessionId: string,
): Promise<SessionSettingsResult> {
  await verifyOrganizer();

  const supabase = await createClient();
  const { error } = await supabase.rpc("on_deck_delete_scheduled_session", {
    p_session_id: sessionId,
  });

  if (error) {
    if (error.code === "42501") {
      return { error: "That scheduled session isn't yours to delete." };
    }
    console.error("on-deck: deleting a scheduled Session failed", error);
    return { error: "Couldn't remove that session just now. Try again." };
  }

  revalidatePath(ON_DECK_HOME_PATH);
  return { ok: true };
}

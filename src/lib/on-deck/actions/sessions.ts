"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifyOrganizer } from "../dal.ts";
import {
  ClubAlreadyExistsError,
  adoptClubTimeZone,
  createClub as createClubRow,
  getOwnedClub,
  setClubTimeZone,
  updateClubDefaults,
} from "../clubs.ts";
import { CLUB_NAME_MAX, COURT_COUNT_RANGE, collapseSpaces } from "../club-draft.ts";
import { deleteClubDraftCookie } from "../club-draft-server.ts";
import { FLOOR_MODES, type ClubDefaults } from "../session/types.ts";
import { isKnownTimeZone } from "../timezone.ts";
import { getOpenSessionForClub, resolveOpenSessionForClub } from "../sessions.ts";
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
 *
 * `existing` is resolved through `resolveOpenSessionForClub` rather than the
 * plain read (issue #516): a Session left open past last week auto-closes
 * right here, so a forgotten Close never blocks tonight's Start.
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

  const existing = await resolveOpenSessionForClub(supabase, club.id);
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
    // The plain getter is deliberate here, not `resolveOpenSessionForClub` — a
    // Session that just won this race is milliseconds old and can't be stale.
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

const GROUP_CAP = { min: 2, max: 8 };
const VENUE_MAX = 120;

/** The Club's name, as both the create and the settings form need it checked. */
function validateClubName(
  raw: string | undefined,
): { ok: true; name: string } | { ok: false; error: string } {
  const name = collapseSpaces(raw ?? "");
  if (!name) return { ok: false, error: "Enter your club's name." };
  if (name.length > CLUB_NAME_MAX) {
    return {
      ok: false,
      error: `Keep the club name under ${CLUB_NAME_MAX} characters.`,
    };
  }
  return { ok: true, name };
}

/** How many courts, as the create form, the settings form and a scheduled
 * Session all need it checked. */
function validateCourtCount(
  raw: number | undefined,
): { ok: true; courtCount: number } | { ok: false; error: string } {
  const courtCount = Number(raw);
  if (
    !Number.isInteger(courtCount) ||
    courtCount < COURT_COUNT_RANGE.min ||
    courtCount > COURT_COUNT_RANGE.max
  ) {
    return {
      ok: false,
      error: `Court count has to be a whole number from ${COURT_COUNT_RANGE.min} to ${COURT_COUNT_RANGE.max}.`,
    };
  }
  return { ok: true, courtCount };
}

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

  const courts = validateCourtCount(input.courtCount);
  if (!courts.ok) return courts;
  const courtCount = courts.courtCount;

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
 * Adopts the Organizer's own browser zone as the Club's clock, if the Club
 * has none yet (issue #469).
 *
 * Fired from the Organizer's home screen rather than asked as a question. The
 * browser is the only party that knows this, and an Organizer opening On Deck
 * has no reason to care that a `timestamptz` needs a zone to become a date.
 *
 * Deliberately silent in both directions. It reports nothing on success,
 * because there is nothing to tell; and it swallows failure, because a clock
 * that stays unset costs a wrong-looking date on a page that is not even open
 * yet, and that is not worth an error on the screen someone opened to start
 * tonight's session. The RPC is a no-op once a zone exists, so calling it on
 * every visit is free.
 */
export async function adoptDetectedTimeZone(timeZone: string): Promise<void> {
  await verifyOrganizer();

  if (!isKnownTimeZone(timeZone)) return;

  try {
    const supabase = await createClient();
    await adoptClubTimeZone(supabase, timeZone);
  } catch (error) {
    console.error("on-deck: adopting the Club's time zone failed", error);
    return;
  }

  revalidatePath(ON_DECK_HOME_PATH);
  revalidatePath(ON_DECK_SETTINGS_PATH);
}

/**
 * Sets the Club's clock, because the adopted guess was wrong (issue #469).
 *
 * Its own action rather than a field on `saveClubDefaults`, for the reason
 * that RPC's comment gives: saving a venue must not commit a zone nobody
 * chose. This one is only ever reached by somebody deciding.
 */
export async function saveClubTimeZone(
  timeZone: string,
): Promise<SessionSettingsResult> {
  await verifyOrganizer();

  // The `on_deck_clubs` trigger is the authority and would refuse this too;
  // checking here is what turns a constraint violation into a sentence about
  // the field the Organizer just changed.
  const zone = timeZone.trim();
  if (!isKnownTimeZone(zone)) {
    return { ok: false, error: "Pick a time zone from the list." };
  }

  const supabase = await createClient();
  const club = await getOwnedClub(supabase);
  if (!club) return { error: "No club is set up for this account yet." };

  try {
    await setClubTimeZone(supabase, zone);
  } catch (error) {
    console.error("on-deck: saving the Club's time zone failed", error);
    return { error: "Couldn't save the time zone just now. Try again." };
  }

  revalidatePath(ON_DECK_HOME_PATH);
  revalidatePath(ON_DECK_SETTINGS_PATH);
  return { ok: true };
}

/**
 * Creates the Organizer's own Club (issue #515, user stories 11-13).
 *
 * The screen this replaces told a signed-in Organizer that On Deck Clubs are
 * made by hand and to get in touch, which is where every stranger who wanted
 * to try this stopped. Two fields, because they have not run a night yet;
 * everything else takes the schema's defaults and Settings can reach all of it.
 *
 * One Club per owner is the RPC's own check as well as a unique index, so the
 * second tab of a double-submit gets the same sentence as a second attempt.
 */
export async function createClub(input: {
  name: string;
  courtCount: number;
}): Promise<SessionSettingsResult> {
  await verifyOrganizer();

  const named = validateClubName(input.name);
  if (!named.ok) return named;

  const courts = validateCourtCount(input.courtCount);
  if (!courts.ok) return courts;

  const supabase = await createClient();

  try {
    await createClubRow(supabase, {
      name: named.name,
      courtCount: courts.courtCount,
    });
  } catch (error) {
    // The Organizer already has one — a stale form, or the losing half of a
    // double submit. Not a failure to report as one: the home screen they are
    // about to be shown is their Club, with Start on it.
    if (error instanceof ClubAlreadyExistsError) {
      await deleteClubDraftCookie();
      revalidatePath(ON_DECK_HOME_PATH);
      return { ok: true };
    }
    console.error("on-deck: creating a Club failed", error);
    return { error: "Couldn't create your club just now. Try again." };
  }

  // Whatever was carried through sign-in (issue #520) has done its job —
  // there is nowhere else it would ever be used, one Club per account with no
  // way to delete it.
  await deleteClubDraftCookie();
  revalidatePath(ON_DECK_HOME_PATH);
  revalidatePath(ON_DECK_SETTINGS_PATH);
  return { ok: true };
}

/**
 * Saves the Club (issue #254, user story 44; issue #515, user story 14). Only
 * the Club owner reaches this — `verifyOrganizer` plus the RPC's own ownership
 * check.
 *
 * Everything the two-field create form guessed is reachable from here: the
 * name it asked for, the venue it copied off that name, and the group cap and
 * Floor Mode nobody was asked about. The clock is the one exception and has its
 * own action, so a form opened to change a court count cannot commit one.
 */
export async function saveClubDefaults(
  input: ClubDefaults,
): Promise<SessionSettingsResult> {
  await verifyOrganizer();

  const named = validateClubName(input.name);
  if (!named.ok) return named;

  // The only one of these values the RPC does not check for itself — the
  // table's own CHECK is the backstop, and it names a constraint rather than
  // a floor mode.
  if (!FLOOR_MODES.includes(input.floorMode)) {
    return { error: "Pick one of the floor modes." };
  }

  const valid = validateFields(input, { date: false, groupCap: true });
  if (!valid.ok) return valid;

  const supabase = await createClient();
  const club = await getOwnedClub(supabase);
  if (!club) return { error: "No club is set up for this account yet." };

  try {
    await updateClubDefaults(supabase, {
      name: named.name,
      venueName: valid.venueName,
      courtCount: valid.courtCount,
      groupCap: valid.groupCap,
      floorMode: input.floorMode,
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

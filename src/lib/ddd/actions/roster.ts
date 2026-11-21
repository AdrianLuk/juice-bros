"use server";

import { revalidatePath } from "next/cache";

import { verifyOrganizer } from "../dal.ts";
import { DDD_ROOT } from "../routes.ts";
import { addPlayer, movePlayer, removePlayer, replaceRoster, updatePlayer } from "../roster-db.ts";
import { canSave, parseRoster, readPlayer, type PlayerFields } from "../roster.ts";
import { createClient } from "../supabase/server.ts";

/**
 * The roster's writes (issue #712). Each is reachable by a direct POST, so
 * each checks the Organizer first; the database checks again under RLS. The
 * paste is parsed again here: the preview is a courtesy, not the check.
 */

export type RosterState = { problem?: string; saved?: boolean };

function refresh() {
  // The Public Link and Score Link show the roster too.
  revalidatePath(DDD_ROOT, "layout");
}

/** Replaces the roster with the pasted rows. The client confirms first when one exists. */
export async function saveRosterAction(eventId: string, text: string): Promise<RosterState> {
  await verifyOrganizer();
  const parsed = parseRoster(String(text ?? ""));
  if (!canSave(parsed)) return { problem: "The paste has problems. Fix them in the sheet and paste again." };
  const saved = await replaceRoster(await createClient(), String(eventId), parsed.teams);
  if (!saved.ok) return { problem: saved.problem };
  refresh();
  return { saved: true };
}

function fieldsOf(formData: FormData): PlayerFields {
  const get = (key: string) => String(formData.get(key) ?? "");
  return { name: get("name"), gender: get("gender"), dupr: get("dupr"), duar: get("duar"), dusr: get("dusr") };
}

/** Saves one player's edits, and moves them when `teamId` names another Team. */
export async function savePlayerAction(
  playerId: string,
  currentTeamId: string,
  _prev: RosterState,
  formData: FormData,
): Promise<RosterState> {
  await verifyOrganizer();
  const read = readPlayer(fieldsOf(formData));
  if ("problem" in read) return { problem: read.problem };
  const supabase = await createClient();
  const teamId = String(formData.get("teamId") ?? currentTeamId);
  if (teamId !== currentTeamId) {
    const moved = await movePlayer(supabase, String(playerId), teamId);
    if (!moved.ok) return { problem: moved.problem };
  }
  await updatePlayer(supabase, String(playerId), read.player);
  refresh();
  return { saved: true };
}

export async function addPlayerAction(teamId: string, _prev: RosterState, formData: FormData): Promise<RosterState> {
  await verifyOrganizer();
  const read = readPlayer(fieldsOf(formData));
  if ("problem" in read) return { problem: read.problem };
  const added = await addPlayer(await createClient(), String(teamId), read.player);
  if (!added.ok) return { problem: added.problem };
  refresh();
  return { saved: true };
}

export async function removePlayerAction(playerId: string): Promise<void> {
  await verifyOrganizer();
  await removePlayer(await createClient(), String(playerId));
  refresh();
}

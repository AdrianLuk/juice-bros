"use server";

import { revalidatePath } from "next/cache";

import { verifyOrganizer } from "../dal.ts";
import { getTeamPlayers, saveLineup } from "../lineup-db.ts";
import { readLineupFields } from "../lineup.ts";
import { DDD_ROOT } from "../routes.ts";
import { createClient } from "../supabase/server.ts";

export type LineupState = { problem?: string; saved?: boolean };

/**
 * Saves one Team's Lineup (issue #713). A broken rule is a warning the page
 * shows, never a refusal, so the only problems here are an id that is not on
 * the Team. Reachable by a direct POST, so it checks the Organizer first.
 */
export async function saveLineupAction(teamId: string, _prev: LineupState, formData: FormData): Promise<LineupState> {
  await verifyOrganizer();
  const supabase = await createClient();
  const players = await getTeamPlayers(supabase, String(teamId));
  if (!players) return { problem: "That Team is gone. Reload the page." };
  const read = readLineupFields(players, (field) => String(formData.get(field) ?? ""));
  if ("problem" in read) return { problem: read.problem };
  await saveLineup(supabase, String(teamId), read.lineup);
  // The Public Link and Score Link show Lineups too.
  revalidatePath(DDD_ROOT, "layout");
  return { saved: true };
}

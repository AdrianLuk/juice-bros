"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifySession } from "../dal.ts";
import { personOptionLabel } from "../connections.ts";
import { SLOTS_PATH, standingGamePath } from "../routes.ts";
import { diffRegulars, parseRegularIds, type RegularChoices } from "../regulars.ts";
import { getGroupsPageData } from "./friend-groups.ts";
import type { ActionResult } from "./result.ts";

/**
 * What the Regulars picker offers the signed-in organizer: their friends, and
 * each Friend Group with members as a one-tap fill (issue #579). Groups with
 * nobody in them are left out, since they would fill nothing.
 */
export async function getRegularChoices(): Promise<RegularChoices> {
  const { groups, friends } = await getGroupsPageData();

  return {
    friends: friends
      .map((person) => ({ userId: person.userId, label: personOptionLabel(person) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    groups: groups
      .map((group) => ({
        id: group.id,
        name: group.name,
        memberIds: group.members.map((member) => member.userId),
      }))
      .filter((group) => group.memberIds.length > 0),
  };
}

/**
 * Save a Standing Game's Regulars from its own page: the ticked list replaces
 * the saved one. Someone who joined by answering yes since the page loaded is
 * kept, because only people the organizer unticked are removed.
 */
export async function setStandingGameRegulars(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await verifySession();

  const standingGameId = String(formData.get("standing_game_id") ?? "").trim();
  if (!standingGameId) {
    return { error: "Which weekly game is this?" };
  }
  const shown = new Set(
    formData.getAll("shown_regular_ids").map((value) => String(value)),
  );

  const supabase = await createClient();
  const { data: rows, error: readError } = await supabase
    .from("standing_game_regulars")
    .select("user_id")
    .eq("standing_game_id", standingGameId);

  if (readError) {
    return { error: "Couldn't save the regulars. Try again." };
  }

  const current = (rows ?? []).map((row) => row.user_id as string);
  const { add, remove } = diffRegulars(current, parseRegularIds(formData));
  // Only remove someone the organizer actually saw and unticked.
  const toRemove = remove.filter((userId) => shown.has(userId));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("standing_game_regulars")
      .delete()
      .eq("standing_game_id", standingGameId)
      .in("user_id", toRemove);
    if (error) {
      return { error: "Couldn't save the regulars. Try again." };
    }
  }

  if (add.length > 0) {
    const { error } = await supabase
      .from("standing_game_regulars")
      .upsert(
        add.map((userId) => ({ standing_game_id: standingGameId, user_id: userId })),
        { onConflict: "standing_game_id,user_id", ignoreDuplicates: true },
      );
    if (error) {
      return { error: "Couldn't save the regulars. Pick from your friends and try again." };
    }
  }

  revalidatePath(SLOTS_PATH);
  revalidatePath(standingGamePath(standingGameId));
  return { ok: true };
}

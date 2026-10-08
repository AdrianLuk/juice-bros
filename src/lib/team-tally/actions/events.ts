"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { verifyOrganizer } from "../dal.ts";
import { deleteTeamEvent, saveTeamEvent } from "../events.ts";
import { TEAM_TALLY_ROOT, teamEventPath } from "../routes.ts";
import { parseSetup, validateSetup } from "../setup.ts";
import { createClient } from "../supabase/server.ts";

export type SetupFormState = { problems?: string[] };

/**
 * Saves the setup form, then shows the Organizer their Brief. The form posts
 * the whole setup as JSON in `setup`, and `eventId` when editing.
 *
 * Reachable by a direct POST, so it checks the Organizer itself; RLS keeps an
 * edit to the Organizer's own Team Events.
 */
export async function saveTeamEventAction(
  _prev: SetupFormState,
  formData: FormData,
): Promise<SetupFormState> {
  await verifyOrganizer();

  const setup = parseSetup(String(formData.get("setup") ?? ""));
  if (!setup) {
    return { problems: ["That form didn't come through. Reload the page and try again."] };
  }

  const validation = validateSetup(setup);
  if (!validation.ok) {
    return { problems: validation.problems };
  }

  const eventId = String(formData.get("eventId") ?? "") || undefined;
  const supabase = await createClient();

  let savedId: string;
  try {
    savedId = await saveTeamEvent(supabase, setup, eventId);
  } catch {
    return { problems: ["Couldn't save the Team Event. Try again."] };
  }

  // Outside the try: redirect works by throwing.
  revalidatePath(TEAM_TALLY_ROOT, "layout");
  redirect(teamEventPath(savedId));
}

/**
 * Deletes a Team Event for good, then sends the Organizer back to their list.
 * The page asks first, in the page (issue #625). Reachable by a direct POST,
 * so it checks the Organizer itself; RLS keeps a delete to their own events.
 */
export async function deleteTeamEventAction(eventId: string): Promise<{ problem: string }> {
  await verifyOrganizer();

  let result: Awaited<ReturnType<typeof deleteTeamEvent>>;
  try {
    result = await deleteTeamEvent(await createClient(), String(eventId));
  } catch {
    return { problem: "Couldn't delete the Team Event. Try again." };
  }
  if (!result.ok) return { problem: result.problem };

  // Outside the try: redirect works by throwing.
  revalidatePath(TEAM_TALLY_ROOT, "layout");
  redirect(TEAM_TALLY_ROOT);
}

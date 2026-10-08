"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { verifyOrganizer } from "../dal.ts";
import { saveTeamEvent } from "../events.ts";
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

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifyOrganizer } from "../dal.ts";
import { getOwnedClub } from "../clubs.ts";
import { getOpenSessionForClub } from "../sessions.ts";
import { ON_DECK_HOME_PATH, sessionPath } from "../routes.ts";

/**
 * Opens tonight's Session from the Club's saved defaults with one tap.
 *
 * The session row and its `SESSION_STARTED` event are written together by the
 * `on_deck_start_session` RPC — one transaction, so a failure never leaves an
 * eventless open Session behind. "Only one open Session per Club" is enforced
 * by a partial unique index; a race-loser's `unique_violation` is turned here
 * into landing on the Session that already opened.
 */
export async function startSession(): Promise<void> {
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

  const { data: sessionId, error } = await supabase.rpc("on_deck_start_session", {
    p_club_id: club.id,
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

"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifyOrganizer } from "../dal.ts";
import { getOwnedClub } from "../clubs.ts";
import { getSession } from "../sessions.ts";
import { sessionPath } from "../routes.ts";

export type FinishCourtResult = { ok: true } | { ok?: false; error: string };

/**
 * "Court N done" (issue #243). Appends a `COURT_FINISHED` event; the
 * `reduceSession` fold re-queues the four coming off and walks the
 * longest-waiting Foursome onto the freed Court.
 *
 * A plain INSERT through the foundation migration's "an Organizer appends
 * events to their own open Session" policy — no RPC. The ownership check here
 * is belt-and-braces on top of RLS, and keeps the Court number in range.
 */
export async function finishCourt(
  sessionId: string,
  court: number,
  /**
   * The `since` the floor screen last saw for this Court. When it no longer
   * matches — a double tap, or a board that was seconds stale — the turnover
   * has already happened, so this is a silent no-op rather than a second
   * `COURT_FINISHED` that yanks a Foursome mid-Game.
   */
  expectedSince: number | null,
): Promise<FinishCourtResult> {
  const organizer = await verifyOrganizer();
  const supabase = await createClient();

  const club = await getOwnedClub(supabase);
  const loaded = await getSession(supabase, sessionId).catch(() => null);
  if (!club || !loaded || loaded.config.clubId !== club.id) {
    return { error: "That session isn't yours to run." };
  }
  if (loaded.status !== "open") {
    return { error: "This session has already wrapped up." };
  }
  if (!Number.isInteger(court) || court < 1 || court > loaded.config.courtCount) {
    return { error: "That court number isn't on this session." };
  }

  const current = loaded.state.courts.find((c) => c.number === court);
  if ((current?.since ?? null) !== expectedSince) {
    // Already turned over since the board rendered — nothing to do.
    return { ok: true };
  }

  const { error } = await supabase.from("on_deck_session_events").insert({
    session_id: sessionId,
    type: "COURT_FINISHED",
    operator_kind: "organizer",
    operator_user_id: organizer.userId,
    payload: { court },
  });

  if (error) {
    console.error("on-deck: finishing a Court failed", error);
    return { error: "Couldn't end that game. Try again." };
  }

  revalidatePath(sessionPath(sessionId));
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifyOrganizer } from "../dal.ts";
import { getOwnedClub } from "../clubs.ts";
import { getSession } from "../sessions.ts";
import { sessionPath } from "../routes.ts";

export type FloorActionResult = { ok: true } | { ok?: false; error: string };
export type FinishCourtResult = FloorActionResult;

/**
 * Load the Organizer's own open Session, or an error. Every operational floor
 * action starts here — the ownership check is belt-and-braces on top of RLS.
 */
type OwnedSession = {
  organizer: Awaited<ReturnType<typeof verifyOrganizer>>;
  supabase: Awaited<ReturnType<typeof createClient>>;
  loaded: NonNullable<Awaited<ReturnType<typeof getSession>>>;
};

async function loadOwnedOpenSession(
  sessionId: string,
): Promise<OwnedSession | { error: string }> {
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
  return { organizer, supabase, loaded };
}

/** Resolve a display name to its roster token — display names are unique
 * within a Session (the fold disambiguates same-name Players with a suffix). */
function tokenForName(
  loaded: { state: { roster: { id: string; displayName: string }[] } },
  name: string,
): string | null {
  const trimmed = name?.trim() ?? "";
  return (
    loaded.state.roster.find((p) => p.displayName === trimmed)?.id ?? null
  );
}

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

/**
 * "Set aside" (issue #246, door 3): an Operator stands a Player down — clearly
 * gone home, or asked to sit out. Appends `PLAYER_PAUSED` (reason `set-aside`);
 * the fold pulls them from the Queue and any On Deck Foursome and holds their
 * Wait Time.
 */
export async function setPlayerAside(
  sessionId: string,
  playerName: string,
): Promise<FloorActionResult> {
  const owned = await loadOwnedOpenSession(sessionId);
  if ("error" in owned) return owned;
  const { organizer, supabase, loaded } = owned;

  const token = tokenForName(loaded, playerName);
  if (!token) return { error: "Couldn't find that player." };

  const { error } = await supabase.from("on_deck_session_events").insert({
    session_id: sessionId,
    type: "PLAYER_PAUSED",
    operator_kind: "organizer",
    operator_user_id: organizer.userId,
    payload: { token, reason: "set-aside" },
  });
  if (error) {
    console.error("on-deck: setting a Player aside failed", error);
    return { error: "Couldn't set that player aside. Try again." };
  }

  revalidatePath(sessionPath(sessionId));
  return { ok: true };
}

/**
 * "Back in the queue" (issue #246): an Operator re-adds a paused Player.
 * Appends `PLAYER_REQUEUED`; the fold restores their accrued Wait Time.
 */
export async function bringPlayerBack(
  sessionId: string,
  playerName: string,
): Promise<FloorActionResult> {
  const owned = await loadOwnedOpenSession(sessionId);
  if ("error" in owned) return owned;
  const { organizer, supabase, loaded } = owned;

  const token = tokenForName(loaded, playerName);
  if (!token) return { error: "Couldn't find that player." };

  const { error } = await supabase.from("on_deck_session_events").insert({
    session_id: sessionId,
    type: "PLAYER_REQUEUED",
    operator_kind: "organizer",
    operator_user_id: organizer.userId,
    payload: { token },
  });
  if (error) {
    console.error("on-deck: re-queueing a Player failed", error);
    return { error: "Couldn't add that player back. Try again." };
  }

  revalidatePath(sessionPath(sessionId));
  return { ok: true };
}

/**
 * The no-show swap (issue #246, door 2): the Organizer taps a called Player who
 * didn't appear and names a replacement standing there. Appends
 * `FOURSOME_MEMBER_SWAPPED` — the fold pauses `out` (reason `no-show`, Wait
 * Time held) and seats `in` on the Court without restarting the Game.
 *
 * `expectedSince` guards a stale board the same way `finishCourt` does: if the
 * Court has turned over since it rendered, the swap no longer applies.
 */
export async function swapNoShow(
  sessionId: string,
  court: number,
  expectedSince: number | null,
  outName: string,
  inName: string,
): Promise<FloorActionResult> {
  const owned = await loadOwnedOpenSession(sessionId);
  if ("error" in owned) return owned;
  const { organizer, supabase, loaded } = owned;

  const current = loaded.state.courts.find((c) => c.number === court);
  if (!current || current.foursome.length === 0) {
    return { error: "That court isn't in play." };
  }
  if ((current.since ?? null) !== expectedSince) {
    // The Court turned over since the board rendered — the Foursome the
    // Organizer was looking at is gone, so say so rather than silently
    // reporting a swap that never happened.
    return { error: "That court already turned over — nothing to swap." };
  }

  const outToken = tokenForName(loaded, outName);
  const inToken = tokenForName(loaded, inName);
  if (!outToken || !current.foursome.includes(outToken)) {
    return { error: "That player isn't on this court." };
  }
  if (!inToken || !loaded.state.queue.some((e) => e.playerId === inToken)) {
    return { error: "That replacement isn't waiting anymore." };
  }

  const { error } = await supabase.from("on_deck_session_events").insert({
    session_id: sessionId,
    type: "FOURSOME_MEMBER_SWAPPED",
    operator_kind: "organizer",
    operator_user_id: organizer.userId,
    payload: { court, out: outToken, in: inToken },
  });
  if (error) {
    console.error("on-deck: swapping a no-show failed", error);
    return { error: "Couldn't make that swap. Try again." };
  }

  revalidatePath(sessionPath(sessionId));
  return { ok: true };
}

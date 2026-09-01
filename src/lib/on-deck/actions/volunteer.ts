"use server";

import { createClient } from "../supabase/server.ts";
import { loadVolunteerSession } from "../volunteer.ts";
import {
  commitFloorOutcome,
  runUndo,
  type FloorActionResult,
} from "../floor-commit.ts";
import {
  addWalkupOutcome,
  bringBackOutcome,
  finishCourtOutcome,
  overrideSkillOutcome,
  setAsideOutcome,
  swapNoShowOutcome,
  type FloorOpOutcome,
} from "../floor-ops.ts";
import type { SessionState } from "../session/types.ts";

export type { FloorActionResult } from "../floor-commit.ts";

const LINK_DEAD = "This volunteer link isn't active anymore.";

/**
 * Every volunteer floor action: re-check the link token, decide the outcome
 * over the folded board (the same `floor-ops` rules the Organizer runs), then
 * append through `on_deck_volunteer_append` — the one write path that stamps
 * `operator_kind = 'volunteer'` and enforces the volunteer scope in the
 * database (issue #248), not just by hiding controls.
 */
async function volunteerAppend(
  sessionId: string,
  token: string,
  decide: (state: SessionState) => FloorOpOutcome,
): Promise<FloorActionResult> {
  const loaded = await loadVolunteerSession(sessionId, token);
  if (!loaded) return { error: LINK_DEAD };

  return commitFloorOutcome(sessionId, decide(loaded.state), async (event) => {
    const supabase = await createClient();
    const { error } = await supabase.rpc("on_deck_volunteer_append", {
      p_session_id: sessionId,
      p_token: token.trim(),
      p_type: event.type,
      p_payload: event.payload,
    });
    return { error };
  });
}

/** "Court N done" / "Send next four", fired by a link-authenticated Volunteer. */
export async function volunteerFinishCourt(
  sessionId: string,
  token: string,
  court: number,
  expectedSince: number | null,
): Promise<FloorActionResult> {
  return volunteerAppend(sessionId, token, (state) =>
    finishCourtOutcome(state, court, expectedSince),
  );
}

/** "Set aside" a waiting Player. */
export async function volunteerSetPlayerAside(
  sessionId: string,
  token: string,
  playerName: string,
): Promise<FloorActionResult> {
  return volunteerAppend(sessionId, token, (state) =>
    setAsideOutcome(state, playerName),
  );
}

/** "Back in the queue" for a Player who was set aside. */
export async function volunteerBringPlayerBack(
  sessionId: string,
  token: string,
  playerName: string,
): Promise<FloorActionResult> {
  return volunteerAppend(sessionId, token, (state) =>
    bringBackOutcome(state, playerName),
  );
}

/** "Add a walk-up" Player (issue #249), fired by a link-authenticated Volunteer. */
export async function volunteerAddWalkup(
  sessionId: string,
  token: string,
  firstName: string,
  lastInitial: string,
  skillLevel: string,
): Promise<FloorActionResult> {
  const walkupToken = `walkup-${crypto.randomUUID()}`;
  return volunteerAppend(sessionId, token, (state) =>
    addWalkupOutcome(state, walkupToken, firstName, lastInitial, skillLevel),
  );
}

/** "Fix a skill level" on any Player (issue #249). */
export async function volunteerOverridePlayerSkill(
  sessionId: string,
  token: string,
  playerName: string,
  skillLevel: string,
): Promise<FloorActionResult> {
  return volunteerAppend(sessionId, token, (state) =>
    overrideSkillOutcome(state, playerName, skillLevel),
  );
}

/** The no-show swap on an in-play Court. */
export async function volunteerSwapNoShow(
  sessionId: string,
  token: string,
  court: number,
  expectedSince: number | null,
  outName: string,
  inName: string,
): Promise<FloorActionResult> {
  return volunteerAppend(sessionId, token, (state) =>
    swapNoShowOutcome(state, court, expectedSince, outName, inName),
  );
}

/**
 * "Undo" fired by a link-authenticated Volunteer (issue #247). Same
 * `on_deck_undo_last_event` path the Organizer takes, with the token carried
 * back so the database re-checks the volunteer scope.
 */
export async function volunteerUndoLastAction(
  sessionId: string,
  token: string,
  expectedSeq: number,
): Promise<FloorActionResult> {
  const loaded = await loadVolunteerSession(sessionId, token);
  if (!loaded) return { error: LINK_DEAD };
  return runUndo(await createClient(), sessionId, expectedSeq, token.trim());
}

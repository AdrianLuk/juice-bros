"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { loadVolunteerSession } from "../volunteer.ts";
import { sessionPath } from "../routes.ts";
import {
  commitFloorOutcome,
  rpcAppend,
  runUndo,
  type FloorActionResult,
} from "../floor-commit.ts";
import {
  dispatchFloorCommand,
  mintFloorIds,
  type FloorCommand,
} from "../floor-commands.ts";

export type { FloorActionResult } from "../floor-commit.ts";

const LINK_DEAD = "This volunteer link isn't active anymore.";

/**
 * Every volunteer floor tap (issue #612): re-check the link token, decide the
 * command over the folded board through `dispatchFloorCommand` (the same rules
 * the Organizer runs), then append through `on_deck_volunteer_append` — the
 * one write path that stamps `operator_kind = 'volunteer'` and enforces the
 * volunteer scope in the database (issue #248), not just by hiding controls.
 * Last Call keeps its own RPC.
 */
export async function volunteerFloorCommand(
  sessionId: string,
  token: string,
  command: FloorCommand,
): Promise<FloorActionResult> {
  const loaded = await loadVolunteerSession(sessionId, token);
  if (!loaded) return { error: LINK_DEAD };

  const outcome = dispatchFloorCommand(
    loaded.state,
    "volunteer",
    command,
    mintFloorIds(),
  );
  // Close is the Organizer's alone, so the one wrap-up event left is Last Call.
  if (outcome.kind === "event") return runLastCall(sessionId, token);

  return commitFloorOutcome(
    sessionId,
    outcome,
    rpcAppend("on_deck_volunteer_append", sessionId, {
      p_token: token.trim(),
    }),
    loaded.state,
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

/**
 * "Last Call" fired by a link-authenticated Volunteer (issue #255). Goes
 * through `on_deck_last_call` with the token carried back so the database
 * re-checks the volunteer scope.
 */
async function runLastCall(
  sessionId: string,
  token: string,
): Promise<FloorActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("on_deck_last_call", {
    p_session_id: sessionId,
    p_volunteer_token: token.trim(),
  });
  if (error) {
    console.error("on-deck: volunteer last call failed", error);
    if (error.code === "42501") return { error: LINK_DEAD };
    return { error: "Couldn't call it. Try again." };
  }

  revalidatePath(sessionPath(sessionId));
  return { ok: true };
}

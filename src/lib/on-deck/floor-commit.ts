import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { sessionPath } from "./routes.ts";
import type { FloorOutcomeType, FloorOpOutcome } from "./floor-ops.ts";

/** `{ ok: true }` on success (an appended event or a harmless no-op), or an
 * error string for the floor screen to show. */
export type FloorActionResult = { ok: true } | { ok?: false; error: string };

/**
 * The tail every floor action shares once `floor-ops` has decided the outcome:
 * surface an `error`, treat a `noop` as success, otherwise run the caller's
 * write and revalidate. The write differs by Operator — a direct INSERT for the
 * Organizer, the `on_deck_volunteer_append` RPC for a link-authenticated
 * Volunteer (ADR 0005) — so it is passed in.
 */
export async function commitFloorOutcome(
  sessionId: string,
  outcome: FloorOpOutcome,
  write: (event: {
    type: FloorOutcomeType;
    payload: Record<string, unknown>;
  }) => Promise<{ error: unknown }>,
): Promise<FloorActionResult> {
  if (outcome.kind === "error") return { error: outcome.error };
  if (outcome.kind === "noop") return { ok: true };

  const { error } = await write({ type: outcome.type, payload: outcome.payload });
  if (error) {
    console.error("on-deck: floor action failed", outcome.type, error);
    return { error: "That didn't go through. Try again." };
  }

  revalidatePath(sessionPath(sessionId));
  return { ok: true };
}

/**
 * "Undo" (issue #247), for either Operator: call `on_deck_undo_last_event` and
 * map its outcome to a floor-screen result. The auth-load differs (the owning
 * Organizer's client, or a link Volunteer's plus the token), so the caller
 * passes the client it already has; everything downstream is shared.
 *
 * Errors map to fixed client strings the way `commitFloorOutcome` does — the
 * RPC's own `raise` messages stay in the (append-only) migration for the log,
 * never rendered to a user.
 */
export async function runUndo(
  supabase: SupabaseClient,
  sessionId: string,
  expectedSeq: number,
  volunteerToken?: string,
): Promise<FloorActionResult> {
  const { error } = await supabase.rpc("on_deck_undo_last_event", {
    p_session_id: sessionId,
    p_expected_seq: expectedSeq,
    ...(volunteerToken ? { p_volunteer_token: volunteerToken } : {}),
  });

  if (error) {
    if (error.code === "40001") {
      return {
        error: "Someone else changed the board since you looked. Take another look.",
      };
    }
    if (error.code === "22023") {
      return { error: "There's nothing recent to undo." };
    }
    if (error.code === "42501") {
      return { error: "This isn't yours to undo." };
    }
    console.error("on-deck: undo failed", error);
    return { error: "Couldn't undo that. Try again." };
  }

  revalidatePath(sessionPath(sessionId));
  return { ok: true };
}

import "server-only";

import { revalidatePath } from "next/cache";

import { sessionPath } from "./routes.ts";
import type { FloorEventType, FloorOpOutcome } from "./floor-ops.ts";

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
    type: FloorEventType;
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
 * Turn an `on_deck_undo_last_event` RPC error into a floor-screen result (#247).
 * `40001` is a concurrent Operator — the log moved since the caller looked;
 * `22023` / `42501` carry a message written to be shown as-is.
 */
export function undoResult(
  error: { code?: string; message?: string } | null,
  sessionId: string,
): FloorActionResult {
  if (error) {
    if (error.code === "40001") {
      return {
        error: "Someone else changed the board since you looked. Take another look.",
      };
    }
    if (error.code === "22023" || error.code === "42501") {
      return { error: capitalise(error.message ?? "That can't be undone.") };
    }
    console.error("on-deck: undo failed", error);
    return { error: "Couldn't undo that. Try again." };
  }
  revalidatePath(sessionPath(sessionId));
  return { ok: true };
}

function capitalise(sentence: string): string {
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

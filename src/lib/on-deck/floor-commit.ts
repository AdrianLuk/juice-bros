import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { sessionPath } from "./routes.ts";
import { encode } from "./session/codec.ts";
import { createClient } from "./supabase/server.ts";
import { dispatchTurnNotifications } from "./turn-notify-dispatch.ts";
import type { FloorOpOutcome } from "./floor-ops.ts";
import type { EventBody, SessionState } from "./session/types.ts";

/** `{ ok: true }` on success (an appended event or a harmless no-op), or an
 * error string for the floor screen to show. */
export type FloorActionResult = { ok: true } | { ok?: false; error: string };

/**
 * The tail every floor action shares once `floor-ops` has decided the outcome:
 * surface an `error`, treat a `noop` as success, otherwise run the caller's
 * write and revalidate. The write differs by Operator — the Supabase event
 * log's `append` for the Organizer, the `on_deck_volunteer_append` /
 * `on_deck_kiosk_append` RPC (the body `encode`d) for a link-authenticated
 * Volunteer or a Kiosk (ADR 0005) — so it is passed in.
 */
export async function commitFloorOutcome(
  sessionId: string,
  outcome: FloorOpOutcome,
  write: (body: EventBody) => Promise<{ error: unknown }>,
  /**
   * The folded `SessionState` from *before* this write. When given, a
   * successful append fires the opt-in turn notification (issue #260): the
   * dispatch re-folds the Session and pushes any Player whose Foursome just
   * entered On Deck or was assigned a Court. Omitted by callers whose event
   * can't move a Foursome (none currently) and by tests.
   */
  beforeState?: SessionState,
): Promise<FloorActionResult> {
  if (outcome.kind === "error") return { error: outcome.error };
  if (outcome.kind === "noop") return { ok: true };

  const { error } = await write(outcome.body);
  if (error) {
    console.error("on-deck: floor action failed", outcome.body.type, error);
    return { error: "That didn't go through. Try again." };
  }

  revalidatePath(sessionPath(sessionId));
  if (beforeState) {
    // Never throws — a push hiccup must not fail the operational action.
    await dispatchTurnNotifications(beforeState, sessionId);
  }
  return { ok: true };
}

/** The `write` for a credential whose own RPC stamps the Operator and checks
 * its scope: `encode` the body, then `rpc` with that credential's own args. */
export function rpcAppend(rpc: string, sessionId: string, credential = {}) {
  return async (body: EventBody) => {
    const event = encode(body);
    const { error } = await (await createClient()).rpc(rpc, {
      p_session_id: sessionId,
      ...credential,
      p_type: event.type,
      p_payload: event.payload,
    });
    return { error };
  };
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
  /** The caller is a courtside Kiosk (issue #259) — no account, no token. The
   * RPC then authorizes on Floor Mode alone (`self-serve` / `hybrid`). */
  kiosk?: boolean,
): Promise<FloorActionResult> {
  const { error } = await supabase.rpc("on_deck_undo_last_event", {
    p_session_id: sessionId,
    p_expected_seq: expectedSeq,
    ...(volunteerToken ? { p_volunteer_token: volunteerToken } : {}),
    ...(kiosk ? { p_kiosk: true } : {}),
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

"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { trackFirstSessionClosed } from "../analytics.ts";
import { loadOwnedSession, type Owned } from "../owned-session.ts";
import type { LoadedSession } from "../sessions.ts";
import { sessionPath, floorPath } from "../routes.ts";
import { projectSummary } from "../session/summary.ts";
import { supabaseEventLog } from "../supabase/event-log.ts";
import {
  commitFloorOutcome,
  runUndo,
  type FloorActionResult,
} from "../floor-commit.ts";
import {
  dispatchFloorCommand,
  mintFloorIds,
  type FloorCommand,
} from "../floor-commands.ts";

export type { FloorActionResult } from "../floor-commit.ts";

type OwnedSession = Owned<LoadedSession>;

/**
 * Load the Organizer's own open Session, or the result to return instead.
 * Every operational floor action starts here; the ownership check lives in
 * `../owned-session.ts`. A closed Session returns `whenClosed`.
 */
async function loadOwnedOpenSession(
  sessionId: string,
  whenClosed: FloorActionResult = {
    error: "This session has already wrapped up.",
  },
): Promise<OwnedSession | FloorActionResult> {
  const owned = await loadOwnedSession(sessionId);
  if (!owned) return { error: "That session isn't yours to run." };
  return owned.loaded.status === "open" ? owned : whenClosed;
}

/**
 * Every Organizer floor tap (issue #612): decide the command over the folded
 * board through `dispatchFloorCommand`, then append the event through the
 * Supabase event log, a plain INSERT under the foundation's "an Organizer
 * appends events to their own open Session" policy. A link-authenticated
 * Volunteer takes the same decision to `on_deck_volunteer_append` instead
 * (`actions/volunteer.ts`).
 *
 * Last Call and close Session keep their own RPCs, and on an already-closed
 * Session they are moot rather than an error (a stale board, a double tap
 * after close, a retry after a dropped response).
 */
export async function organizerFloorCommand(
  sessionId: string,
  command: FloorCommand,
): Promise<FloorActionResult> {
  const wrapUp =
    command?.kind === "lastCall" || command?.kind === "closeSession";
  const owned = await loadOwnedOpenSession(
    sessionId,
    wrapUp ? { ok: true } : undefined,
  );
  if (!("loaded" in owned)) return owned;

  const outcome = dispatchFloorCommand(
    owned.loaded.state,
    "organizer",
    command,
    mintFloorIds(),
  );
  if (outcome.kind === "wrapUp") {
    return outcome.body.type === "LAST_CALL"
      ? runLastCall(owned, sessionId)
      : runClose(owned, sessionId);
  }

  const log = supabaseEventLog(owned.supabase);
  return commitFloorOutcome(
    sessionId,
    outcome,
    async (body) => {
      try {
        await log.append(sessionId, body, {
          kind: "organizer",
          userId: owned.organizer.userId,
        });
        return { error: null };
      } catch (error) {
        return { error };
      }
    },
    owned.loaded.state,
  );
}

/**
 * "Undo" (issue #247): drop the most recent event and let every surface re-fold
 * to the prior state. `expectedSeq` is the `seq` the floor screen last saw as
 * the latest — if another Operator has appended or undone since, the RPC
 * refuses (`40001`) rather than silently drop the wrong row.
 */
export async function undoLastAction(
  sessionId: string,
  expectedSeq: number,
): Promise<FloorActionResult> {
  const owned = await loadOwnedOpenSession(sessionId);
  if (!("loaded" in owned)) return owned;
  return runUndo(owned.supabase, sessionId, expectedSeq);
}

/**
 * "Last Call" (issue #255), fired by the Organizer. Appends `LAST_CALL` through
 * `on_deck_last_call`; the fold then assigns no new Foursomes and forms no new
 * On Deck ones, while Games on Courts finish normally. Idempotent — a second
 * tap is a no-op.
 */
async function runLastCall(
  owned: OwnedSession,
  sessionId: string,
): Promise<FloorActionResult> {
  const { error } = await owned.supabase.rpc("on_deck_last_call", {
    p_session_id: sessionId,
  });
  if (error) {
    console.error("on-deck: last call failed", error);
    if (error.code === "42501") return { error: "That session isn't yours to call." };
    return { error: "Couldn't call it. Try again." };
  }

  revalidatePath(sessionPath(sessionId));
  revalidatePath(floorPath(sessionId));
  return { ok: true };
}

/**
 * "Close the session" (issue #255), the Organizer's alone. Projects the
 * permanent anonymous Session Summary from the fold, then
 * `on_deck_close_session` stores it, flips the Session to `closed`, and purges
 * the event log and Player roster (ADR 0001) in one transaction. Idempotent on
 * an already-closed Session.
 */
async function runClose(
  owned: OwnedSession,
  sessionId: string,
): Promise<FloorActionResult> {
  const summary = projectSummary(owned.loaded.config, owned.loaded.events);

  const { error } = await owned.supabase.rpc("on_deck_close_session", {
    p_session_id: sessionId,
    p_summary: summary,
  });
  if (error) {
    console.error("on-deck: close session failed", error);
    if (error.code === "42501") return { error: "That session isn't yours to close." };
    return { error: "Couldn't close the session. Try again." };
  }

  revalidatePath(sessionPath(sessionId));
  revalidatePath(floorPath(sessionId));
  // The Organizer ran the night to its end and said so, as against the
  // Session that closed itself six hours after going quiet (issue #516).
  // `auto: false` is what tells those two apart when the funnel is read.
  after(() =>
    trackFirstSessionClosed(owned.supabase, owned.loaded.config.clubId, false),
  );
  return { ok: true };
}

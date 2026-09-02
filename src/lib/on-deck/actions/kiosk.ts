"use server";

import { createClient } from "../supabase/server.ts";
import { loadKioskSession } from "../kiosk.ts";
import {
  commitFloorOutcome,
  runUndo,
  type FloorActionResult,
} from "../floor-commit.ts";
import {
  addWalkupOutcome,
  confirmCourtOutcome,
  finishCourtOutcome,
  swapNoShowOutcome,
  type FloorOpOutcome,
} from "../floor-ops.ts";
import type { SessionState } from "../session/types.ts";

export type { FloorActionResult } from "../floor-commit.ts";

const KIOSK_OFF = "The kiosk isn't available for this session right now.";

/**
 * Every Kiosk floor action (issue #259): re-check that the Kiosk is available
 * for this Session, decide the outcome over the folded board (the same
 * `floor-ops` rules every Operator runs — ADR 0005), then append through
 * `on_deck_kiosk_append` — the one write path that stamps
 * `operator_kind = 'kiosk'` and enforces the Kiosk scope in the database.
 *
 * The Kiosk has no token: the Session id in the URL is its whole credential,
 * and `on_deck_check_kiosk_access` gates on Floor Mode. Anyone courtside can
 * tap — accepted (ADR 0005): a friendly social, Undo covers mistaps, the
 * Organizer keeps override.
 */
async function kioskAppend(
  sessionId: string,
  decide: (state: SessionState) => FloorOpOutcome,
): Promise<FloorActionResult> {
  const loaded = await loadKioskSession(sessionId);
  if (!loaded) return { error: KIOSK_OFF };

  return commitFloorOutcome(
    sessionId,
    decide(loaded.state),
    async (event) => {
      const supabase = await createClient();
      const { error } = await supabase.rpc("on_deck_kiosk_append", {
        p_session_id: sessionId,
        p_type: event.type,
        p_payload: event.payload,
      });
      return { error };
    },
    // The Kiosk is the self-serve floor with no Volunteer calling names — the
    // exact case the opt-in turn notification (issue #260) exists for. A
    // Kiosk "Court done" that moves a Foursome On Deck or onto a Court fires
    // the push.
    loaded.state,
  );
}

/** "Court N done" fired at the Kiosk — identical fold to a Volunteer's tap. */
export async function kioskFinishCourt(
  sessionId: string,
  court: number,
  expectedSince: number | null,
): Promise<FloorActionResult> {
  return kioskAppend(sessionId, (state) =>
    finishCourtOutcome(state, court, expectedSince),
  );
}

/**
 * "A player short" at the Kiosk: the three who showed up flag the missing
 * fourth by name and the app pulls a Match Me replacement into the Foursome
 * (reuses the no-show swap, issue #246). `inName` is the suggested replacement
 * the Kiosk pre-fills from `RotationView.courts[].suggestedReplacement`.
 */
export async function kioskSwapNoShow(
  sessionId: string,
  court: number,
  expectedSince: number | null,
  outName: string,
  inName: string,
): Promise<FloorActionResult> {
  return kioskAppend(sessionId, (state) =>
    swapNoShowOutcome(state, court, expectedSince, outName, inName),
  );
}

/**
 * "Add me" at the Kiosk (issue #259): a walk-up with no phone enters their name,
 * last initial, and Skill Level and lands in the Session and the Queue exactly
 * like a self-registered Player (reuses the walk-up flow, issue #249).
 */
export async function kioskAddWalkup(
  sessionId: string,
  firstName: string,
  lastInitial: string,
  skillLevel: string,
): Promise<FloorActionResult> {
  const token = `walkup-${crypto.randomUUID()}`;
  return kioskAppend(sessionId, (state) =>
    addWalkupOutcome(state, token, firstName, lastInitial, skillLevel),
  );
}

/**
 * The idle-court nudge's "yes, Court N is still going" tap (issue #259). Pushes
 * the next nudge out by roughly another Game length. `expectedSince` guards
 * against confirming a Game that has already turned over.
 */
export async function kioskConfirmCourt(
  sessionId: string,
  court: number,
  expectedSince: number | null,
): Promise<FloorActionResult> {
  return kioskAppend(sessionId, (state) =>
    confirmCourtOutcome(state, court, expectedSince),
  );
}

/**
 * "Undo" fired at the Kiosk (issue #247, #259). Same `on_deck_undo_last_event`
 * path the Organizer and Volunteer take, with `p_kiosk` set so the database
 * authorizes on Floor Mode (`self-serve` / `hybrid`) rather than an account or
 * a link token.
 */
export async function kioskUndoLastAction(
  sessionId: string,
  expectedSeq: number,
): Promise<FloorActionResult> {
  const loaded = await loadKioskSession(sessionId);
  if (!loaded) return { error: KIOSK_OFF };
  return runUndo(await createClient(), sessionId, expectedSeq, undefined, true);
}

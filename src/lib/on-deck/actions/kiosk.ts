"use server";

import { createClient } from "../supabase/server.ts";
import { loadKioskSession } from "../kiosk.ts";
import {
  commitFloorOutcome,
  runUndo,
  type FloorActionResult,
} from "../floor-commit.ts";
import {
  dispatchFloorCommand,
  FLOOR_COMMAND_REFUSED,
  mintFloorIds,
  type FloorCommand,
} from "../floor-commands.ts";
import { encode } from "../session/codec.ts";

export type { FloorActionResult } from "../floor-commit.ts";

const KIOSK_OFF = "The kiosk isn't available for this session right now.";

/**
 * Every Kiosk floor tap (issues #259, #612): re-check that the Kiosk is
 * available for this Session, decide the command over the folded board
 * through `dispatchFloorCommand` (the same rules every Operator runs — ADR
 * 0005), then append through `on_deck_kiosk_append` — the one write path that
 * stamps `operator_kind = 'kiosk'` and enforces the Kiosk scope in the
 * database. The Kiosk may send: Court done, a player short, add me, and the
 * idle-court nudge's "still going".
 *
 * The Kiosk has no token: the Session id in the URL is its whole credential,
 * and `on_deck_check_kiosk_access` gates on Floor Mode. Anyone courtside can
 * tap — accepted (ADR 0005): a friendly social, Undo covers mistaps, the
 * Organizer keeps override.
 */
export async function kioskFloorCommand(
  sessionId: string,
  command: FloorCommand,
): Promise<FloorActionResult> {
  const loaded = await loadKioskSession(sessionId);
  if (!loaded) return { error: KIOSK_OFF };

  const outcome = dispatchFloorCommand(
    loaded.state,
    "kiosk",
    command,
    mintFloorIds(),
  );
  // Neither wrap-up is the Kiosk's, so the dispatcher never hands it one.
  if (outcome.kind === "event") return { error: FLOOR_COMMAND_REFUSED };

  return commitFloorOutcome(
    sessionId,
    outcome,
    async (body) => {
      const event = encode(body);
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

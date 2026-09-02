"use server";

import { createClient } from "../supabase/server.ts";
import { verifyOrganizer } from "../dal.ts";
import { getOwnedClub } from "../clubs.ts";
import { getSession } from "../sessions.ts";
import {
  commitFloorOutcome,
  runUndo,
  type FloorActionResult,
} from "../floor-commit.ts";
import {
  addWalkupOutcome,
  bringBackOutcome,
  dissolveGroupOutcome,
  finishCourtOutcome,
  formGroupOutcome,
  lowerGroupCapOutcome,
  overrideSkillOutcome,
  setAsideOutcome,
  swapNoShowOutcome,
  type FloorOpOutcome,
} from "../floor-ops.ts";

export type { FloorActionResult } from "../floor-commit.ts";
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

/**
 * Run a `floor-ops` decision as the Organizer: append the event with a plain
 * INSERT under the foundation's "an Organizer appends events to their own open
 * Session" policy. A link-authenticated Volunteer takes the same outcome to
 * `on_deck_volunteer_append` instead (`actions/volunteer.ts`).
 */
async function runAsOrganizer(
  sessionId: string,
  decide: (owned: OwnedSession) => FloorOpOutcome,
): Promise<FloorActionResult> {
  const owned = await loadOwnedOpenSession(sessionId);
  if ("error" in owned) return owned;

  return commitFloorOutcome(sessionId, decide(owned), async (event) => {
    const { error } = await owned.supabase
      .from("on_deck_session_events")
      .insert({
        session_id: sessionId,
        type: event.type,
        operator_kind: "organizer",
        operator_user_id: owned.organizer.userId,
        payload: event.payload,
      });
    return { error };
  });
}

/**
 * "Court N done" (issue #243). Appends a `COURT_FINISHED` event; the
 * `reduceSession` fold re-queues the four coming off and walks the
 * longest-waiting Foursome onto the freed Court.
 *
 * `expectedSince` is the `since` the floor screen last saw for this Court — a
 * mismatch (a double tap, a stale board) makes this a silent no-op rather than
 * a second `COURT_FINISHED`.
 */
export async function finishCourt(
  sessionId: string,
  court: number,
  expectedSince: number | null,
): Promise<FinishCourtResult> {
  return runAsOrganizer(sessionId, ({ loaded }) =>
    finishCourtOutcome(loaded.state, court, expectedSince),
  );
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
  return runAsOrganizer(sessionId, ({ loaded }) =>
    setAsideOutcome(loaded.state, playerName),
  );
}

/**
 * "Back in the queue" (issue #246): an Operator re-adds a paused Player.
 * Appends `PLAYER_REQUEUED`; the fold restores their accrued Wait Time.
 */
export async function bringPlayerBack(
  sessionId: string,
  playerName: string,
): Promise<FloorActionResult> {
  return runAsOrganizer(sessionId, ({ loaded }) =>
    bringBackOutcome(loaded.state, playerName),
  );
}

/**
 * "Add a walk-up" (issue #249): the Organizer enters a Player with no phone —
 * name, last initial, Skill Level. Appends `PLAYER_JOINED` with a synthetic id
 * and `queueOnJoin`, so the fold drops them into the Session and the Queue
 * exactly like a self-registered Player.
 */
export async function addWalkup(
  sessionId: string,
  firstName: string,
  lastInitial: string,
  skillLevel: string,
): Promise<FloorActionResult> {
  const token = `walkup-${crypto.randomUUID()}`;
  return runAsOrganizer(sessionId, ({ loaded }) =>
    addWalkupOutcome(loaded.state, token, firstName, lastInitial, skillLevel),
  );
}

/**
 * "Fix a skill level" (issue #249): the Organizer corrects an obviously wrong
 * self-rating on any Player. Appends `PLAYER_SKILL_SET`; Match Me uses the
 * corrected level on its next selection.
 */
export async function overridePlayerSkill(
  sessionId: string,
  playerName: string,
  skillLevel: string,
): Promise<FloorActionResult> {
  return runAsOrganizer(sessionId, ({ loaded }) =>
    overrideSkillOutcome(loaded.state, playerName, skillLevel),
  );
}

/**
 * The no-show swap (issue #246, door 2): the Organizer taps a called Player who
 * didn't appear and names a replacement standing there. Appends
 * `FOURSOME_MEMBER_SWAPPED` — the fold pauses `out` (reason `no-show`, Wait
 * Time held) and seats `in` on the Court without restarting the Game.
 */
export async function swapNoShow(
  sessionId: string,
  court: number,
  expectedSince: number | null,
  outName: string,
  inName: string,
): Promise<FloorActionResult> {
  return runAsOrganizer(sessionId, ({ loaded }) =>
    swapNoShowOutcome(loaded.state, court, expectedSince, outName, inName),
  );
}

/**
 * "Queue together" (issue #250): the Organizer forms a Group from 2 to the live
 * cap waiting Players who asked to play together. Appends `GROUP_FORMED` with a
 * server-minted `group-<uuid>`; the fold queues them as one unit at their
 * median Wait Time and fills a short Group to four via Match Me.
 */
export async function formGroup(
  sessionId: string,
  playerNames: string[],
): Promise<FloorActionResult> {
  const groupId = `group-${crypto.randomUUID()}`;
  return runAsOrganizer(sessionId, ({ loaded }) =>
    formGroupOutcome(loaded.state, playerNames, groupId),
  );
}

/**
 * "Break up this group" (issue #251): the Organizer dissolves a waiting Group.
 * Appends `GROUP_DISSOLVED`; the fold drops the Group and its members re-sort as
 * solos. A no-op for a Group already on a Court.
 */
export async function dissolveGroup(
  sessionId: string,
  groupId: string,
): Promise<FloorActionResult> {
  return runAsOrganizer(sessionId, ({ loaded }) =>
    dissolveGroupOutcome(loaded.state, groupId),
  );
}

/**
 * "Lower the group cap" (issue #250): the Organizer trims the live cap. Appends
 * `GROUP_CAP_CHANGED`; existing larger Groups are untouched.
 */
export async function lowerGroupCap(
  sessionId: string,
  cap: number,
): Promise<FloorActionResult> {
  return runAsOrganizer(sessionId, ({ loaded }) =>
    lowerGroupCapOutcome(loaded.state, cap),
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
  if ("error" in owned) return owned;
  return runUndo(owned.supabase, sessionId, expectedSeq);
}

"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { getSession } from "../sessions.ts";
import { sessionPath } from "../routes.ts";
import { isSkillLevel, type SkillLevel } from "../session/types.ts";
import {
  formGroupByPlayerOutcome,
  leaveGroupByPlayerOutcome,
} from "../floor-ops.ts";

/** What the "you're in" screen shows — the Player's own token is never echoed back. */
export type RecognizedPlayer = { displayName: string; skillLevel: SkillLevel };

/**
 * What the Player join flow hands back. On success it echoes the folded roster
 * entry so the client can show the "you're in" screen — including the
 * disambiguating suffix, which only the fold knows — without a round trip.
 */
export type JoinResult =
  | { ok: true; player: RecognizedPlayer }
  | { ok?: false; error: string };

/**
 * Is this device's token already in the Session's roster? Returns the Player's
 * public details, or `null`.
 *
 * The roster is deliberately *not* sent to the Player-facing page: a device
 * token is a Player's whole identity (ADR 0001), so broadcasting every token
 * to everyone viewing the (public) Session would let anyone impersonate
 * anyone. This lookup only ever confirms a token the caller already holds.
 */
export async function recognizePlayer(
  sessionId: string,
  token: string,
): Promise<RecognizedPlayer | null> {
  const trimmed = token?.trim() ?? "";
  if (trimmed.length < 8) {
    return null;
  }

  const supabase = await createClient();
  const loaded = await getSession(supabase, sessionId).catch(() => null);
  const me = loaded?.state.roster.find((player) => player.id === trimmed);

  return me ? { displayName: me.displayName, skillLevel: me.skillLevel } : null;
}

export type JoinInput = {
  sessionId: string;
  /** Device token minted and stored by the Player's browser (ADR 0001). */
  token: string;
  firstName: string;
  lastInitial: string;
  skillLevel: string;
};

/**
 * A Player joins a running Session by scanning the Club QR (issue #242).
 *
 * No account and no auth session — the write goes through the
 * `on_deck_join_session` RPC, which is `anon`-callable, pins the event to
 * `PLAYER_JOINED` / `player`, and is idempotent on the device token so
 * reopening the QR is not a re-join.
 */
export async function joinSession(input: JoinInput): Promise<JoinResult> {
  const firstName = input.firstName?.trim().replace(/\s+/g, " ") ?? "";
  const lastInitial =
    input.lastInitial?.trim().match(/[a-z]/i)?.[0].toUpperCase() ?? "";
  const token = input.token?.trim() ?? "";

  if (!firstName) {
    return { error: "Enter your first name." };
  }
  if (!lastInitial) {
    return { error: "Enter your last initial." };
  }
  if (!isSkillLevel(input.skillLevel)) {
    return { error: "Pick your skill level." };
  }
  if (token.length < 8) {
    return { error: "Couldn't set this device up. Reload and try again." };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("on_deck_join_session", {
    p_session_id: input.sessionId,
    p_token: token,
    p_first_name: firstName,
    p_last_initial: lastInitial,
    p_skill_level: input.skillLevel,
  });

  if (error) {
    if (error.code === "42501") {
      return { error: "This session isn't running anymore." };
    }
    console.error("on-deck: joining a Session failed", error);
    return { error: "Couldn't add you just now. Try again." };
  }

  // Read the Session back and fold it, so the "you're in" screen shows the
  // disambiguated display name the roster settled on.
  const loaded = await getSession(supabase, input.sessionId).catch(() => null);
  const me = loaded?.state.roster.find((player) => player.id === token);
  if (!me) {
    return {
      error: "You're added, but we couldn't load your spot. Refresh the page.",
    };
  }

  revalidatePath(sessionPath(input.sessionId));
  return {
    ok: true,
    player: { displayName: me.displayName, skillLevel: me.skillLevel },
  };
}

export type QueueResult = { ok: true } | { ok?: false; error: string };

/**
 * A Player already in the Session taps to join the Queue (issue #243). Goes
 * through the `on_deck_queue_player` RPC — `anon`-callable, pins the event to
 * `PLAYER_QUEUED` / `player`, and is idempotent on the device token. Coming
 * off a Court re-queues a Player with no event, so this is fired once.
 */
export async function queueForSession(
  sessionId: string,
  token: string,
): Promise<QueueResult> {
  const trimmed = token?.trim() ?? "";
  if (trimmed.length < 8) {
    return { error: "Couldn't find your spot. Reload and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("on_deck_queue_player", {
    p_session_id: sessionId,
    p_token: trimmed,
  });

  if (error) {
    if (error.code === "42501") {
      // Either the Session has closed or this device isn't on the roster
      // (a lost/rotated token). Scanning the Club QR again resolves both.
      return {
        error: "Couldn't add you. Scan the club QR again to get set up.",
      };
    }
    console.error("on-deck: queueing a Player failed", error);
    return { error: "Couldn't add you to the queue. Try again." };
  }

  revalidatePath(sessionPath(sessionId));
  return { ok: true };
}

/**
 * A Player removes themselves from the Queue (issue #246, door 1) — they land
 * in Paused with their accrued Wait Time held. Goes through the
 * `on_deck_pause_player` RPC: `anon`-callable, pinned to `PLAYER_PAUSED` /
 * `player` / `left`, and a no-op if they are already stepped out.
 */
export async function leaveQueue(
  sessionId: string,
  token: string,
): Promise<QueueResult> {
  const trimmed = token?.trim() ?? "";
  if (trimmed.length < 8) {
    return { error: "Couldn't find your spot. Reload and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("on_deck_pause_player", {
    p_session_id: sessionId,
    p_token: trimmed,
  });

  if (error) {
    if (error.code === "42501") {
      return { error: "Scan the club QR again to get set up." };
    }
    console.error("on-deck: pausing a Player failed", error);
    return { error: "Couldn't update that. Try again." };
  }

  revalidatePath(sessionPath(sessionId));
  return { ok: true };
}

/**
 * A paused Player rejoins the Queue (issue #246) — the `PLAYER_REQUEUED` door
 * a Player takes by re-scanning the Club QR. Through the
 * `on_deck_requeue_player` RPC: `anon`-callable, a no-op when they are not
 * currently paused. The fold restores their accrued Wait Time.
 */
export async function rejoinQueue(
  sessionId: string,
  token: string,
): Promise<QueueResult> {
  const trimmed = token?.trim() ?? "";
  if (trimmed.length < 8) {
    return { error: "Couldn't find your spot. Reload and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("on_deck_requeue_player", {
    p_session_id: sessionId,
    p_token: trimmed,
  });

  if (error) {
    if (error.code === "42501") {
      return { error: "Scan the club QR again to get set up." };
    }
    console.error("on-deck: re-queueing a Player failed", error);
    return { error: "Couldn't add you back. Try again." };
  }

  revalidatePath(sessionPath(sessionId));
  return { ok: true };
}

/**
 * A Player forms a Queue Together Group from their own phone (issue #251): they
 * pick the other members from the current-Session Player list (display names —
 * a device token never reaches the client, ADR 0001). This resolves the names
 * to tokens against the folded roster, always folds the acting Player in, and
 * appends `GROUP_FORMED` / `player` through the `anon` `on_deck_form_group`
 * RPC. Same Group semantics as the Volunteer path (`reduceSession`, ADR 0005).
 */
export async function formGroupAsPlayer(
  sessionId: string,
  token: string,
  memberNames: string[],
): Promise<QueueResult> {
  const trimmed = token?.trim() ?? "";
  if (trimmed.length < 8) {
    return { error: "Couldn't find your spot. Reload and try again." };
  }

  const supabase = await createClient();
  const loaded = await getSession(supabase, sessionId).catch(() => null);
  if (!loaded) {
    return { error: "This session isn't running anymore." };
  }

  const groupId = `group-${crypto.randomUUID()}`;
  const outcome = formGroupByPlayerOutcome(
    loaded.state,
    trimmed,
    memberNames,
    groupId,
  );
  if (outcome.kind === "error") return { error: outcome.error };
  if (outcome.kind === "noop") return { ok: true };

  const { error } = await supabase.rpc("on_deck_form_group", {
    p_session_id: sessionId,
    p_actor_token: trimmed,
    p_group_id: outcome.payload.groupId,
    p_member_tokens: outcome.payload.memberTokens,
  });

  if (error) {
    if (error.code === "42501") {
      return { error: "Scan the club QR again to get set up." };
    }
    console.error("on-deck: forming a player Group failed", error);
    return { error: "Couldn't group you up just now. Try again." };
  }

  revalidatePath(sessionPath(sessionId));
  return { ok: true };
}

/**
 * A member removes themselves from their Queue Together Group (issue #251) —
 * they stay in the Queue as a solo. Folds the Session to find which Group the
 * token is in, then appends `GROUP_MEMBER_REMOVED` / `player` through the
 * `anon` `on_deck_leave_group` RPC. A no-op when they are in no waiting Group.
 */
export async function leaveGroup(
  sessionId: string,
  token: string,
): Promise<QueueResult> {
  const trimmed = token?.trim() ?? "";
  if (trimmed.length < 8) {
    return { error: "Couldn't find your spot. Reload and try again." };
  }

  const supabase = await createClient();
  const loaded = await getSession(supabase, sessionId).catch(() => null);
  if (!loaded) {
    return { error: "This session isn't running anymore." };
  }

  const outcome = leaveGroupByPlayerOutcome(loaded.state, trimmed);
  if (outcome.kind === "error") return { error: outcome.error };
  if (outcome.kind === "noop") return { ok: true };

  const { error } = await supabase.rpc("on_deck_leave_group", {
    p_session_id: sessionId,
    p_token: trimmed,
    p_group_id: outcome.payload.groupId,
  });

  if (error) {
    if (error.code === "42501") {
      return { error: "Scan the club QR again to get set up." };
    }
    console.error("on-deck: leaving a Group failed", error);
    return { error: "Couldn't update that. Try again." };
  }

  revalidatePath(sessionPath(sessionId));
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { getSession } from "../sessions.ts";
import { sessionPath } from "../routes.ts";
import { isSkillLevel, type SkillLevel } from "../session/types.ts";

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

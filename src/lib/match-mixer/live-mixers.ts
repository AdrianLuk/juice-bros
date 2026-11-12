/**
 * Match Mixer's Live Mixer store (ADR 0006, #687). Each function takes the
 * caller's `SupabaseClient`; the database checks the link tokens.
 *
 * Relative imports only, so `npm run test:db` loads it directly.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { decodeShareLink } from "../../components/apps/match-mixer/lib/persistence/share-link.ts";

/** `signIn` marks the one refusal that signing in fixes. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; problem: string; signIn?: true };

/** A Live Mixer as one of its two links sees it. */
export type LiveMixer = {
  role: "organizer" | "player";
  /** The Share Link payload the board is redrawn from. */
  config: string;
  /** The Player Link's token, for the Organizer Link only. */
  playerToken: string | null;
  wentLiveAt: string;
  finishedAt: string | null;
};

export const UNREADABLE_BOARD =
  "This board can't go live: this version of Match Mixer can't redraw it. Make the board again, then go live.";

export const SIGN_IN_TO_GO_LIVE = "Sign in with Google to go live. Every board you take live is saved to your account.";

/**
 * Commits a drawn board for the signed-in organizer and returns both links'
 * tokens. The Config goes through the Share Link reader first, the same one an
 * opened link uses, and must be minted by this build's generator: a Live Mixer
 * is redrawn from it on every phone for the rest of the night.
 */
export async function goLive(
  supabase: SupabaseClient,
  config: string,
): Promise<Outcome<{ organizerToken: string; playerToken: string }>> {
  if (!decodeShareLink(config)?.current) return { ok: false, problem: UNREADABLE_BOARD };

  const { data, error } = await supabase.rpc("match_mixer_go_live", { p_config: config });
  if (error?.code === "42501") return { ok: false, problem: SIGN_IN_TO_GO_LIVE, signIn: true };
  if (error?.code === "54000") return { ok: false, problem: error.message };
  if (error?.code === "22023") return { ok: false, problem: UNREADABLE_BOARD };
  if (error) throw new Error(`Going live failed: ${error.message}`);
  return { ok: true, value: data as { organizerToken: string; playerToken: string } };
}

/** The Live Mixer behind either link's token, or null when there's none. */
export async function readLiveMixer(
  supabase: SupabaseClient,
  token: string,
): Promise<LiveMixer | null> {
  const { data, error } = await supabase.rpc("match_mixer_live_mixer", { p_token: token });
  if (error) throw new Error(`Reading the Live Mixer failed: ${error.message}`);
  return (data as LiveMixer | null) ?? null;
}

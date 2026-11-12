/**
 * Match Mixer's Live Mixer store (ADR 0006, #687, #688). Each function takes
 * the caller's `SupabaseClient`; the database checks the link tokens.
 *
 * Relative imports only, so `npm run test:db` loads it directly.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { GameAt, MixerEvent } from "../../components/apps/match-mixer/lib/live/events.ts";
import { readGameAt, replay } from "../../components/apps/match-mixer/lib/live/events.ts";
import { readGameRule, scoreProblem, type GameRule, type GameScore } from "../../components/apps/match-mixer/lib/live/game-rule.ts";
import { gameOn, redraw } from "../../components/apps/match-mixer/lib/live/night.ts";
import { decodeShareLink } from "../../components/apps/match-mixer/lib/persistence/share-link.ts";

/** `signIn` marks the one refusal that signing in fixes. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; problem: string; signIn?: true };

/** A Live Mixer as one of its two links sees it. */
export type LiveMixer = {
  /** Names the Realtime topic; not a credential. */
  id: string;
  role: "organizer" | "player";
  /** The Share Link payload the board is redrawn from. */
  config: string;
  /** The Player Link's token, for the Organizer Link only. */
  playerToken: string | null;
  wentLiveAt: string;
  finishedAt: string | null;
  /** The whole log, in replay order. */
  events: MixerEvent[];
};

export const UNREADABLE_BOARD =
  "This board can't go live: this version of Match Mixer can't redraw it. Make the board again, then go live.";

export const SIGN_IN_TO_GO_LIVE = "Sign in with Google to go live. Every board you take live is saved to your account.";

export const ORGANIZER_ONLY = "Only the Organizer Link can change scores or the Game Rule.";

export const NOT_ON_THE_BOARD = "That Game isn't on this board. Reload the page to see the board as it is now.";

export const FINISHED = "This Live Mixer has finished, so its scores can't change.";

export const NOT_A_GAME_RULE = "That isn't a Game Rule Match Mixer knows.";

/**
 * Commits a drawn board for the signed-in organizer and returns both links'
 * tokens. The Config goes through the Share Link reader first, the same one an
 * opened link uses, and must be minted by this build's generator: a Live Mixer
 * is redrawn from it on every phone for the rest of the night. `rule` is the
 * Game Rule the night starts on (#688).
 */
export async function goLive(
  supabase: SupabaseClient,
  config: string,
  rule?: GameRule,
): Promise<Outcome<{ organizerToken: string; playerToken: string }>> {
  if (!decodeShareLink(config)?.current) return { ok: false, problem: UNREADABLE_BOARD };
  if (rule !== undefined && !readGameRule(rule)) return { ok: false, problem: NOT_A_GAME_RULE };

  const { data, error } = await supabase.rpc("match_mixer_go_live", {
    p_config: config,
    p_rule: rule ?? null,
  });
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

/**
 * The Live Mixer behind an Organizer Link token, with its board redrawn, or
 * the refusal to hand back. Each write checks against this before appending.
 */
async function organizerNight(supabase: SupabaseClient, token: string) {
  const mixer = await readLiveMixer(supabase, token);
  if (mixer?.role !== "organizer") return { ok: false as const, problem: ORGANIZER_ONLY };
  if (mixer.finishedAt) return { ok: false as const, problem: FINISHED };
  const draw = redraw(mixer.config);
  if (!draw) return { ok: false as const, problem: UNREADABLE_BOARD };
  return { ok: true as const, mixer, draw };
}

async function append(
  supabase: SupabaseClient,
  token: string,
  kind: "score_entered" | "score_cleared" | "game_rule_changed",
  payload: object,
): Promise<Outcome<null>> {
  const { error } = await supabase.rpc("match_mixer_append", {
    p_token: token,
    p_kind: kind,
    p_payload: payload,
  });
  if (error?.code === "42501") return { ok: false, problem: ORGANIZER_ONLY };
  if (error?.code === "55000") return { ok: false, problem: FINISHED };
  if (error?.code === "54000") return { ok: false, problem: error.message };
  if (error) throw new Error(`Saving to the Live Mixer failed: ${error.message}`);
  return { ok: true, value: null };
}

/**
 * Enters or changes one Game's score, in the order of its two Sides. Checked
 * against the board redrawn from the Config and the Game Rule in force now.
 */
export async function enterScore(
  supabase: SupabaseClient,
  token: string,
  at: GameAt,
  score: GameScore,
): Promise<Outcome<null>> {
  const night = await organizerNight(supabase, token);
  if (!night.ok) return night;
  const game = onBoard(night.draw, at);
  if (!game) return { ok: false, problem: NOT_ON_THE_BOARD };
  const pair: GameScore = Array.isArray(score) ? [score[0], score[1]] : [Number.NaN, Number.NaN];
  const problem = scoreProblem(replay(night.mixer.events).rule, pair);
  if (problem) return { ok: false, problem };
  return append(supabase, token, "score_entered", { ...game, score: pair });
}

/** Takes one Game's score off. */
export async function clearScore(supabase: SupabaseClient, token: string, at: GameAt): Promise<Outcome<null>> {
  const night = await organizerNight(supabase, token);
  if (!night.ok) return night;
  const game = onBoard(night.draw, at);
  if (!game) return { ok: false, problem: NOT_ON_THE_BOARD };
  return append(supabase, token, "score_cleared", game);
}

/** `at` off the wire, as a Game this board has, or null. */
function onBoard(draw: NonNullable<ReturnType<typeof redraw>>, at: unknown): GameAt | null {
  const game = typeof at === "object" && at !== null ? readGameAt(at as Record<string, unknown>) : null;
  return game && gameOn(draw, game) ? { round: game.round, court: game.court } : null;
}

/** Changes the Game Rule for every score entered from now on. */
export async function changeGameRule(
  supabase: SupabaseClient,
  token: string,
  rule: GameRule,
): Promise<Outcome<null>> {
  const checked = readGameRule(rule);
  if (!checked) return { ok: false, problem: NOT_A_GAME_RULE };
  const night = await organizerNight(supabase, token);
  if (!night.ok) return night;
  return append(supabase, token, "game_rule_changed", checked);
}

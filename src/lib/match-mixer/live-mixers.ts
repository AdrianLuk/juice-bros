/**
 * Match Mixer's Live Mixer store (ADR 0006, #687 to #690). Each function takes
 * the caller's `SupabaseClient`; the database checks the link tokens.
 *
 * Relative imports only, so `npm run test:db` loads it directly.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { GameAt, MixerEvent } from "../../components/apps/match-mixer/lib/live/events.ts";
import { readGameAt, replay } from "../../components/apps/match-mixer/lib/live/events.ts";
import { readGameRule, scoreProblem, type GameRule, type GameScore } from "../../components/apps/match-mixer/lib/live/game-rule.ts";
import {
  gameOn,
  notStarted,
  playerAccess,
  redraw,
  roundCount,
  runsTheNight,
} from "../../components/apps/match-mixer/lib/live/rebuild.ts";
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
  /** Set once the organizer taps Finish Mixer, or 12 hours after going live (#690). */
  finishedAt: string | null;
  /** The signed-in caller runs every Live Mixer, through either link, finished or not (#690). */
  superadmin: boolean;
  /** The whole log, in replay order. */
  events: MixerEvent[];
};

export const UNREADABLE_BOARD =
  "This board can't go live: this version of Match Mixer can't redraw it. Make the board again, then go live.";

export const SIGN_IN_TO_GO_LIVE = "Sign in with Google to go live. Every board you take live is saved to your account.";

export const ORGANIZER_ONLY = "Only the Organizer Link can do that.";

export const NO_SUCH_LIVE_MIXER = "There's no Live Mixer behind this link.";

export const NOT_ON_THE_BOARD = "That Game isn't on this board. Reload the page to see the board as it is now.";

export const FINISHED = "This Live Mixer has finished, so its scores and Standings are final.";

export const NOT_A_GAME_RULE = "That isn't a Game Rule Match Mixer knows.";

export const PICK_YOUR_NAME = "Tap your name on the board first. Then you can score your own Games.";

export const NOT_YOUR_GAME = "You can score your own Games only. The organizer can fix any other.";

export const ONE_ROUND_AT_A_TIME = "Rounds start one at a time. Reload the page to see which Round is on.";

export const LAST_ROUND = "That was the last Round on this board.";

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

const refusal = (problem: string) => ({ ok: false as const, problem });

/**
 * The Live Mixer behind either link's token, with its board redrawn and its
 * events replayed, or the refusal to hand back. Each write checks against
 * this before appending. A finished one takes writes from a superadmin only.
 */
async function openMixer(supabase: SupabaseClient, token: string) {
  const mixer = await readLiveMixer(supabase, token);
  if (!mixer) return refusal(NO_SUCH_LIVE_MIXER);
  if (mixer.finishedAt && !mixer.superadmin) return refusal(FINISHED);
  const draw = redraw(mixer.config);
  if (!draw) return refusal(UNREADABLE_BOARD);
  return { ok: true as const, mixer, draw, replayed: replay(mixer.events) };
}

async function organizerMixer(supabase: SupabaseClient, token: string) {
  const open = await openMixer(supabase, token);
  if (open.ok && !runsTheNight(open.mixer)) return refusal(ORGANIZER_ONLY);
  return open;
}

/**
 * The Game `at` names, when this link may score it, or the refusal. The
 * Organizer Link scores any Game in any Round. The Player Link scores the
 * Games its Selection sits in, up to the Current Round (#689): the board
 * rebuilt here from the stored Config is the guard, not the phone's check.
 * A superadmin on either link scores as the Organizer Link does (#690).
 */
async function scorableGame(supabase: SupabaseClient, token: string, at: unknown, selection: unknown) {
  const open = await openMixer(supabase, token);
  if (!open.ok) return open;
  const game = onBoard(open.draw, at);
  if (!game) return refusal(NOT_ON_THE_BOARD);
  if (!runsTheNight(open.mixer)) {
    const size = open.draw.config.roster.length;
    const player = Number.isInteger(selection) && (selection as number) >= 0 && (selection as number) < size;
    if (!player) return refusal(PICK_YOUR_NAME);
    const access = playerAccess(open.draw, open.replayed.currentRound, selection as number, game);
    if (access === "not-yours") return refusal(NOT_YOUR_GAME);
    if (access === "not-started") return refusal(notStarted(game.round));
  }
  return { ok: true as const, game, replayed: open.replayed };
}

async function append(
  supabase: SupabaseClient,
  token: string,
  kind: "score_entered" | "score_cleared" | "game_rule_changed" | "round_started" | "finished",
  payload: object,
): Promise<Outcome<null>> {
  const { error } = await supabase.rpc("match_mixer_append", {
    p_token: token,
    p_kind: kind,
    p_payload: payload,
  });
  if (error?.code === "42501") return { ok: false, problem: ORGANIZER_ONLY };
  if (error?.code === "55000") return { ok: false, problem: FINISHED };
  // 54000: the log is full. MMR01: the database's own Current Round check, met only in a race.
  if (error?.code === "54000" || error?.code === "MMR01") return { ok: false, problem: error.message };
  if (error) throw new Error(`Saving to the Live Mixer failed: ${error.message}`);
  return { ok: true, value: null };
}

/**
 * Enters or changes one Game's score, in the order of its two Sides. Checked
 * against the board redrawn from the Config and the Game Rule in force now.
 * `selection` is the Player Link's find-me Selection, a Roster index; the
 * Organizer Link's is ignored.
 */
export async function enterScore(
  supabase: SupabaseClient,
  token: string,
  at: GameAt,
  score: GameScore,
  selection?: number | null,
): Promise<Outcome<null>> {
  const scorable = await scorableGame(supabase, token, at, selection);
  if (!scorable.ok) return scorable;
  const pair: GameScore = Array.isArray(score) ? [score[0], score[1]] : [Number.NaN, Number.NaN];
  const problem = scoreProblem(scorable.replayed.rule, pair);
  if (problem) return refusal(problem);
  return append(supabase, token, "score_entered", { ...scorable.game, score: pair });
}

/** Takes one Game's score off. The same Games as `enterScore`. */
export async function clearScore(
  supabase: SupabaseClient,
  token: string,
  at: GameAt,
  selection?: number | null,
): Promise<Outcome<null>> {
  const scorable = await scorableGame(supabase, token, at, selection);
  if (!scorable.ok) return scorable;
  return append(supabase, token, "score_cleared", scorable.game);
}

/**
 * The Organizer Link's "Start round N+1" (#689), with `round` as the index
 * the button showed. A Round already on is done, so a second tap or a second
 * phone changes nothing; skipping a Round is refused.
 */
export async function startRound(supabase: SupabaseClient, token: string, round: number): Promise<Outcome<null>> {
  const live = await organizerMixer(supabase, token);
  if (!live.ok) return live;
  if (!Number.isInteger(round) || round < 0) return refusal(ONE_ROUND_AT_A_TIME);
  const { currentRound } = live.replayed;
  if (round <= currentRound) return { ok: true, value: null };
  if (round > currentRound + 1) return refusal(ONE_ROUND_AT_A_TIME);
  if (round >= roundCount(live.draw)) return refusal(LAST_ROUND);
  return append(supabase, token, "round_started", { round });
}

/**
 * The Organizer Link's "Finish Mixer" (#690): the scores and Standings become
 * final, and both links stop taking writes. A night already finished, by a tap
 * or by the 12 hours, is done, so a second tap or a second phone changes
 * nothing.
 */
export async function finishMixer(supabase: SupabaseClient, token: string): Promise<Outcome<null>> {
  const mixer = await readLiveMixer(supabase, token);
  if (!mixer) return refusal(NO_SUCH_LIVE_MIXER);
  if (!runsTheNight(mixer)) return refusal(ORGANIZER_ONLY);
  if (mixer.finishedAt) return { ok: true, value: null };
  return append(supabase, token, "finished", {});
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
  const live = await organizerMixer(supabase, token);
  if (!live.ok) return live;
  return append(supabase, token, "game_rule_changed", checked);
}

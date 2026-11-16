/**
 * Match Mixer's Live Mixer store (ADR 0006, #687 to #690). Each function takes
 * the caller's `SupabaseClient`; the database checks the link tokens.
 *
 * Relative imports only, so `npm run test:db` loads it directly.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { GameAt, MixerEvent } from "../../components/apps/match-mixer/lib/live/events.ts";
import { formatObjection, resolveFormat } from "../../components/apps/match-mixer/lib/engine/format.ts";
import { mixedObjection, resolveMixed, splitMarker } from "../../components/apps/match-mixer/lib/engine/mixed.ts";
import { MAX_BOARD_SIZE, poolName } from "../../components/apps/match-mixer/lib/engine/pools.ts";
import { MAX_ROSTER_SIZE } from "../../components/apps/match-mixer/lib/engine/types.ts";
import { MAX_LINE_LENGTH, readGameAt } from "../../components/apps/match-mixer/lib/live/events.ts";
import { readGameRule, scoreProblem, type GameRule, type GameScore } from "../../components/apps/match-mixer/lib/live/game-rule.ts";
import {
  gameOn,
  notStarted,
  playerAccess,
  rebuild,
  redraw,
  roundCount,
  runsTheNight,
} from "../../components/apps/match-mixer/lib/live/rebuild.ts";
import { linesPerArrival } from "../../components/apps/match-mixer/lib/live/roster-changes.ts";
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

/** One of an Owner's Live Mixers, as My Mixers lists it (#691). */
export type MyMixer = {
  id: string;
  /** The Share Link payload the board was drawn from; Run it again opens it. */
  config: string;
  /** Opens the Live Mixer as the Organizer Link does, without its Owner having kept the link. */
  organizerToken: string;
  wentLiveAt: string;
  /** Set once the Live Mixer finished, by a tap or by the 12 hours. */
  finishedAt: string | null;
  /** The Roster's size, read off the Config. */
  players: number;
};

export const UNREADABLE_BOARD =
  "This board can't go live: this version of Match Mixer can't redraw it. Make the board again, then go live.";

export const SIGN_IN_TO_GO_LIVE = "Sign in with Google to go live. Every board you take live is saved to your account.";

export const SIGN_IN_FOR_MY_MIXERS = "Sign in with Google to see the Live Mixers you've taken live.";

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

/**
 * My Mixers (#691): the signed-in Owner's Live Mixers, newest first,
 * finished ones included. A superadmin's list is every Live Mixer. A Live Mixer
 * whose Config this build can't read is left out: Run it again couldn't open it.
 */
export async function myMixers(supabase: SupabaseClient): Promise<Outcome<MyMixer[]>> {
  const { data, error } = await supabase.rpc("match_mixer_my_mixers");
  if (error?.code === "42501") return { ok: false, problem: SIGN_IN_FOR_MY_MIXERS, signIn: true };
  if (error) throw new Error(`Reading My Mixers failed: ${error.message}`);
  const rows = (data ?? []) as Omit<MyMixer, "players">[];
  return {
    ok: true,
    value: rows.flatMap((row) => {
      const board = decodeShareLink(row.config);
      return board ? [{ ...row, players: board.config.roster.length }] : [];
    }),
  };
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
  // The board with every late arrival and departure in it (#692).
  const replayed = rebuild(mixer.config, mixer.events);
  if (!replayed) return refusal(UNREADABLE_BOARD);
  return { ok: true as const, mixer, draw: replayed.draw, replayed };
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
  kind: "score_entered" | "score_cleared" | "game_rule_changed" | "round_started" | "finished" | "player_added" | "player_left",
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

export const NO_ROUNDS_LEFT = "Every Round on this board has started, so there's no Round left to change who's playing.";

export const NOT_A_PLAYER = "That isn't a Player on this board. Reload the page to see the board as it is now.";

export const ONE_AT_A_TIME = "Add one Player at a time.";

export const NO_SUCH_POOL = "That Pool isn't on this board.";

/**
 * Whether a Round is left that nobody has started: the only Rounds a late
 * arrival or a departure can move (#692).
 */
function roundLeft(live: { replayed: { currentRound: number }; draw: Parameters<typeof roundCount>[0] }): boolean {
  return live.replayed.currentRound + 1 < roundCount(live.draw);
}

/**
 * The Organizer Link adds a late arrival to one Pool (#692): a Roster line, or
 * a Pairing's two in fixed partners, with a Marker under mixed doubles. They
 * play from the first Round nobody has started, and only that Pool's
 * unstarted Rounds are drawn again. The Format's own refusals are reused.
 */
export async function addPlayer(
  supabase: SupabaseClient,
  token: string,
  lines: unknown,
  pool: unknown,
): Promise<Outcome<null>> {
  const live = await organizerMixer(supabase, token);
  if (!live.ok) return live;
  const { config, pools } = live.draw;
  if (!Number.isInteger(pool) || (pool as number) < 0 || (pool as number) >= pools.length) return refusal(NO_SUCH_POOL);

  const typed = Array.isArray(lines) ? lines.filter((line): line is string => typeof line === "string").map((line) => line.trim()) : [];
  const given = typed.filter((line) => line.length > 0);
  if (given.length === 0) return refusal("Type the new Player's name first.");
  if (given.some((line) => line.length > MAX_LINE_LENGTH)) return refusal(`Keep a name to ${MAX_LINE_LENGTH} characters.`);

  const format = resolveFormat(config.format);
  const mixed = resolveMixed(format, config.mixed);
  const players = given.map((line, index) => ({ id: `new${index}`, ...(mixed ? splitMarker(line) : { name: line }) }));
  if (given.length !== linesPerArrival(format)) {
    return refusal(formatObjection(players, format) ?? ONE_AT_A_TIME);
  }
  const unmarked = mixedObjection(players, 0, mixed);
  if (unmarked) return refusal(unmarked);

  const target = pools[pool as number];
  if (target.members.length + given.length > MAX_ROSTER_SIZE) {
    return refusal(`${pools.length > 1 ? poolName(target.label) : "This board"} holds up to ${MAX_ROSTER_SIZE} players.`);
  }
  if (config.roster.length + given.length > MAX_BOARD_SIZE) {
    return refusal(`A board holds up to ${MAX_BOARD_SIZE} players.`);
  }
  if (!roundLeft(live)) return refusal(NO_ROUNDS_LEFT);
  return append(supabase, token, "player_added", { lines: given, pool });
}

/**
 * The Organizer Link marks a Player as left, or back again (#692), from the
 * first Round nobody has started. In fixed partners the Pairing goes and comes
 * back whole. Taking off someone added before their first Round undoes the
 * add exactly. A Player already where they're asked to be changes nothing.
 */
export async function setPlaying(
  supabase: SupabaseClient,
  token: string,
  player: unknown,
  playing: boolean,
): Promise<Outcome<null>> {
  const live = await organizerMixer(supabase, token);
  if (!live.ok) return live;
  const size = live.draw.config.roster.length;
  if (!Number.isInteger(player) || (player as number) < 0 || (player as number) >= size) return refusal(NOT_A_PLAYER);
  if (live.replayed.playing[player as number] === Boolean(playing)) return { ok: true, value: null };
  if (!roundLeft(live)) return refusal(NO_ROUNDS_LEFT);
  return append(supabase, token, playing ? "player_added" : "player_left", { player });
}

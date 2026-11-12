"use server";

import type { GameAt } from "../../components/apps/match-mixer/lib/live/events.ts";
import type { GameRule, GameScore } from "../../components/apps/match-mixer/lib/live/game-rule.ts";
import * as liveMixers from "./live-mixers.ts";
import type { LiveMixer, Outcome } from "./live-mixers.ts";
import { organizerLinkPath, playerLinkPath } from "./routes.ts";
import { createClient } from "./supabase/server.ts";

const SERVER_FAILED =
  "Match Mixer couldn't save the board just now, so it didn't go live. Your board is still here. Try again in a minute.";

const WRITE_FAILED = "Match Mixer couldn't save that just now. Try again in a minute.";

/**
 * Go Live, the one call `/tools/match-mixer` makes over the network (ADR
 * 0006). Returns the two links' paths; the browser adds its own origin.
 */
export async function goLive(
  config: string,
  rule?: GameRule,
): Promise<Outcome<{ organizerPath: string; playerPath: string }>> {
  if (typeof config !== "string") return { ok: false, problem: "That isn't a board." };
  let outcome: Awaited<ReturnType<typeof liveMixers.goLive>>;
  try {
    outcome = await liveMixers.goLive(await createClient(), config, rule);
  } catch (error) {
    // Reached the server, failed behind it: not the organizer's signal.
    console.error(error);
    return { ok: false, problem: SERVER_FAILED };
  }
  if (!outcome.ok) return outcome;
  return {
    ok: true,
    value: {
      organizerPath: organizerLinkPath(outcome.value.organizerToken),
      playerPath: playerLinkPath(outcome.value.playerToken),
    },
  };
}

/** Either link's Live Mixer, for the live screens' re-reads (#688). */
export async function readLiveMixer(token: string): Promise<LiveMixer | null> {
  if (typeof token !== "string") return null;
  return liveMixers.readLiveMixer(await createClient(), token);
}

/** A write that failed behind the server reads as a refusal, not a crash. */
async function settle(write: () => Promise<Outcome<null>>): Promise<Outcome<null>> {
  try {
    return await write();
  } catch (error) {
    console.error(error);
    return { ok: false, problem: WRITE_FAILED };
  }
}

/**
 * Either link enters or changes one Game's score. `selection` is the Player
 * Link's find-me Selection, checked on the server against the rebuilt board.
 */
export async function enterScore(
  token: string,
  at: GameAt,
  score: GameScore,
  selection: number | null,
): Promise<Outcome<null>> {
  return settle(async () => liveMixers.enterScore(await createClient(), String(token), at, score, selection));
}

/** Either link takes one Game's score off, on the same terms as entering it. */
export async function clearScore(token: string, at: GameAt, selection: number | null): Promise<Outcome<null>> {
  return settle(async () => liveMixers.clearScore(await createClient(), String(token), at, selection));
}

/** The Organizer Link's "Start round N+1", with `round` as the index the button showed. */
export async function startRound(token: string, round: number): Promise<Outcome<null>> {
  return settle(async () => liveMixers.startRound(await createClient(), String(token), round));
}

/** The Organizer Link changes the Game Rule for scores from now on. */
export async function changeGameRule(token: string, rule: GameRule): Promise<Outcome<null>> {
  return settle(async () => liveMixers.changeGameRule(await createClient(), String(token), rule));
}

/**
 * Called with the ID token Google returned, from the Go Live control. No
 * redirect, unlike Mic Drop's: the board on screen may be a borrowed one that
 * a reload wouldn't bring back, so the control goes live straight after.
 * `nonce` is the raw value: Supabase hashes it itself.
 */
export async function signInWithGoogleIdToken(
  idToken: string,
  nonce: string,
): Promise<{ ok: boolean }> {
  const { error } = await (await createClient()).auth.signInWithIdToken({
    provider: "google",
    token: idToken,
    nonce,
  });
  return { ok: !error };
}

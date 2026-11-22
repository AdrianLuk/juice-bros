"use server";

import { revalidatePath } from "next/cache";

import { getVisitor, verifyOrganizer } from "../dal.ts";
import { LINEUP_GAMES, type LineupGame } from "../lineup.ts";
import { checkGameScore, MAX_REASON } from "../matchups.ts";
import { DDD_ROOT } from "../routes.ts";
import { createClient } from "../supabase/server.ts";
import type { LiveWriter, WriteResult } from "./live.ts";

/**
 * Round 2 and the Playoff's writes (#716). Each Server Action is reachable
 * by a direct POST, so each checks its own credential: a Score Link token is
 * checked by the database, the Organizer path by the session first and RLS
 * after.
 */

function refusal(code: string | undefined): string {
  if (code === "42501") return "This link can't enter scores any more. Ask an Organizer for the current one.";
  if (code === "22023") return "A Game ends 11 to anything up to 9, or by 2 past 11, like 13-11.";
  if (code === "55000") return "Spread needed: an Organizer sets it before this Game is scored.";
  return "Couldn't save the score. Try again.";
}

async function writeGame(
  writer: LiveWriter,
  teamA: string,
  teamB: string,
  game: LineupGame,
  scoreA: number | null,
  scoreB: number | null,
): Promise<WriteResult> {
  if (!LINEUP_GAMES.includes(game)) return { ok: false, problem: "That Game isn't in a Lineup. Reload the page." };
  // An Organizer's session is checked here; a token in the database.
  if (writer.kind === "organizer" && (await getVisitor()).kind !== "organizer") {
    return { ok: false, problem: "Sign in as an Organizer to change scores." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("ddd_save_game", {
    p_token: writer.kind === "score" ? String(writer.token) : null,
    p_team_a: String(teamA),
    p_team_b: String(teamB),
    p_game: game,
    p_score_a: scoreA,
    p_score_b: scoreB,
  });
  if (error) return { ok: false, problem: refusal(error.code) };
  revalidatePath(DDD_ROOT, "layout");
  return { ok: true };
}

/** Enters or corrects a Game final: `scoreA` is `teamA`'s points. */
export async function saveGame(
  writer: LiveWriter,
  teamA: string,
  teamB: string,
  game: LineupGame,
  scoreA: number,
  scoreB: number,
): Promise<WriteResult> {
  const problem = checkGameScore(Number(scoreA), Number(scoreB));
  if (problem) return { ok: false, problem };
  return writeGame(writer, teamA, teamB, game, Number(scoreA), Number(scoreB));
}

/** Takes a Game final back out. Organizers only. */
export async function clearGame(teamA: string, teamB: string, game: LineupGame): Promise<WriteResult> {
  return writeGame({ kind: "organizer" }, teamA, teamB, game, null, null);
}

/** The pairing as ddd_matchup_calls stores it: the two ids in order. */
const stored = (a: string, b: string) => [String(a), String(b)].sort() as [string, string];

/** An Organizer's call on a 2-2 Matchup: who won it, and why. */
export async function callMatchup(teamA: string, teamB: string, winner: string, reason: string): Promise<WriteResult> {
  await verifyOrganizer();
  const why = String(reason ?? "").trim();
  if (why === "") return { ok: false, problem: "Say why: the reason shows on the Matchup." };
  if (why.length > MAX_REASON) return { ok: false, problem: `Keep the reason to ${MAX_REASON} characters.` };
  const [a, b] = stored(teamA, teamB);
  if (String(winner) !== a && String(winner) !== b) return { ok: false, problem: "Pick one of the two Teams." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("ddd_matchup_calls")
    .upsert({ team_a: a, team_b: b, winner: String(winner), reason: why }, { onConflict: "team_a,team_b" });
  if (error) return { ok: false, problem: "Couldn't save the call. Try again." };
  revalidatePath(DDD_ROOT, "layout");
  return { ok: true };
}

/** Takes an Organizer's call back: the Matchup goes back to Spread margin, then points. */
export async function clearCall(teamA: string, teamB: string): Promise<WriteResult> {
  await verifyOrganizer();
  const [a, b] = stored(teamA, teamB);
  const supabase = await createClient();
  const { error } = await supabase.from("ddd_matchup_calls").delete().eq("team_a", a).eq("team_b", b);
  if (error) return { ok: false, problem: "Couldn't take the call back. Try again." };
  revalidatePath(DDD_ROOT, "layout");
  return { ok: true };
}

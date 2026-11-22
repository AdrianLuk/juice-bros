"use server";

import { revalidatePath } from "next/cache";

import type { CourtPlan } from "../courts.ts";
import { verifyOrganizer } from "../dal.ts";
import { MAX_COURTS } from "../events.ts";
import { LINEUP_GAMES, type LineupGame } from "../lineup.ts";
import { DDD_ROOT } from "../routes.ts";
import { createClient } from "../supabase/server.ts";
import type { WriteResult } from "./live.ts";

/**
 * An Organizer's changes to a Matchup's courts (#717). Organizers only:
 * each action checks the session first and RLS after. The plan is stored
 * once per pairing, the Team earlier in the roster first.
 */

async function changePlan(teamA: string, teamB: string, change: (plan: CourtPlan) => CourtPlan): Promise<WriteResult> {
  await verifyOrganizer();
  const supabase = await createClient();
  const { data: teams, error } = await supabase
    .from("ddd_teams")
    .select("id, position, event_id")
    .in("id", [String(teamA), String(teamB)]);
  const pair = (teams ?? []) as { id: string; position: number; event_id: string }[];
  if (error || pair.length !== 2 || pair[0].event_id !== pair[1].event_id) {
    return { ok: false, problem: "That Matchup is gone. Reload the page." };
  }
  const [first, second] = [...pair].sort((x, y) => x.position - y.position);
  const { data: row } = await supabase
    .from("ddd_court_plans")
    .select("swapped, moves")
    .eq("team_a", first.id)
    .eq("team_b", second.id)
    .maybeSingle();
  const next = change({ swapped: row?.swapped ?? false, moves: row?.moves ?? {} });
  const { error: saveError } = await supabase
    .from("ddd_court_plans")
    .upsert({ team_a: first.id, team_b: second.id, swapped: next.swapped, moves: next.moves }, { onConflict: "team_a,team_b" });
  if (saveError) return { ok: false, problem: "Couldn't change the courts. Try again." };
  revalidatePath(DDD_ROOT, "layout");
  return { ok: true };
}

/** Plays a Matchup's Court turns the other way round, or back again. */
export async function swapCourtTurns(teamA: string, teamB: string): Promise<WriteResult> {
  return changePlan(teamA, teamB, (plan) => ({ ...plan, swapped: !plan.swapped }));
}

/** Puts one Game of a Matchup on another court (an index into the DDD's courts). */
export async function moveGame(teamA: string, teamB: string, game: LineupGame, court: number): Promise<WriteResult> {
  const to = Number(court);
  if (!LINEUP_GAMES.includes(game)) return { ok: false, problem: "That Game isn't in a Lineup. Reload the page." };
  if (!Number.isInteger(to) || to < 0 || to >= MAX_COURTS) return { ok: false, problem: "Pick one of the courts." };
  return changePlan(teamA, teamB, (plan) => ({ ...plan, moves: { ...plan.moves, [game]: to } }));
}

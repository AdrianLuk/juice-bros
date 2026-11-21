/**
 * Lineups in the database (issue #713), through the caller's `SupabaseClient`
 * so RLS keeps it to Organizers. Relative imports only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { LINEUP_GAMES, type Lineup, type RawLineup } from "./lineup.ts";

/** Each Team's saved Pairs, keyed by Team id. A Team with none is absent. */
export async function getLineups(supabase: SupabaseClient, teamIds: string[]): Promise<Record<string, RawLineup>> {
  if (teamIds.length === 0) return {};
  const { data, error } = await supabase.from("ddd_lineup_pairs").select("team_id, game, player_a, player_b").in("team_id", teamIds);
  if (error) throw new Error(`Reading the Lineups failed: ${error.message}`);
  const byTeam: Record<string, RawLineup> = {};
  for (const row of data ?? []) (byTeam[row.team_id] ??= {})[row.game as keyof RawLineup] = [row.player_a, row.player_b];
  return byTeam;
}

/** Saves a Team's four Pairs in one statement. The caller has checked the ids are on the Team. */
export async function saveLineup(supabase: SupabaseClient, teamId: string, lineup: Lineup): Promise<void> {
  const rows = LINEUP_GAMES.map((game) => ({ team_id: teamId, game, player_a: lineup[game][0], player_b: lineup[game][1] }));
  const { error } = await supabase.from("ddd_lineup_pairs").upsert(rows, { onConflict: "team_id,game" });
  if (error) throw new Error(`Saving the Lineup failed: ${error.message}`);
}

/** A Team's players, or null when the Team is not there. */
export async function getTeamPlayers(supabase: SupabaseClient, teamId: string) {
  const { data, error } = await supabase.from("ddd_teams").select("ddd_players (id, name, gender)").eq("id", teamId).maybeSingle();
  // 22P02: not a uuid, so not a Team.
  if (error?.code === "22P02") return null;
  if (error) throw new Error(`Reading a Team failed: ${error.message}`);
  return data ? (data.ddd_players as { id: string; name: string; gender: "M" | "F" }[]) : null;
}

/**
 * Spreads in the database (issue #714), through the caller's `SupabaseClient`
 * so RLS keeps it to Organizers. Relative imports only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { LineupGame } from "./lineup.ts";
import type { Side, SpreadEntry, SpreadRow } from "./spreads.ts";

type Row = { team_a: string; team_b: string; game: LineupGame; lower: Side; points: number; sig: string };

/** Every saved Spread of these Teams. */
export async function getSpreads(supabase: SupabaseClient, teamIds: string[]): Promise<SpreadRow[]> {
  if (teamIds.length === 0) return [];
  const { data, error } = await supabase.from("ddd_spreads").select("team_a, team_b, game, lower, points, sig").in("team_a", teamIds);
  if (error) throw new Error(`Reading the Spreads failed: ${error.message}`);
  return ((data ?? []) as Row[]).map((row) => ({
    teamA: row.team_a,
    teamB: row.team_b,
    game: row.game,
    lower: row.lower,
    points: Number(row.points),
    sig: row.sig,
  }));
}

/**
 * Saves one pairing's four Games: a set Game is written with the Pairs it
 * was set against (`sigs`), a cleared one is deleted.
 */
export async function savePairingSpreads(
  supabase: SupabaseClient,
  teamA: string,
  teamB: string,
  entries: SpreadEntry[],
  sigs: Record<LineupGame, string>,
): Promise<void> {
  const rows = entries.flatMap(({ game, set }) =>
    set ? [{ team_a: teamA, team_b: teamB, game, lower: set.lower, points: set.points, sig: sigs[game] }] : [],
  );
  if (rows.length > 0) {
    const { error } = await supabase.from("ddd_spreads").upsert(rows, { onConflict: "team_a,team_b,game" });
    if (error) throw new Error(`Saving the Spreads failed: ${error.message}`);
  }
  const cleared = entries.filter((entry) => !entry.set).map((entry) => entry.game);
  if (cleared.length > 0) {
    const { error } = await supabase.from("ddd_spreads").delete().eq("team_a", teamA).eq("team_b", teamB).in("game", cleared);
    if (error) throw new Error(`Clearing a Spread failed: ${error.message}`);
  }
}

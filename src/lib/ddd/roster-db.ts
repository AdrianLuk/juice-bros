/**
 * The roster in the database (issue #712): read it, replace it from a paste,
 * and edit, add, remove or move one player, all through the caller's
 * `SupabaseClient` so RLS keeps it to Organizers. Relative imports only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { MAX_PLAYERS_PER_TEAM, type RosterPlayer, type RosterTeam, type StoredTeam } from "./roster.ts";

type TeamRow = {
  id: string;
  name: string;
  position: number;
  ddd_players: {
    id: string;
    name: string;
    gender: "M" | "F";
    position: number;
    dupr: number | null;
    duar: number | null;
    dusr: number | null;
  }[];
};

/** A DDD's Teams in order, each with its players in order. Empty before the first paste. */
export async function getRoster(supabase: SupabaseClient, eventId: string): Promise<StoredTeam[]> {
  const { data, error } = await supabase
    .from("ddd_teams")
    .select("id, name, position, ddd_players (id, name, gender, position, dupr, duar, dusr)")
    .eq("event_id", eventId)
    .order("position");
  if (error) throw new Error(`Reading the roster failed: ${error.message}`);
  return ((data ?? []) as TeamRow[]).map((team) => ({
    id: team.id,
    name: team.name,
    players: [...team.ddd_players]
      .sort((a, b) => a.position - b.position)
      .map(({ id, name, gender, dupr, duar, dusr }) => ({ id, name, gender, dupr, duar, dusr })),
  }));
}

export type RosterSaved = { ok: true } | { ok: false; problem: string };

/** Replaces the whole roster with a paste's Teams. The caller has already checked `canSave`. */
export async function replaceRoster(supabase: SupabaseClient, eventId: string, teams: RosterTeam[]): Promise<RosterSaved> {
  const { error } = await supabase.rpc("ddd_replace_roster", { p_event_id: eventId, p_teams: teams });
  if (error?.code === "42501") return { ok: false, problem: "Only an Organizer can set the roster." };
  if (error?.code === "P0002") return { ok: false, problem: "That DDD is gone. Reload the page." };
  if (error?.code === "22023") return { ok: false, problem: "A DDD has exactly 4 Teams." };
  if (error?.code === "23514" || error?.code === "23505") {
    return { ok: false, problem: "Something in the roster is out of range or doubled up. Check the preview and paste again." };
  }
  if (error) throw new Error(`Saving the roster failed: ${error.message}`);
  return { ok: true };
}

function columns(player: RosterPlayer) {
  return { name: player.name, gender: player.gender, dupr: player.dupr, duar: player.duar, dusr: player.dusr };
}

/** The next free position on a Team, or null when it is full. */
async function nextPosition(supabase: SupabaseClient, teamId: string): Promise<number | null> {
  const { data, error } = await supabase.from("ddd_players").select("position").eq("team_id", teamId);
  if (error) throw new Error(`Reading a Team failed: ${error.message}`);
  const used = (data ?? []).map((row) => row.position as number);
  const next = used.length === 0 ? 1 : Math.max(...used) + 1;
  return next > MAX_PLAYERS_PER_TEAM ? null : next;
}

const FULL = `A Team holds ${MAX_PLAYERS_PER_TEAM} players at most.`;

export async function addPlayer(supabase: SupabaseClient, teamId: string, player: RosterPlayer): Promise<RosterSaved> {
  const position = await nextPosition(supabase, teamId);
  if (position === null) return { ok: false, problem: FULL };
  const { error } = await supabase.from("ddd_players").insert({ team_id: teamId, position, ...columns(player) });
  if (error) throw new Error(`Adding a player failed: ${error.message}`);
  return { ok: true };
}

export async function updatePlayer(supabase: SupabaseClient, playerId: string, player: RosterPlayer): Promise<void> {
  const { error } = await supabase.from("ddd_players").update(columns(player)).eq("id", playerId);
  if (error) throw new Error(`Saving a player failed: ${error.message}`);
}

export async function removePlayer(supabase: SupabaseClient, playerId: string): Promise<void> {
  const { error } = await supabase.from("ddd_players").delete().eq("id", playerId);
  if (error) throw new Error(`Removing a player failed: ${error.message}`);
}

/** Moves a player to the end of another Team. */
export async function movePlayer(supabase: SupabaseClient, playerId: string, teamId: string): Promise<RosterSaved> {
  const position = await nextPosition(supabase, teamId);
  if (position === null) return { ok: false, problem: FULL };
  const { error } = await supabase.from("ddd_players").update({ team_id: teamId, position }).eq("id", playerId);
  if (error) throw new Error(`Moving a player failed: ${error.message}`);
  return { ok: true };
}

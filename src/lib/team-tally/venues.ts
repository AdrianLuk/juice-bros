/**
 * The Organizer's Venues (issue #698): facilities drawn on the court grid and
 * saved to their account, to pick each opening Matchup's Court pair from.
 *
 * Takes the caller's `SupabaseClient`, so RLS keeps an Organizer to their own
 * Venues. Relative imports only, so `node --test` loads it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { duplicateNumbers, readGrid, type CourtGrid } from "../court-grid/grid.ts";

export const MAX_VENUE_NAME = 40;

export type Venue = {
  id: string;
  name: string;
  grid: CourtGrid;
};

/** What stops a Venue saving, in the Organizer's words, or `null` when it can save. */
export function venueProblem(name: string, grid: CourtGrid): string | null {
  const trimmed = name.trim();
  if (trimmed === "") return "Give the venue a name.";
  if (trimmed.length > MAX_VENUE_NAME) return `Keep the venue's name to ${MAX_VENUE_NAME} characters.`;
  if (grid.courts.length === 0) return "Draw at least one court.";
  const repeated = duplicateNumbers(grid);
  if (repeated.length > 0) {
    return `Two courts are numbered ${repeated[0]}. Give each court its own number.`;
  }
  return null;
}

type VenueRow = { id: string; name: string; grid: unknown };

function toVenue(row: VenueRow): Venue | null {
  const grid = readGrid(row.grid);
  return grid ? { id: row.id, name: row.name, grid } : null;
}

/**
 * The Organizer's own Venues, most recently saved first. Filtered by owner
 * because the Superadmin's RLS reaches every Organizer's, and setup should
 * offer only their own.
 */
export async function listVenues(supabase: SupabaseClient, ownerId: string): Promise<Venue[]> {
  const { data, error } = await supabase
    .from("team_tally_venues")
    .select("id, name, grid")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Listing Venues failed: ${error.message}`);
  return ((data ?? []) as VenueRow[]).map(toVenue).filter((venue): venue is Venue => venue !== null);
}

export type VenueSaved = { ok: true; venue: Venue } | { ok: false; problem: string };

/** Saves a new Venue, or changes `id`. The caller has already checked `venueProblem`. */
export async function saveVenue(
  supabase: SupabaseClient,
  venue: { id?: string; name: string; grid: CourtGrid },
): Promise<VenueSaved> {
  const fields = { name: venue.name.trim(), grid: venue.grid, updated_at: new Date().toISOString() };
  const query = venue.id
    ? supabase.from("team_tally_venues").update(fields).eq("id", venue.id)
    : supabase.from("team_tally_venues").insert(fields);
  const { data, error } = await query.select("id, name, grid").maybeSingle();
  if (error?.code === "23505") {
    return { ok: false, problem: `You already have a venue called ${fields.name}. Pick another name.` };
  }
  if (error) throw new Error(`Saving a Venue failed: ${error.message}`);
  const saved = data ? toVenue(data as VenueRow) : null;
  if (!saved) return { ok: false, problem: "That venue is gone. Reload the page." };
  return { ok: true, venue: saved };
}

export async function deleteVenue(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("team_tally_venues").delete().eq("id", id);
  if (error) throw new Error(`Forgetting a Venue failed: ${error.message}`);
}

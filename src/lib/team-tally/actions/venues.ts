"use server";

import { readGrid } from "../../court-grid/grid.ts";
import { verifyOrganizer } from "../dal.ts";
import { createClient } from "../supabase/server.ts";
import { deleteVenue, saveVenue, venueProblem, type VenueSaved } from "../venues.ts";

/**
 * Saves a Venue the Organizer drew in setup: a new one, or `id` changed.
 * Reachable by a direct POST, so it checks the Organizer and the grid itself;
 * RLS keeps a change to their own Venues.
 */
export async function saveVenueAction(input: { id?: string; name: string; grid: unknown }): Promise<VenueSaved> {
  await verifyOrganizer();
  const grid = readGrid(input.grid);
  if (!grid) return { ok: false, problem: "That drawing didn't come through. Reload the page and try again." };
  const name = String(input.name ?? "");
  const problem = venueProblem(name, grid);
  if (problem) return { ok: false, problem };
  try {
    return await saveVenue(await createClient(), { id: input.id ? String(input.id) : undefined, name, grid });
  } catch {
    return { ok: false, problem: "Couldn't save the venue. Try again." };
  }
}

/** Forgets a Venue. Team Events set up on it keep their Home courts. */
export async function deleteVenueAction(id: string): Promise<{ ok: true } | { ok: false; problem: string }> {
  await verifyOrganizer();
  try {
    await deleteVenue(await createClient(), String(id));
    return { ok: true };
  } catch {
    return { ok: false, problem: "Couldn't forget the venue. Try again." };
  }
}

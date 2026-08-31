import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { FloorMode } from "./session/types.ts";

/**
 * A Club: the tenant and the owner of everything below it. Seeded by hand
 * (self-serve club creation is out of scope, #238); the app only ever reads
 * one — the signed-in Organizer's own, enforced by the one-per-owner unique
 * index and by RLS.
 */
export type Club = {
  id: string;
  name: string;
  venueName: string;
  courtCount: number;
  groupCap: number;
  floorMode: FloorMode;
};

type ClubRow = {
  id: string;
  name: string;
  venue_name: string;
  court_count: number;
  group_cap: number;
  floor_mode: FloorMode;
};

function toClub(row: ClubRow): Club {
  return {
    id: row.id,
    name: row.name,
    venueName: row.venue_name,
    courtCount: row.court_count,
    groupCap: row.group_cap,
    floorMode: row.floor_mode,
  };
}

/**
 * The Organizer's own Club, or null if none has been seeded for their account
 * yet. RLS already scopes `on_deck_clubs` to the caller, so this needs no
 * `owner_id` filter of its own.
 */
export async function getOwnedClub(
  supabase: SupabaseClient,
): Promise<Club | null> {
  const { data, error } = await supabase
    .from("on_deck_clubs")
    .select("id, name, venue_name, court_count, group_cap, floor_mode")
    .maybeSingle();

  if (error) {
    throw new Error(`loading the Organizer's Club failed: ${error.message}`);
  }

  return data ? toClub(data as ClubRow) : null;
}

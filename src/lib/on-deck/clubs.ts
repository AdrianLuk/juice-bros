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
  /**
   * IANA zone the Club's nights are named on (issue #469). Display only —
   * every timestamp is a `timestamptz`. A Session snapshots this at creation,
   * so changing it here renames future nights, never past ones.
   */
  timeZone: string;
};

type ClubRow = {
  id: string;
  name: string;
  venue_name: string;
  court_count: number;
  group_cap: number;
  floor_mode: FloorMode;
  time_zone: string;
};

function toClub(row: ClubRow): Club {
  return {
    id: row.id,
    name: row.name,
    venueName: row.venue_name,
    courtCount: row.court_count,
    groupCap: row.group_cap,
    floorMode: row.floor_mode,
    timeZone: row.time_zone,
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
    .select("id, name, venue_name, court_count, group_cap, floor_mode, time_zone")
    .maybeSingle();

  if (error) {
    throw new Error(`loading the Organizer's Club failed: ${error.message}`);
  }

  return data ? toClub(data as ClubRow) : null;
}

/**
 * Saves the Organizer's Club defaults — venue, court count, group cap (issue
 * #254) and the Club's clock (issue #469). Goes through the `on_deck_update_club_defaults` RPC because
 * `on_deck_clubs` carries no UPDATE grant (the foundation's "seeded by hand"
 * posture); the RPC touches only those four columns and checks ownership. An
 * unknown zone is refused by the table's own trigger, not by the RPC.
 */
export async function updateClubDefaults(
  supabase: SupabaseClient,
  input: {
    venueName: string;
    courtCount: number;
    groupCap: number;
    timeZone: string;
  },
): Promise<void> {
  const { error } = await supabase.rpc("on_deck_update_club_defaults", {
    p_venue_name: input.venueName,
    p_court_count: input.courtCount,
    p_group_cap: input.groupCap,
    p_time_zone: input.timeZone,
  });

  if (error) {
    throw new Error(`saving the Club defaults failed: ${error.message}`);
  }
}

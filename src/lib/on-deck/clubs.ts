import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClubDefaults, FloorMode } from "./session/types.ts";

/**
 * A Club: the tenant and the owner of everything below it. Created by the
 * Organizer themselves in two fields (#515) through `createClub`, because
 * `on_deck_clubs` carries no INSERT grant outside `service_role`. The app only
 * ever reads one — the signed-in Organizer's own, enforced by the
 * one-per-owner unique index and by RLS.
 */
export type Club = ClubDefaults & {
  id: string;
  /**
   * IANA zone the Club's nights are named on (issue #469). Display only:
   * every timestamp is a `timestamptz`. A Session snapshots this at creation,
   * so changing it here renames future nights, never past ones.
   *
   * `null` means nobody has said yet. The Organizer is never asked, because
   * their own browser already knows — `adoptDetectedTimeZone` fills this in on
   * their first visit and only while it is null.
   */
  timeZone: string | null;
};

type ClubRow = {
  id: string;
  name: string;
  venue_name: string;
  court_count: number;
  group_cap: number;
  floor_mode: FloorMode;
  time_zone: string | null;
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
 * The Organizer's own Club, or null if they have not created one yet. RLS
 * already scopes `on_deck_clubs` to the caller, so this needs no `owner_id`
 * filter of its own.
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
 * Adopts a zone for a Club that has none, and does nothing at all otherwise.
 *
 * The `is null` in the RPC is what makes this safe to fire on every visit: an
 * Organizer who set their clock by hand, or who is reading the board from a
 * hotel in another country, cannot have it silently rewritten by whatever
 * device they happen to be holding.
 */
export async function adoptClubTimeZone(
  supabase: SupabaseClient,
  timeZone: string,
): Promise<void> {
  const { error } = await supabase.rpc("on_deck_adopt_club_time_zone", {
    p_time_zone: timeZone,
  });

  if (error) {
    throw new Error(`adopting the Club's time zone failed: ${error.message}`);
  }
}

/**
 * Sets the Club's clock outright — the Organizer saying the adopted guess was
 * wrong. The counterpart to `adoptClubTimeZone`, which can only ever fill a
 * blank one.
 */
export async function setClubTimeZone(
  supabase: SupabaseClient,
  timeZone: string,
): Promise<void> {
  const { error } = await supabase.rpc("on_deck_set_club_time_zone", {
    p_time_zone: timeZone,
  });

  if (error) {
    throw new Error(`saving the Club's time zone failed: ${error.message}`);
  }
}

/**
 * The one-per-owner rule, refused. Not a failure: the caller already has the
 * Club they were trying to make, so the screen they are about to see is the
 * one they wanted.
 *
 * `on_deck_create_club` raises this as a `23505`, distinct from the `42501`
 * the same function uses for "not signed in", so this is a code check rather
 * than a message check.
 */
export class ClubAlreadyExistsError extends Error {
  constructor() {
    super("this account already has a Club");
    this.name = "ClubAlreadyExistsError";
  }
}

/**
 * Creates the Organizer's own Club and returns its id (issue #515).
 *
 * Two fields, because somebody who has not run a night yet has nothing to base
 * a group cap on. Venue name starts as the Club's name and everything else
 * takes the schema's defaults; all of it is editable in Settings afterwards,
 * which is what makes asking so little safe.
 *
 * Goes through an RPC rather than an insert because `on_deck_clubs` carries no
 * INSERT grant for anyone but `service_role`, and that stays true — the same
 * posture that keeps a Player out of the table keeps a signed-in stranger from
 * writing an `owner_id` that is not theirs.
 */
export async function createClub(
  supabase: SupabaseClient,
  input: { name: string; courtCount: number },
): Promise<string> {
  const { data, error } = await supabase.rpc("on_deck_create_club", {
    p_name: input.name,
    p_court_count: input.courtCount,
  });

  if (error) {
    // 23505 = unique_violation, which this RPC raises for the one-per-owner
    // rule as well as inheriting from the index behind it.
    if (error.code === "23505") {
      throw new ClubAlreadyExistsError();
    }
    throw new Error(`creating the Club failed: ${error.message}`);
  }

  return data as string;
}

/**
 * Saves the Organizer's Club — name, venue, court count, group cap, Floor Mode
 * (issues #254, #515). Goes through the `on_deck_update_club_defaults` RPC
 * because `on_deck_clubs` carries no UPDATE grant; the RPC checks ownership and
 * leaves `owner_id` and `created_at` alone.
 *
 * The name and Floor Mode joined this path when Clubs became self-serve. Both
 * used to be fixed by whoever ran the insert; now the name is typed by a
 * stranger into a two-field form and shown to every Player who opens the Club's
 * link, and the Floor Mode is never chosen at all.
 *
 * The Club's clock is deliberately *not* here. Folding it in would mean saving
 * a court count also commits a zone — and for a Club that has none yet, the
 * one the form happened to be pre-filled with. `setClubTimeZone` is its own
 * path for that reason.
 */
export async function updateClubDefaults(
  supabase: SupabaseClient,
  input: ClubDefaults,
): Promise<void> {
  const { error } = await supabase.rpc("on_deck_update_club_defaults", {
    p_name: input.name,
    p_venue_name: input.venueName,
    p_court_count: input.courtCount,
    p_group_cap: input.groupCap,
    p_floor_mode: input.floorMode,
  });

  if (error) {
    throw new Error(`saving the Club defaults failed: ${error.message}`);
  }
}

/**
 * A Club's display name for somebody holding its link and nothing else.
 *
 * Goes through the `on_deck_club_name` RPC rather than a select, because
 * `on_deck_clubs` is owner-only under RLS and the reader here is a Player
 * with no account (issue #510). Null for a link that matches no Club, which
 * the caller renders the same as any other unknown link.
 */
export async function getPublicClubName(
  supabase: SupabaseClient,
  clubId: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("on_deck_club_name", {
    p_club_id: clubId,
  });

  if (error) {
    throw new Error(`loading the Club's name failed: ${error.message}`);
  }

  return (data as string | null) ?? null;
}

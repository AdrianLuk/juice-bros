/**
 * A running Team Event in the database (issue #623): the three reads (Public
 * Link, Score Link, Organizer) and the score and roster writes, each through
 * its token or Organizer function in
 * supabase/migrations/20261009120000_team_tally_live_scoring.sql.
 *
 * A write the database refuses for a reason a person can act on (an
 * impossible score, a Game outside the Matchup, a scored Round's slot) comes
 * back as `{ ok: false, problem }` with the database's own words; anything
 * else throws. Relative imports only, so `npm run test:db` loads it directly.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { TeamEventDoc } from "./event-doc.ts";
import type { Roster } from "./roster.ts";

export type WriteResult = { ok: true } | { ok: false; problem: string };

export type ScoreLinkView = {
  event: TeamEventDoc;
  /** The Team this Score Link belongs to. */
  myTeamId: string;
};

/** Refusals a captain or the Organizer is told about, by Postgres error code. */
const TOLD_CODES = new Set(["22023", "42501", "P0002"]);

function asResult(error: { code?: string; message: string } | null, what: string): WriteResult {
  if (!error) return { ok: true };
  if (error.code && TOLD_CODES.has(error.code)) {
    return { ok: false, problem: error.message };
  }
  throw new Error(`${what} failed: ${error.message}`);
}

async function readDoc(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<(TeamEventDoc & { myTeamId?: string }) | null> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    // A malformed id is "not found", not a crash.
    if (error.code === "22P02") return null;
    throw new Error(`Reading the Team Event failed: ${error.message}`);
  }
  return (data as (TeamEventDoc & { myTeamId?: string }) | null) ?? null;
}

/** The Team Event behind a Public Link token, or null. */
export async function loadPublicEvent(supabase: SupabaseClient, token: string): Promise<TeamEventDoc | null> {
  return readDoc(supabase, "team_tally_public_event", { p_token: token });
}

/** The Team Event behind a Score Link token and which Team holds it, or null. */
export async function loadScoreLinkEvent(supabase: SupabaseClient, token: string): Promise<ScoreLinkView | null> {
  const doc = await readDoc(supabase, "team_tally_score_link_event", { p_token: token });
  if (!doc?.myTeamId) return null;
  const { myTeamId, ...event } = doc;
  return { event, myTeamId };
}

/** The signed-in Organizer's own Team Event, or null when it isn't theirs. */
export async function loadOrganizerEvent(supabase: SupabaseClient, eventId: string): Promise<TeamEventDoc | null> {
  return readDoc(supabase, "team_tally_organizer_event", { p_event_id: eventId });
}

/** A captain's score for a Game in their Matchup, red side first. Null and null clears it. */
export async function saveScoreByLink(
  supabase: SupabaseClient,
  token: string,
  gameId: string,
  red: number | null,
  blue: number | null,
): Promise<WriteResult> {
  const { error } = await supabase.rpc("team_tally_score_game", {
    p_token: token,
    p_game_id: gameId,
    p_red: red,
    p_blue: blue,
  });
  return asResult(error, "Saving the score");
}

/** The Organizer's score for any Game of their Team Event. */
export async function saveScoreAsOrganizer(
  supabase: SupabaseClient,
  gameId: string,
  red: number | null,
  blue: number | null,
): Promise<WriteResult> {
  const { error } = await supabase.rpc("team_tally_organizer_score_game", {
    p_game_id: gameId,
    p_red: red,
    p_blue: blue,
  });
  return asResult(error, "Saving the score");
}

/** A captain renames or reorders their own Team's slots A, B and C. */
export async function setSlotsByLink(supabase: SupabaseClient, token: string, roster: Roster): Promise<WriteResult> {
  const { error } = await supabase.rpc("team_tally_set_slots", {
    p_token: token,
    p_slot_a: roster.slotA,
    p_slot_b: roster.slotB,
    p_slot_c: roster.slotC,
  });
  return asResult(error, "Saving the roster");
}

/** The Organizer renames or reorders any of their Teams' slots. */
export async function setSlotsAsOrganizer(
  supabase: SupabaseClient,
  teamId: string,
  roster: Roster,
): Promise<WriteResult> {
  const { error } = await supabase.rpc("team_tally_organizer_set_slots", {
    p_team_id: teamId,
    p_slot_a: roster.slotA,
    p_slot_b: roster.slotB,
    p_slot_c: roster.slotC,
  });
  return asResult(error, "Saving the roster");
}

// ---------------------------------------------------------------------------
// Matchup done, the Dreambreaker and Seeding (issue #624), in
// supabase/migrations/20261009150000_team_tally_flights.sql
// ---------------------------------------------------------------------------

async function call(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
  what: string,
): Promise<WriteResult> {
  const { error } = await supabase.rpc(fn, args);
  return asResult(error, what);
}

/** A captain marks their Matchup done. The last opening one places the Flights. */
export async function markDoneByLink(supabase: SupabaseClient, token: string, matchupId: string): Promise<WriteResult> {
  return call(supabase, "team_tally_mark_done", { p_token: token, p_matchup_id: matchupId }, "Marking the Matchup done");
}

/** The Organizer marks any of their Matchups done. */
export async function markDoneAsOrganizer(supabase: SupabaseClient, matchupId: string): Promise<WriteResult> {
  return call(supabase, "team_tally_organizer_mark_done", { p_matchup_id: matchupId }, "Marking the Matchup done");
}

/** The Organizer reopens a done Matchup. */
export async function reopenAsOrganizer(supabase: SupabaseClient, matchupId: string): Promise<WriteResult> {
  return call(supabase, "team_tally_organizer_reopen", { p_matchup_id: matchupId }, "Reopening the Matchup");
}

/** A captain records who won their tied Matchup's Dreambreaker (null clears it). */
export async function setDreambreakerByLink(
  supabase: SupabaseClient,
  token: string,
  matchupId: string,
  winnerTeamId: string | null,
): Promise<WriteResult> {
  return call(
    supabase,
    "team_tally_set_dreambreaker",
    { p_token: token, p_matchup_id: matchupId, p_winner_team_id: winnerTeamId },
    "Saving the Dreambreaker",
  );
}

/** The Organizer records a Dreambreaker winner. */
export async function setDreambreakerAsOrganizer(
  supabase: SupabaseClient,
  matchupId: string,
  winnerTeamId: string | null,
): Promise<WriteResult> {
  return call(
    supabase,
    "team_tally_organizer_set_dreambreaker",
    { p_matchup_id: matchupId, p_winner_team_id: winnerTeamId },
    "Saving the Dreambreaker",
  );
}

/** Seed now: the Flights from the scores as they stand. */
export async function seedNowAsOrganizer(supabase: SupabaseClient, eventId: string): Promise<WriteResult> {
  return call(supabase, "team_tally_organizer_seed_now", { p_event_id: eventId }, "Placing the Flights");
}

/** The Organizer orders Teams level on every count, first ahead. */
export async function setTieOrderAsOrganizer(
  supabase: SupabaseClient,
  eventId: string,
  teamIds: string[],
): Promise<WriteResult> {
  return call(supabase, "team_tally_organizer_set_tie_order", { p_event_id: eventId, p_team_ids: teamIds }, "Saving the order");
}

/** The Organizer swaps two Flights' court pairs, before any Flight score. */
export async function swapFlightCourtsAsOrganizer(
  supabase: SupabaseClient,
  flightId: string,
  otherFlightId: string,
): Promise<WriteResult> {
  return call(
    supabase,
    "team_tally_organizer_swap_flight_courts",
    { p_flight_id: flightId, p_other_flight_id: otherFlightId },
    "Swapping the courts",
  );
}

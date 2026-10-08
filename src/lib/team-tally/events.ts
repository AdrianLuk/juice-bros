/**
 * The Organizer's Team Events in the database (issue #622): save the setup
 * form, list the nights, load one back for its Brief.
 *
 * Takes the caller's `SupabaseClient`, so every read and write runs under the
 * signed-in Organizer's RLS (an Organizer reaches only their own Team Events).
 * Relative imports only, so `npm run test:db` loads it directly.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { BriefInput, BriefTeam } from "./brief.ts";
import { publicLinkPath, scoreLinkPath } from "./routes.ts";
import type { SetupMatchup, SetupTeam, TeamEventSetup } from "./setup.ts";

export type TeamEventStatus = "opening" | "flights" | "finished";

export type TeamEventSummary = {
  id: string;
  name: string;
  /** `YYYY-MM-DD`. */
  date: string;
  status: TeamEventStatus;
  teamCount: number;
};

export type SavedTeam = SetupTeam & {
  id: string;
  /** The token behind this Team's Score Link. */
  scoreToken: string;
};

export type LoadedTeamEvent = {
  id: string;
  name: string;
  date: string;
  status: TeamEventStatus;
  /** The token behind the Public Link. */
  publicToken: string;
  /** In setup order. */
  teams: SavedTeam[];
  /** Opening Matchups in MATCH order, by index into `teams`. */
  matchups: SetupMatchup[];
};

/**
 * Creates a Team Event, or edits `eventId`. Returns its id. The caller has
 * already run `validateSetup`; the database refuses what slips past it.
 */
export async function saveTeamEvent(
  supabase: SupabaseClient,
  setup: TeamEventSetup,
  eventId?: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("team_tally_save_event", {
    p_event_id: eventId ?? null,
    p_name: setup.name.trim(),
    p_event_date: setup.date,
    p_teams: setup.teams.map((team) => ({
      id: team.id ?? null,
      nickname: team.nickname,
      captain: team.captain,
      slotA: team.slotA,
      slotB: team.slotB,
      slotC: team.slotC,
      homeCourt: team.homeCourt,
    })),
    p_matchups: setup.matchups.map(({ red, blue }) => ({ red, blue })),
  });

  if (error || typeof data !== "string") {
    throw new Error(`Saving the Team Event failed: ${error?.message ?? "no id returned"}`);
  }
  return data;
}

/** The Organizer's Team Events, the latest night first. */
export async function listTeamEvents(supabase: SupabaseClient): Promise<TeamEventSummary[]> {
  const { data, error } = await supabase
    .from("team_tally_events")
    .select("id, name, event_date, status, team_tally_teams(count)")
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Listing Team Events failed: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    date: row.event_date,
    status: row.status,
    teamCount: (row.team_tally_teams as unknown as { count: number }[])[0]?.count ?? 0,
  }));
}

type SlotRow = { position: "captain" | "A" | "B" | "C"; name: string };
type TeamRow = {
  id: string;
  position: number;
  nickname: string | null;
  home_court: string;
  score_token: string;
  team_tally_player_slots: SlotRow[];
};
type MatchupRow = { number: number; red_team_id: string; blue_team_id: string };

/** One of the Organizer's Team Events, or null when it isn't theirs or doesn't exist. */
export async function loadTeamEvent(
  supabase: SupabaseClient,
  eventId: string,
): Promise<LoadedTeamEvent | null> {
  const { data, error } = await supabase
    .from("team_tally_events")
    .select(
      `id, name, event_date, status, public_token,
       team_tally_teams(id, position, nickname, home_court, score_token,
         team_tally_player_slots(position, name)),
       team_tally_matchups(number, stage, red_team_id, blue_team_id)`,
    )
    .eq("id", eventId)
    .eq("team_tally_matchups.stage", "opening")
    .maybeSingle();

  if (error) {
    // A malformed id is "not found" to the Organizer, not a crash.
    if (error.code === "22P02") return null;
    throw new Error(`Loading the Team Event failed: ${error.message}`);
  }
  if (!data) return null;

  const teamRows = [...(data.team_tally_teams as TeamRow[])].sort((a, b) => a.position - b.position);
  const indexOf = new Map(teamRows.map((team, index) => [team.id, index]));
  const slot = (team: TeamRow, position: SlotRow["position"]) =>
    team.team_tally_player_slots.find((row) => row.position === position)?.name ?? "";

  return {
    id: data.id,
    name: data.name,
    date: data.event_date,
    status: data.status,
    publicToken: data.public_token,
    teams: teamRows.map((team) => ({
      id: team.id,
      scoreToken: team.score_token,
      nickname: team.nickname ?? "",
      captain: slot(team, "captain"),
      slotA: slot(team, "A"),
      slotB: slot(team, "B"),
      slotC: slot(team, "C"),
      homeCourt: team.home_court,
    })),
    matchups: [...(data.team_tally_matchups as MatchupRow[])]
      .sort((a, b) => a.number - b.number)
      .map((matchup) => ({
        red: indexOf.get(matchup.red_team_id) ?? -1,
        blue: indexOf.get(matchup.blue_team_id) ?? -1,
      })),
  };
}

/**
 * What the Brief needs from a loaded Team Event: its opening Matchups in MATCH
 * order, each Team with its own Score Link, and the Public Link, all absolute
 * on `origin` so they work pasted into a group chat.
 */
export function briefInputFor(event: LoadedTeamEvent, origin: string): BriefInput {
  const briefTeam = (index: number): BriefTeam => {
    const team = event.teams[index];
    return {
      captain: team.captain,
      slotA: team.slotA,
      slotB: team.slotB,
      slotC: team.slotC,
      nickname: team.nickname,
      homeCourt: team.homeCourt,
      scoreLink: `${origin}${scoreLinkPath(team.scoreToken)}`,
    };
  };

  return {
    publicLink: `${origin}${publicLinkPath(event.publicToken)}`,
    matchups: event.matchups.map(({ red, blue }) => ({ red: briefTeam(red), blue: briefTeam(blue) })),
  };
}

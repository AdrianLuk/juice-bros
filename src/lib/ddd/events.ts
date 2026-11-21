/**
 * DDDs (issue #711): the setup form's rules, and reading and writing DDDs
 * through the caller's `SupabaseClient`, so RLS keeps it to Organizers.
 * Relative imports only, so `node --test` loads it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { RawLineup } from "./lineup.ts";
import type { StoredTeam } from "./roster.ts";

/** What the setup form sends: courts in order, court 1 first. */
export type DddSetup = {
  name: string;
  /** YYYY-MM-DD */
  date: string;
  playVenue: string;
  dineVenue: string;
  courts: string[];
};

/** What every DDD screen's header shows. */
export type DddHeader = {
  id: string;
  name: string;
  date: string;
  playVenue: string;
  dineVenue: string;
};

export type DddEvent = DddHeader & {
  courts: string[];
  scoreToken: string;
  publicToken: string;
};

export type LinkEvent = DddHeader & {
  link: "score" | "public";
  courts: string[];
  teams: (StoredTeam & { lineup: RawLineup | null })[];
};

export const MAX_NAME = 80;
export const MAX_VENUE = 60;
export const MAX_COURTS = 20;

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** What stops the DDD saving, in the Organizer's words, or `null` when it can save. */
export function eventProblem(setup: DddSetup): string | null {
  const name = setup.name.trim();
  if (name === "") return "Give the DDD a name.";
  if (name.length > MAX_NAME) return `Keep the name to ${MAX_NAME} characters.`;
  if (!isRealDate(setup.date)) return "Pick the date.";
  if (setup.playVenue.trim() === "") return "Pick the play venue.";
  if (setup.playVenue.trim().length > MAX_VENUE) return `Keep the play venue to ${MAX_VENUE} characters.`;
  if (setup.courts.length === 0) return "Tap the courts you booked.";
  if (setup.courts.length > MAX_COURTS) return `Book ${MAX_COURTS} courts at most.`;
  const dine = setup.dineVenue.trim();
  if (dine === "") return "Name the dine & drink venue.";
  if (dine.length > MAX_VENUE) return `Keep the dine & drink venue to ${MAX_VENUE} characters.`;
  return null;
}

/** "Sat Nov 28, 2026". The date is a calendar day, so no time zone moves it. */
export function formatDddDate(date: string): string {
  const day = new Date(`${date}T12:00:00Z`);
  const weekday = day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const rest = day.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${weekday} ${rest}`;
}

type EventRow = {
  id: string;
  name: string;
  event_date: string;
  play_venue: string;
  dine_venue: string;
};

function toHeader(row: EventRow): DddHeader {
  return { id: row.id, name: row.name, date: row.event_date, playVenue: row.play_venue, dineVenue: row.dine_venue };
}

/** Every DDD, newest first. */
export async function listEvents(supabase: SupabaseClient): Promise<DddHeader[]> {
  const { data, error } = await supabase
    .from("ddd_events")
    .select("id, name, event_date, play_venue, dine_venue")
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Listing DDDs failed: ${error.message}`);
  return ((data ?? []) as EventRow[]).map(toHeader);
}

/** One DDD with its courts and link tokens, or null when it isn't there. */
export async function getEvent(supabase: SupabaseClient, id: string): Promise<DddEvent | null> {
  const { data, error } = await supabase
    .from("ddd_events")
    .select("id, name, event_date, play_venue, dine_venue, score_token, public_token, ddd_courts (name, position)")
    .eq("id", id)
    .maybeSingle();
  // 22P02: not a uuid, so not a DDD.
  if (error?.code === "22P02") return null;
  if (error) throw new Error(`Reading a DDD failed: ${error.message}`);
  if (!data) return null;
  const row = data as EventRow & {
    score_token: string;
    public_token: string;
    ddd_courts: { name: string; position: number }[];
  };
  return {
    ...toHeader(row),
    courts: [...row.ddd_courts].sort((a, b) => a.position - b.position).map((court) => court.name),
    scoreToken: row.score_token,
    publicToken: row.public_token,
  };
}

export type Saved = { ok: true; id: string } | { ok: false; problem: string };

/** Creates a DDD (`id` null) or edits one. The caller has already checked `eventProblem`. */
export async function saveEvent(supabase: SupabaseClient, id: string | null, setup: DddSetup): Promise<Saved> {
  const { data, error } = await supabase.rpc("ddd_save_event", {
    p_event_id: id,
    p_name: setup.name.trim(),
    p_event_date: setup.date,
    p_play_venue: setup.playVenue.trim(),
    p_dine_venue: setup.dineVenue.trim(),
    p_courts: setup.courts,
  });
  if (error?.code === "42501") return { ok: false, problem: "Only an Organizer can set up a DDD." };
  if (error?.code === "P0002") return { ok: false, problem: "That DDD is gone. Reload the page." };
  if (error?.code === "22023") return { ok: false, problem: "Book 1 to 20 courts, each one once." };
  // A check constraint: the form's limits and the table's drifted apart.
  if (error?.code === "23514") return { ok: false, problem: "Something in the setup is too long. Shorten it and save again." };
  if (error) throw new Error(`Saving a DDD failed: ${error.message}`);
  return { ok: true, id: data as string };
}

/** The DDD behind a Score Link or Public Link token, or null. */
export async function readLinkEvent(supabase: SupabaseClient, token: string): Promise<LinkEvent | null> {
  const { data, error } = await supabase.rpc("ddd_link_event", { p_token: token });
  if (error) throw new Error(`Reading a DDD link failed: ${error.message}`);
  return (data as LinkEvent | null) ?? null;
}

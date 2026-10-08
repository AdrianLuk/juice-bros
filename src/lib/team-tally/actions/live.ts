"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { verifyOrganizer } from "../dal.ts";
import type { LiveView } from "../live-seam.ts";
import {
  loadOrganizerEvent,
  loadPublicEvent,
  loadScoreLinkEvent,
  markDoneAsOrganizer,
  markDoneByLink,
  putAheadAsOrganizer,
  reopenAsOrganizer,
  saveScoreAsOrganizer,
  saveScoreByLink,
  seedNowAsOrganizer,
  setDreambreakerAsOrganizer,
  setDreambreakerByLink,
  setSlotsAsOrganizer,
  setSlotsByLink,
  setTieOrderAsOrganizer,
  swapFlightCourtsAsOrganizer,
  type WriteResult,
} from "../live-events.ts";
import { checkGameScore } from "../score.ts";
import type { Roster } from "../roster.ts";
import { createClient } from "../supabase/server.ts";

/**
 * Who is reading or writing a running Team Event (issue #623): a Score Link
 * holder (the token is their credential), anyone with the Public Link, or the
 * signed-in Organizer. Each Server Action below is reachable by a direct
 * POST, so each one checks its own credential: the token functions in the
 * database check the token, and the Organizer path checks the session.
 */
export type LiveReader =
  | { kind: "score"; token: string }
  | { kind: "public"; token: string }
  | { kind: "organizer"; eventId: string };

/**
 * Who is writing: a Score Link by its token, or the signed-in Organizer (the
 * database finds the Team Event from the Game, Team or Matchup written).
 */
export type LiveWriter = { kind: "score"; token: string } | { kind: "organizer" };

export type { LiveView };

/** The current Team Event for a live screen, or null when the link or event is gone. */
export async function readLiveEvent(reader: LiveReader): Promise<LiveView | null> {
  const supabase = await createClient();

  if (reader.kind === "score") {
    return loadScoreLinkEvent(supabase, reader.token);
  }
  if (reader.kind === "public") {
    const event = await loadPublicEvent(supabase, reader.token);
    return event ? { event } : null;
  }

  await verifyOrganizer();
  const event = await loadOrganizerEvent(supabase, reader.eventId);
  return event ? { event } : null;
}

function asScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Saves one Game's score, red side first. */
export async function saveGameScore(
  writer: LiveWriter,
  gameId: string,
  red: number,
  blue: number,
): Promise<WriteResult> {
  const redScore = asScore(red);
  const blueScore = asScore(blue);
  if (redScore === null || blueScore === null) {
    return { ok: false, problem: "Enter both scores." };
  }
  const check = checkGameScore(redScore, blueScore);
  if (!check.ok) return check;

  const id = String(gameId);
  return asWriter(
    writer,
    (supabase, token) => saveScoreByLink(supabase, token, id, redScore, blueScore),
    (supabase) => saveScoreAsOrganizer(supabase, id, redScore, blueScore),
    "Couldn't save the score. Try again.",
  );
}

/** Saves a Team's slots A, B and C (a Score Link saves only its own Team's). */
export async function saveRoster(writer: LiveWriter, teamId: string, roster: Roster): Promise<WriteResult> {
  const clean: Roster = {
    slotA: String(roster?.slotA ?? ""),
    slotB: String(roster?.slotB ?? ""),
    slotC: String(roster?.slotC ?? ""),
  };

  const id = String(teamId);
  return asWriter(
    writer,
    (supabase, token) => setSlotsByLink(supabase, token, clean),
    (supabase) => setSlotsAsOrganizer(supabase, id, clean),
    "Couldn't save the roster. Try again.",
  );
}

/**
 * Runs a write as whoever holds the writer: a Score Link by its token, or the
 * signed-in Organizer. A refusal comes back with the database's reason;
 * anything else is a generic retry message.
 */
async function asWriter(
  writer: LiveWriter,
  byLink: (supabase: SupabaseClient, token: string) => Promise<WriteResult>,
  asOrganizer: (supabase: SupabaseClient) => Promise<WriteResult>,
  failed: string,
): Promise<WriteResult> {
  // Outside the try: a signed-out Organizer is redirected, by a throw.
  if (writer.kind === "organizer") await verifyOrganizer();
  try {
    const supabase = await createClient();
    return writer.kind === "score" ? await byLink(supabase, String(writer.token)) : await asOrganizer(supabase);
  } catch {
    return { ok: false, problem: failed };
  }
}

async function asOrganizerOnly(
  write: (supabase: SupabaseClient) => Promise<WriteResult>,
  failed: string,
): Promise<WriteResult> {
  await verifyOrganizer();
  try {
    return await write(await createClient());
  } catch {
    return { ok: false, problem: failed };
  }
}

/** Matchup done (issue #624): the last opening Matchup done places the Flights. */
export async function markMatchupDone(writer: LiveWriter, matchupId: string): Promise<WriteResult> {
  const id = String(matchupId);
  return asWriter(
    writer,
    (supabase, token) => markDoneByLink(supabase, token, id),
    (supabase) => markDoneAsOrganizer(supabase, id),
    "Couldn't mark the Matchup done. Try again.",
  );
}

/** Records who won a tied Matchup's Dreambreaker; null clears it. */
export async function recordDreambreaker(
  writer: LiveWriter,
  matchupId: string,
  winnerTeamId: string | null,
): Promise<WriteResult> {
  const id = String(matchupId);
  const winner = winnerTeamId === null ? null : String(winnerTeamId);
  return asWriter(
    writer,
    (supabase, token) => setDreambreakerByLink(supabase, token, id, winner),
    (supabase) => setDreambreakerAsOrganizer(supabase, id, winner),
    "Couldn't save the Dreambreaker. Try again.",
  );
}

/** The Organizer reopens a done Matchup. */
export async function reopenMatchup(matchupId: string): Promise<WriteResult> {
  return asOrganizerOnly((supabase) => reopenAsOrganizer(supabase, String(matchupId)), "Couldn't reopen it. Try again.");
}

/** Seed now: the Organizer places the Flights from the scores as they stand. */
export async function seedFlightsNow(eventId: string): Promise<WriteResult> {
  return asOrganizerOnly(
    (supabase) => seedNowAsOrganizer(supabase, String(eventId)),
    "Couldn't place the Flights. Try again.",
  );
}

/** The Organizer swaps two Flights' court pairs. */
export async function swapFlightCourts(flightId: string, otherFlightId: string): Promise<WriteResult> {
  return asOrganizerOnly(
    (supabase) => swapFlightCourtsAsOrganizer(supabase, String(flightId), String(otherFlightId)),
    "Couldn't swap the courts. Try again.",
  );
}

/**
 * After Seeding, the Organizer puts a Team ahead of the one above it across a
 * Flight line, when the two are level on every count: they change Flights.
 */
export async function putTeamAhead(eventId: string, teamId: string): Promise<WriteResult> {
  return asOrganizerOnly(
    (supabase) => putAheadAsOrganizer(supabase, String(eventId), String(teamId)),
    "Couldn't save the order. Try again.",
  );
}

/** The Organizer orders Teams level on every count, first ahead. */
export async function orderTiedTeams(eventId: string, teamIds: string[]): Promise<WriteResult> {
  const ids = Array.isArray(teamIds) ? teamIds.map(String) : [];
  return asOrganizerOnly(
    (supabase) => setTieOrderAsOrganizer(supabase, String(eventId), ids),
    "Couldn't save the order. Try again.",
  );
}

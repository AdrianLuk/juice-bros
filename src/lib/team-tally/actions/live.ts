"use server";

import { verifyOrganizer } from "../dal.ts";
import type { TeamEventDoc } from "../event-doc.ts";
import {
  loadOrganizerEvent,
  loadPublicEvent,
  loadScoreLinkEvent,
  saveScoreAsOrganizer,
  saveScoreByLink,
  setSlotsAsOrganizer,
  setSlotsByLink,
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

export type LiveWriter = { kind: "score"; token: string } | { kind: "organizer"; eventId: string };

export type LiveView = { event: TeamEventDoc; myTeamId?: string };

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

  // Outside the try: a signed-out Organizer is redirected, by a throw.
  if (writer.kind === "organizer") await verifyOrganizer();

  try {
    if (writer.kind === "score") {
      return await saveScoreByLink(await createClient(), writer.token, String(gameId), redScore, blueScore);
    }
    return await saveScoreAsOrganizer(await createClient(), String(gameId), redScore, blueScore);
  } catch {
    return { ok: false, problem: "Couldn't save the score. Try again." };
  }
}

/** Saves a Team's slots A, B and C (a Score Link saves only its own Team's). */
export async function saveRoster(writer: LiveWriter, teamId: string, roster: Roster): Promise<WriteResult> {
  const clean: Roster = {
    slotA: String(roster?.slotA ?? ""),
    slotB: String(roster?.slotB ?? ""),
    slotC: String(roster?.slotC ?? ""),
  };

  if (writer.kind === "organizer") await verifyOrganizer();

  try {
    if (writer.kind === "score") {
      return await setSlotsByLink(await createClient(), writer.token, clean);
    }
    return await setSlotsAsOrganizer(await createClient(), String(teamId), clean);
  } catch {
    return { ok: false, problem: "Couldn't save the roster. Try again." };
  }
}

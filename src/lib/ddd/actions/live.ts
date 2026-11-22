"use server";

import { revalidatePath } from "next/cache";

import { getVisitor, verifyOrganizer } from "../dal.ts";
import { checkDreambreakerScore } from "../dreambreakers.ts";
import { getEvent, punishmentsProblem, readLinkEvent, type LinkEvent } from "../events.ts";
import { DDD_ROOT } from "../routes.ts";
import { createClient } from "../supabase/server.ts";

/**
 * Round 1's reads and writes (#715). Each Server Action is reachable by a
 * direct POST, so each checks its own credential: a Score Link token is
 * checked by the database, the Organizer path by the session first and RLS
 * after.
 */

/** Who is reading a live screen: a link holder by token, or a signed-in Organizer. */
export type LiveReader = { kind: "score" | "public"; token: string } | { kind: "organizer"; eventId: string };

/** Who is writing a final: the Score Link by its token, or the signed-in Organizer. */
export type LiveWriter = { kind: "score"; token: string } | { kind: "organizer" };

export type WriteResult = { ok: true } | { ok: false; problem: string };

/** The DDD as a live screen shows it, or null when the link or DDD is gone. */
export async function readLive(reader: LiveReader): Promise<LinkEvent | null> {
  const supabase = await createClient();
  if (reader.kind !== "organizer") {
    const event = await readLinkEvent(supabase, String(reader.token));
    return event && event.link === reader.kind ? event : null;
  }
  await verifyOrganizer();
  const event = await getEvent(supabase, String(reader.eventId));
  // The Organizer reads what the Public Link shows, through its token.
  return event ? readLinkEvent(supabase, event.publicToken) : null;
}

function refusal(code: string | undefined): string {
  if (code === "42501") return "This link can't enter scores any more. Ask an Organizer for the current one.";
  if (code === "22023") return "A Dreambreaker ends 21 to anything from 0 to 20.";
  return "Couldn't save the score. Try again.";
}

async function writeFinal(
  writer: LiveWriter,
  teamA: string,
  teamB: string,
  scoreA: number | null,
  scoreB: number | null,
): Promise<WriteResult> {
  // An Organizer's session is checked here; a token in the database.
  if (writer.kind === "organizer" && (await getVisitor()).kind !== "organizer") {
    return { ok: false, problem: "Sign in as an Organizer to change scores." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("ddd_save_dreambreaker", {
    p_token: writer.kind === "score" ? String(writer.token) : null,
    p_team_a: String(teamA),
    p_team_b: String(teamB),
    p_score_a: scoreA,
    p_score_b: scoreB,
  });
  if (error) return { ok: false, problem: refusal(error.code) };
  revalidatePath(DDD_ROOT, "layout");
  return { ok: true };
}

/** Enters or corrects a Dreambreaker final: `scoreA` is `teamA`'s points. */
export async function saveDreambreaker(
  writer: LiveWriter,
  teamA: string,
  teamB: string,
  scoreA: number,
  scoreB: number,
): Promise<WriteResult> {
  const problem = checkDreambreakerScore(Number(scoreA), Number(scoreB));
  if (problem) return { ok: false, problem };
  return writeFinal(writer, teamA, teamB, Number(scoreA), Number(scoreB));
}

/** Takes a final back out. Organizers only. */
export async function clearDreambreaker(teamA: string, teamB: string): Promise<WriteResult> {
  return writeFinal({ kind: "organizer" }, teamA, teamB, null, null);
}

/** Sets a Team's Rotation to these players, in order. */
export async function setRotation(teamId: string, playerIds: string[]): Promise<WriteResult> {
  await verifyOrganizer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("ddd_set_rotation", {
    p_team_id: String(teamId),
    p_player_ids: Array.isArray(playerIds) ? playerIds.map(String) : [],
  });
  if (error) return { ok: false, problem: "Couldn't save the Rotation. Try again." };
  revalidatePath(DDD_ROOT, "layout");
  return { ok: true };
}

/** The four Punishments, 1st place first (#718). Any time, before or after the DDD. */
export async function savePunishments(eventId: string, punishments: string[]): Promise<WriteResult> {
  await verifyOrganizer();
  const list = Array.isArray(punishments) ? punishments.map((each) => String(each ?? "").trim()) : [];
  const problem = punishmentsProblem(list);
  if (problem) return { ok: false, problem };
  const supabase = await createClient();
  const { error } = await supabase.from("ddd_events").update({ punishments: list }).eq("id", String(eventId));
  if (error) return { ok: false, problem: "Couldn't save the Punishments. Try again." };
  revalidatePath(DDD_ROOT, "layout");
  return { ok: true };
}

/** The Organizer's call on a tie: every Team, best first. */
export async function setTieOrder(eventId: string, teamIds: string[]): Promise<WriteResult> {
  await verifyOrganizer();
  const ids = Array.isArray(teamIds) ? teamIds.map(String).slice(0, 4) : [];
  const supabase = await createClient();
  const { error } = await supabase.from("ddd_events").update({ tie_order: ids }).eq("id", String(eventId));
  if (error) return { ok: false, problem: "Couldn't save the call. Try again." };
  revalidatePath(DDD_ROOT, "layout");
  return { ok: true };
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { readGrid } from "../../court-grid/grid.ts";
// Request infrastructure (a path to an absolute URL on the current host), not
// domain logic, so it is imported rather than copied, as Team Tally does.
import { absoluteAppUrl } from "@/lib/booking-buddy/request-origin";
import { verifyOrganizer } from "../dal.ts";
import { eventProblem, saveEvent, type DddSetup } from "../events.ts";
import { createInvite } from "../organizers.ts";
import { DDD_ROOT, dddPath, invitePath } from "../routes.ts";
import { createClient } from "../supabase/server.ts";
import { deleteVenue, saveVenue, venueProblem, type VenueSaved } from "../venues.ts";

/**
 * The Organizer's writes. Each is reachable by a direct POST, so each checks
 * the Organizer first; the database checks the list again under RLS.
 */

export type FormState = { problem?: string };

/** Creates a DDD (`eventId` null) or saves its setup, then opens it. */
export async function saveDddAction(eventId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  await verifyOrganizer();
  const setup: DddSetup = {
    name: String(formData.get("name") ?? ""),
    date: String(formData.get("date") ?? ""),
    playVenue: String(formData.get("playVenue") ?? ""),
    dineVenue: String(formData.get("dineVenue") ?? ""),
    courts: formData.getAll("court").map(String),
  };
  const problem = eventProblem(setup);
  if (problem) return { problem };
  const saved = await saveEvent(await createClient(), eventId, setup);
  if (!saved.ok) return { problem: saved.problem };
  revalidatePath(DDD_ROOT, "layout");
  redirect(dddPath(saved.id));
}

/** A fresh invite link, as a full URL to paste into a chat. */
export async function makeInviteLink(): Promise<string> {
  await verifyOrganizer();
  return absoluteAppUrl(invitePath(await createInvite(await createClient())));
}

/** Saves a Venue drawn in setup: a new one, or `id` changed. */
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

/** Forgets a Venue. DDDs set up on it keep their courts. */
export async function deleteVenueAction(id: string): Promise<{ ok: true } | { ok: false; problem: string }> {
  await verifyOrganizer();
  try {
    await deleteVenue(await createClient(), String(id));
    return { ok: true };
  } catch {
    return { ok: false, problem: "Couldn't forget the venue. Try again." };
  }
}

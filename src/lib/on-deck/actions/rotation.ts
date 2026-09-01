"use server";

import { createClient } from "../supabase/server.ts";
import { verifyOrganizer } from "../dal.ts";
import { getOwnedClub } from "../clubs.ts";
import { getSession } from "../sessions.ts";
import { loadVolunteerSession } from "../volunteer.ts";
import {
  floorRosterFrom,
  loadRotationView,
  type FloorRoster,
  type RotationView,
} from "../rotation.ts";

export type { RotationCourt, RotationView } from "../rotation.ts";
export type { FloorRoster } from "../rotation.ts";

/**
 * The Server Action the live surfaces poll (issue #243). Thin wrapper over
 * `loadRotationView` so client components have something to call; the
 * projection and the token-privacy rules live in `../rotation.ts`.
 */
export async function getRotationView(
  sessionId: string,
  token?: string,
): Promise<RotationView | null> {
  return loadRotationView(sessionId, token);
}

/**
 * The Session roster with each Player's current Skill Level, for the floor's
 * "add a walk-up" and "fix a skill level" controls (issue #249). Not part of
 * the world-readable `RotationView` — a self-declared Skill Level is
 * operator-facing — so this is gated: an account that owns the Club, or a
 * Volunteer Link token. `null` when neither checks out.
 */
export async function getFloorRoster(
  sessionId: string,
  token?: string,
): Promise<FloorRoster | null> {
  if (token) {
    const loaded = await loadVolunteerSession(sessionId, token);
    return loaded ? floorRosterFrom(loaded) : null;
  }

  await verifyOrganizer();
  const supabase = await createClient();
  const club = await getOwnedClub(supabase);
  const loaded = await getSession(supabase, sessionId).catch(() => null);
  if (!club || !loaded || loaded.config.clubId !== club.id) {
    return null;
  }
  return floorRosterFrom(loaded);
}

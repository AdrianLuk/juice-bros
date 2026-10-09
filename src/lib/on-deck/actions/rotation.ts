"use server";

import { createClient } from "../supabase/server.ts";
import { getSession } from "../sessions.ts";
import { loadOwnedSession } from "../owned-session.ts";
import { loadVolunteerSession } from "../volunteer.ts";
import {
  floorRosterFrom,
  rotationViewFrom,
  type FloorRoster,
  type RotationView,
} from "../session/rotation-view.ts";

/**
 * The Server Action the live surfaces poll (issue #243): load a Session by id
 * and project its `RotationView`, or null. The projection and the
 * token-privacy rules live in `../session/rotation-view.ts`.
 */
export async function getRotationView(
  sessionId: string,
  token?: string,
): Promise<RotationView | null> {
  const supabase = await createClient();
  const loaded = await getSession(supabase, sessionId).catch(() => null);
  return loaded ? rotationViewFrom(loaded, token) : null;
}

/**
 * The Session roster with each Player's current Skill Level, in join order,
 * for the floor's "add a walk-up" and "fix a skill level" controls (issue
 * #249). Gated — an account that owns the Club, or a Volunteer Link token —
 * because it's the roster's *write* surface (it backs the override control),
 * not because a Skill Level needs hiding: `RotationView.skillByName` already
 * carries the same pairs publicly, for the board's name colouring. `null`
 * when neither auth path checks out.
 */
export async function getFloorRoster(
  sessionId: string,
  token?: string,
): Promise<FloorRoster | null> {
  if (token) {
    const loaded = await loadVolunteerSession(sessionId, token);
    return loaded ? floorRosterFrom(loaded) : null;
  }

  const owned = await loadOwnedSession(sessionId);
  return owned ? floorRosterFrom(owned.loaded) : null;
}

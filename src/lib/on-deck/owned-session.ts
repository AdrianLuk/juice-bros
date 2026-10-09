import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "./supabase/server.ts";
import { verifyOrganizer, type Organizer } from "./dal.ts";
import { getOwnedClub, type Club } from "./clubs.ts";
import {
  getScheduledSession,
  getSession,
  type LoadedSession,
  type ScheduledSession,
} from "./sessions.ts";

export type Owned<S> = {
  organizer: Organizer;
  supabase: Awaited<ReturnType<typeof createClient>>;
  club: Club;
  loaded: S;
};

/**
 * The one Club ownership check: the signed-in Organizer's Club owns this
 * Session. Belt-and-braces on top of RLS. `null` when there is no Club, no
 * such Session, or it belongs to another Club; each caller maps that to its
 * own failure (an error result, `notFound()`, `null`).
 */
async function loadOwned<S>(
  sessionId: string,
  load: (supabase: SupabaseClient, sessionId: string) => Promise<S | null>,
  clubIdOf: (session: S) => string,
): Promise<Owned<S> | null> {
  const organizer = await verifyOrganizer();
  const supabase = await createClient();
  const club = await getOwnedClub(supabase);
  const loaded = await load(supabase, sessionId).catch(() => null);
  if (!club || !loaded || clubIdOf(loaded) !== club.id) {
    return null;
  }
  return { organizer, supabase, club, loaded };
}

/** The Organizer's own folded (open or closed) Session, or null. */
export function loadOwnedSession(
  sessionId: string,
): Promise<Owned<LoadedSession> | null> {
  return loadOwned(sessionId, getSession, (s) => s.config.clubId);
}

/** The Organizer's own scheduled (not yet open) Session, or null. */
export function loadOwnedScheduledSession(
  sessionId: string,
): Promise<Owned<ScheduledSession> | null> {
  return loadOwned(sessionId, getScheduledSession, (s) => s.clubId);
}

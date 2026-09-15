import "server-only";

import { getSession } from "./sessions.ts";
import { createClient } from "./supabase/server.ts";
import {
  floorRosterFrom,
  rotationViewFrom,
  type FloorRoster,
  type QueueEntryView,
  type RotationCourt,
  type RotationView,
} from "./session/rotation-view.ts";

/**
 * The database boundary for the rotation read model. The projection itself —
 * `rotationViewFrom`, `floorRosterFrom`, and the view types they return — lives
 * in `./session/rotation-view.ts`, which imports neither `server-only` nor a
 * `@/` alias and is unit-testable under `node --test`. This module is only the
 * loader: fetch the folded Session, then hand it to the pure projection.
 */
export {
  floorRosterFrom,
  rotationViewFrom,
  type FloorRoster,
  type QueueEntryView,
  type RotationCourt,
  type RotationView,
};

/** Load a Session by id and project its `RotationView`, or null. */
export async function loadRotationView(
  sessionId: string,
  token?: string,
): Promise<RotationView | null> {
  const supabase = await createClient();
  const loaded = await getSession(supabase, sessionId).catch(() => null);
  return loaded ? rotationViewFrom(loaded, token) : null;
}

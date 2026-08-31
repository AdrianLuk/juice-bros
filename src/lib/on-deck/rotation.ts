import "server-only";

import { getSession, type LoadedSession } from "./sessions.ts";
import { playerCourt, queuePosition } from "./session/types.ts";
import { createClient } from "./supabase/server.ts";

/**
 * The rotation loop's read model (issue #243). Every live surface — the
 * Organizer floor screen and a Player's own "where am I" line — polls this
 * (via the `getRotationView` Server Action, TanStack Query `refetchInterval`
 * ~4s) and re-renders; realtime is a later upgrade (#238 ticket 13).
 *
 * Device tokens never leave the server: a token is a Player's whole identity
 * (ADR 0001), and the open Session is world-readable. A caller passes their
 * own token to learn their own position; everyone else is shown display names
 * only — exactly what the venue's Display tablet already puts on a wall.
 */
export type RotationCourt = {
  number: number;
  /** Display names of the four on the Court, or `[]` when empty. */
  players: string[];
  /**
   * When the current Game was seated (epoch ms), or null when empty. The floor
   * screen sends this back with "Court N done" so a stale board or a double
   * tap can't end a Game that has already turned over.
   */
  since: number | null;
};

export type RotationView = {
  status: "open" | "closed";
  venueName: string;
  courts: RotationCourt[];
  /** Display names in wait order — longest-waiting first. */
  queue: string[];
  queuedCount: number;
  /** The caller's own standing, when they passed a token. */
  me: {
    position: number | null;
    court: number | null;
  } | null;
};

/** Project a `RotationView` from an already-folded Session. */
export function rotationViewFrom(
  loaded: LoadedSession,
  token?: string,
): RotationView {
  const { state, status } = loaded;
  const nameOf = (id: string) =>
    state.roster.find((p) => p.id === id)?.displayName ?? "Someone";

  const trimmed = token?.trim() ?? "";
  const me =
    trimmed.length >= 8
      ? {
          position: queuePosition(state, trimmed),
          court: playerCourt(state, trimmed),
        }
      : null;

  return {
    status,
    venueName: state.config.venueName,
    courts: state.courts.map((c) => ({
      number: c.number,
      players: c.foursome.map(nameOf),
      since: c.since,
    })),
    queue: state.queue.map((e) => nameOf(e.playerId)),
    queuedCount: state.queue.length,
    me,
  };
}

/** Load a Session by id and project its `RotationView`, or null. */
export async function loadRotationView(
  sessionId: string,
  token?: string,
): Promise<RotationView | null> {
  const supabase = await createClient();
  const loaded = await getSession(supabase, sessionId).catch(() => null);
  return loaded ? rotationViewFrom(loaded, token) : null;
}

import "server-only";

import { getSession, type LoadedSession } from "./sessions.ts";
import { playerCourt, playerPaused, type PauseReason } from "./session/types.ts";
import { bestReplacement } from "./session/match-me.ts";
import { describeUndo, type UndoTarget } from "./floor-ops.ts";
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
  /**
   * Display name of the Match Me-suggested replacement for a no-show on this
   * Court (issue #246), or null when the Court is empty or nobody waits. The
   * Organizer can swap in this name with one tap, or override it with any
   * waiting Player.
   */
  suggestedReplacement: string | null;
};

export type RotationView = {
  status: "open" | "closed";
  venueName: string;
  courts: RotationCourt[];
  /**
   * Display names in wait order — longest-waiting first — of the Players *not*
   * already committed to an On Deck Foursome. On Deck names appear in `onDeck`,
   * not here, so the floor screen never lists a Player twice.
   */
  queue: string[];
  queuedCount: number;
  /**
   * The committed On Deck Foursomes, display names only — index 0 is "Up
   * next", index 1 "After that" (issue #245). A Foursome still short of four
   * (Queue was thin when it formed) comes back with fewer names.
   */
  onDeck: string[][];
  /**
   * Players who have stepped out (issue #246), newest last — display name plus
   * which door they came through, for the Organizer's "set aside" list and its
   * "back in the queue" tap.
   */
  paused: { name: string; reason: PauseReason }[];
  /**
   * The most recent event an Operator could undo (#247) — its `seq` and a
   * phrase for the button — or null when nothing recent is undoable. The floor
   * screen sends the `seq` back so a concurrent Operator's newer action is
   * caught, not silently rolled over.
   */
  undo: UndoTarget | null;
  /** The caller's own standing, when they passed a token. */
  me: {
    /** 1-based place among the waiters not yet On Deck, or null. */
    position: number | null;
    court: number | null;
    /** Which On Deck Foursome the caller is in — 0 "up next", 1 "after that". */
    onDeck: number | null;
    /** The caller has stepped out and is not being called. */
    paused: boolean;
  } | null;
};

/** Project a `RotationView` from an already-folded Session. `now` is injected
 * so the projection stays testable — it feeds only the Undo window (#247), not
 * the fold, which never reads the clock. */
export function rotationViewFrom(
  loaded: LoadedSession,
  token?: string,
  now: number = Date.now(),
): RotationView {
  const { state, status } = loaded;
  const nameOf = (id: string) =>
    state.roster.find((p) => p.id === id)?.displayName ?? "Someone";

  const onDeckIds = new Set(state.onDeck.flatMap((f) => f.players));
  const waiting = state.queue.filter((e) => !onDeckIds.has(e.playerId));
  const skillOf = (id: string) =>
    state.roster.find((p) => p.id === id)?.skillLevel ?? "intermediate";

  /** Match Me's suggested no-show replacement for one Court, as a display
   * name — the longest-waiting Players make the healthiest fit against the
   * three still standing there. */
  const suggestFor = (foursome: string[]): string | null => {
    if (foursome.length === 0 || waiting.length === 0) return null;
    const id = bestReplacement({
      courtmates: foursome,
      waiting: waiting.map((e) => e.playerId),
      skillOf,
      completedGames: state.completedGames,
    });
    return id ? nameOf(id) : null;
  };

  const trimmed = token?.trim() ?? "";
  let me: RotationView["me"] = null;
  if (trimmed.length >= 8) {
    const waitingIndex = waiting.findIndex((e) => e.playerId === trimmed);
    const onDeckIndex = state.onDeck.findIndex((f) =>
      f.players.includes(trimmed),
    );
    me = {
      position: waitingIndex < 0 ? null : waitingIndex + 1,
      court: playerCourt(state, trimmed),
      onDeck: onDeckIndex < 0 ? null : onDeckIndex,
      paused: playerPaused(state, trimmed),
    };
  }

  return {
    status,
    venueName: state.config.venueName,
    courts: state.courts.map((c) => ({
      number: c.number,
      players: c.foursome.map(nameOf),
      since: c.since,
      suggestedReplacement: suggestFor(c.foursome),
    })),
    queue: waiting.map((e) => nameOf(e.playerId)),
    queuedCount: waiting.length,
    onDeck: state.onDeck.map((f) => f.players.map(nameOf)),
    paused: state.paused.map((p) => ({ name: nameOf(p.playerId), reason: p.reason })),
    undo: status === "open" ? describeUndo(loaded.lastEvent, now) : null,
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

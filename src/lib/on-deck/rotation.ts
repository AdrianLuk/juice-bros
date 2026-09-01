import "server-only";

import { getSession, type LoadedSession } from "./sessions.ts";
import {
  playerCourt,
  playerPaused,
  queueUnits,
  type PauseReason,
  type SkillLevel,
} from "./session/types.ts";
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

/**
 * One entry in the Queue as the floor shows it (issue #250): a solo Player, or
 * a whole Queue Together Group collapsed to one row carrying its members'
 * names.
 */
export type QueueEntryView =
  | { kind: "solo"; name: string }
  | { kind: "group"; names: string[] };

export type RotationView = {
  status: "open" | "closed";
  venueName: string;
  courts: RotationCourt[];
  /**
   * Wait order — longest-waiting first — of the Players *not* already committed
   * to an On Deck Foursome, with a Queue Together Group as a single `group`
   * entry (issue #250). On Deck names appear in `onDeck`, not here.
   */
  queue: QueueEntryView[];
  /**
   * Every ungrouped waiting Player's display name, flat, in wait order — for
   * the no-show swap picker. A Group's members are queued as a unit and are
   * not offered here.
   */
  waitingNames: string[];
  /**
   * Every queued Player not already in a Group, in wait order — the "queue
   * together" picker (issue #250). Includes the ones currently On Deck, since
   * forming a Group deliberately rebuilds On Deck around it.
   */
  groupablePlayers: string[];
  queuedCount: number;
  /** The live group cap (issue #250) — `config.groupCap`, or lower if a
   * Volunteer trimmed it mid-Session. */
  groupCap: number;
  /**
   * The committed On Deck Foursomes, display names only — index 0 is "Up
   * next", index 1 "After that" (issue #245). A Foursome still short of four
   * (Queue was thin when it formed) comes back with fewer names.
   */
  onDeck: string[][];
  /** Parallel to `onDeck` — whether each Foursome came from a Queue Together
   * Group (issue #250), for a "Group" label on the card. */
  onDeckIsGroup: boolean[];
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
    /** The caller is queued as part of a Queue Together Group (issue #250). */
    group: boolean;
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
  const groupedIds = new Set(state.groups.flatMap((g) => g.memberIds));
  const waiting = state.queue.filter((e) => !onDeckIds.has(e.playerId));
  const skillOf = (id: string) =>
    state.roster.find((p) => p.id === id)?.skillLevel ?? "intermediate";

  /** Match Me's suggested no-show replacement for one Court, as a display
   * name — the longest-waiting Players make the healthiest fit against the
   * three still standing there. */
  const suggestFor = (foursome: string[]): string | null => {
    const free = waiting
      .map((e) => e.playerId)
      .filter((id) => !groupedIds.has(id));
    if (foursome.length === 0 || free.length === 0) return null;
    const id = bestReplacement({
      courtmates: foursome,
      waiting: free,
      skillOf,
      completedGames: state.completedGames,
    });
    return id ? nameOf(id) : null;
  };

  // The Queue as units — a Group is one entry — minus anyone already On Deck
  // (a Group's Foursome is committed whole, so its members are all On Deck or
  // all still here).
  const queue: QueueEntryView[] = queueUnits(state).flatMap<QueueEntryView>(
    (unit) => {
      if (unit.kind === "solo") {
        return onDeckIds.has(unit.playerId)
          ? []
          : [{ kind: "solo", name: nameOf(unit.playerId) }];
      }
      if (unit.memberIds.some((id) => onDeckIds.has(id))) return [];
      return [{ kind: "group", names: unit.memberIds.map(nameOf) }];
    },
  );

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
      group: state.groups.some((g) => g.memberIds.includes(trimmed)),
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
    queue,
    waitingNames: waiting
      .filter((e) => !groupedIds.has(e.playerId))
      .map((e) => nameOf(e.playerId)),
    groupablePlayers: state.queue
      .filter((e) => !groupedIds.has(e.playerId))
      .map((e) => nameOf(e.playerId)),
    queuedCount: waiting.length,
    groupCap: state.groupCap,
    onDeck: state.onDeck.map((f) => f.players.map(nameOf)),
    onDeckIsGroup: state.onDeck.map((f) => f.groupId !== null),
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

/**
 * Every Player in the Session, in join order — display name and current Skill
 * Level. Feeds the operator's "add a walk-up" and "fix a skill level" controls
 * (issue #249). Deliberately *not* on `RotationView`: that read model is
 * world-readable (a Player polls it with no account), and a self-declared
 * Skill Level is operator-facing, not wall-of-the-venue public. Every caller
 * of `floorRosterFrom` is behind Organizer auth or a Volunteer Link.
 */
export type FloorRoster = { name: string; skillLevel: SkillLevel }[];

export function floorRosterFrom(loaded: LoadedSession): FloorRoster {
  return loaded.state.roster.map((p) => ({
    name: p.displayName,
    skillLevel: p.skillLevel,
  }));
}

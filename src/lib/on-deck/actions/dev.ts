"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "../supabase/server.ts";
import { verifyOrganizer } from "../dal.ts";
import { verifyDevAccess } from "../dev.ts";
import { fakePlayers, fakePlayerToken } from "../dev-players.ts";
import { getOwnedClub } from "../clubs.ts";
import { getOpenSessionForClub, type LoadedSession } from "../sessions.ts";
import { ON_DECK_DEV_PATH } from "../routes.ts";
import type { SessionState } from "../session/types.ts";
import { SKILL_LEVELS } from "../session/types.ts";
import {
  bringPlayerBack,
  callLastCall,
  closeSession,
  finishCourt,
  formGroup,
  overridePlayerSkill,
  setPlayerAside,
  swapNoShow,
} from "./floor.ts";

export type DevResult = { ok: true; note: string } | { ok?: false; error: string };

/**
 * The dev console's actions (issue #351). Every one gates on the dev key *and*
 * an Organizer session, then drives the same paths a real night uses — the
 * fake-Player adds go through the `anon` join/queue RPCs, everything else
 * reuses `actions/floor.ts` verbatim (ADR 0005: a synthetic Player is
 * indistinguishable from a real one to the fold).
 */

type DevSession = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  clubId: string;
  session: LoadedSession;
};

async function loadDevSession(): Promise<DevSession | { error: string }> {
  await verifyDevAccess();
  await verifyOrganizer();
  const supabase = await createClient();
  const club = await getOwnedClub(supabase);
  if (!club) {
    return { error: "No club is set up for this account. Seed one first." };
  }
  const session = await getOpenSessionForClub(supabase, club.id);
  if (!session) {
    return { error: "No session is running. Start one first." };
  }
  return { supabase, clubId: club.id, session };
}

function nameOf(state: SessionState, token: string): string | null {
  return state.roster.find((p) => p.id === token)?.displayName ?? null;
}

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Waiting Players not already in a Group, as display names. */
function ungroupedWaiting(state: SessionState): string[] {
  const grouped = new Set(state.groups.flatMap((g) => g.memberIds));
  return state.queue
    .filter((e) => !grouped.has(e.playerId))
    .map((e) => nameOf(state, e.playerId))
    .filter((n): n is string => n !== null);
}

function done(note: string): DevResult {
  revalidatePath(ON_DECK_DEV_PATH);
  return { ok: true, note };
}

function fromFloor(result: { ok?: boolean; error?: string }, note: string): DevResult {
  if (result.error) return { error: result.error };
  return done(note);
}

/** Open a fresh Session from the Club defaults. */
export async function devStartSession(): Promise<DevResult> {
  await verifyDevAccess();
  await verifyOrganizer();
  const supabase = await createClient();
  const club = await getOwnedClub(supabase);
  if (!club) {
    return { error: "No club is set up for this account. Seed one first." };
  }
  if (await getOpenSessionForClub(supabase, club.id)) {
    return done("A session is already running.");
  }

  const { error } = await supabase.rpc("on_deck_start_session", {
    p_club_id: club.id,
    p_today: null,
  });
  if (error) {
    console.error("on-deck dev: start session failed", error);
    return { error: "Couldn't start a session. Try again." };
  }
  return done("Session started.");
}

/** Close the running Session (purging its log) and open a clean one. */
export async function devResetSession(): Promise<DevResult> {
  await verifyDevAccess();
  await verifyOrganizer();
  const supabase = await createClient();
  const club = await getOwnedClub(supabase);
  if (!club) {
    return { error: "No club is set up for this account. Seed one first." };
  }

  const open = await getOpenSessionForClub(supabase, club.id);
  if (open) {
    const closed = await closeSession(open.config.sessionId);
    if ("error" in closed && closed.error) return { error: closed.error };
  }

  const { error } = await supabase.rpc("on_deck_start_session", {
    p_club_id: club.id,
    p_today: null,
  });
  if (error) {
    console.error("on-deck dev: reset session failed", error);
    return { error: "Closed the old session but couldn't open a new one." };
  }
  return done(open ? "Reset. Fresh session running." : "Session started.");
}

const MAX_ADD = 24;

/** Add N synthetic Players and drop them straight into the Queue. */
export async function devAddPlayers(count: number): Promise<DevResult> {
  const loaded = await loadDevSession();
  if ("error" in loaded) return loaded;

  const n = Math.min(MAX_ADD, Math.max(1, Math.floor(count)));
  const sessionId = loaded.session.config.sessionId;
  const batch = fakePlayers(n, loaded.session.state.roster.length);

  for (const player of batch) {
    const token = fakePlayerToken();
    const join = await loaded.supabase.rpc("on_deck_join_session", {
      p_session_id: sessionId,
      p_token: token,
      p_first_name: player.firstName,
      p_last_initial: player.lastInitial,
      p_skill_level: player.skillLevel,
    });
    if (join.error) {
      console.error("on-deck dev: join failed", join.error);
      return { error: "Couldn't add players. Try again." };
    }
    const queue = await loaded.supabase.rpc("on_deck_queue_player", {
      p_session_id: sessionId,
      p_token: token,
    });
    if (queue.error) {
      console.error("on-deck dev: queue failed", queue.error);
      return { error: "Added players but couldn't queue them all." };
    }
  }

  return done(`Added ${n} player${n === 1 ? "" : "s"} to the queue.`);
}

/**
 * Seat the leading On Deck Foursome onto the first empty Court — the floor
 * screen's "Send next four", the tap that gets games going at session start.
 * `COURT_FINISHED` on an empty Court carries no Game, it just seats the next
 * Foursome (the fold's own comment).
 */
export async function devSeatNextFour(): Promise<DevResult> {
  const loaded = await loadDevSession();
  if ("error" in loaded) return loaded;

  const state = loaded.session.state;
  if (state.onDeck.length === 0 || state.onDeck[0].players.length === 0) {
    return { error: "Nobody's on deck to send on." };
  }
  const empty = state.courts.find((c) => c.foursome.length === 0);
  if (!empty) return { error: "Every court has a game on it." };

  const result = await finishCourt(
    loaded.session.config.sessionId,
    empty.number,
    null,
  );
  return fromFloor(result, `Sent the next four onto court ${empty.number}.`);
}

/** Fill every empty Court from the Queue — session-start in one tap. */
export async function devFillCourts(): Promise<DevResult> {
  const loaded = await loadDevSession();
  if ("error" in loaded) return loaded;

  const sessionId = loaded.session.config.sessionId;
  const emptyCount = loaded.session.state.courts.filter(
    (c) => c.foursome.length === 0,
  ).length;
  if (emptyCount === 0) return { error: "Every court has a game on it." };

  let seated = 0;
  for (let i = 0; i < emptyCount; i += 1) {
    const session = await getOpenSessionForClub(loaded.supabase, loaded.clubId);
    if (!session) break;
    const s = session.state;
    if (s.onDeck.length === 0 || s.onDeck[0].players.length === 0) break;
    const empty = s.courts.find((c) => c.foursome.length === 0);
    if (!empty) break;
    const result = await finishCourt(sessionId, empty.number, null);
    if ("error" in result && result.error) {
      return seated > 0
        ? done(`Seated ${seated}, then hit: ${result.error}`)
        : { error: result.error };
    }
    seated += 1;
  }
  return done(
    seated === 0
      ? "Not enough waiting players to seat a court."
      : `Seated ${seated} court${seated === 1 ? "" : "s"}.`,
  );
}

/** Finish one occupied Court — a named one, or a random one. */
export async function devFinishCourt(court?: number): Promise<DevResult> {
  const loaded = await loadDevSession();
  if ("error" in loaded) return loaded;

  const occupied = loaded.session.state.courts.filter(
    (c) => c.foursome.length > 0,
  );
  if (occupied.length === 0) return { error: "No court has a game on it." };

  const target =
    typeof court === "number"
      ? occupied.find((c) => c.number === court)
      : shuffled(occupied)[0];
  if (!target) return { error: `Court ${court} isn't in play.` };

  const result = await finishCourt(
    loaded.session.config.sessionId,
    target.number,
    target.since,
  );
  return fromFloor(result, `Court ${target.number} done.`);
}

/** Finish every Court that has a game on it, oldest game first. */
export async function devFinishAllCourts(): Promise<DevResult> {
  const loaded = await loadDevSession();
  if ("error" in loaded) return loaded;

  const occupied = loaded.session.state.courts
    .filter((c) => c.foursome.length > 0)
    .sort((a, b) => (a.since ?? 0) - (b.since ?? 0));
  if (occupied.length === 0) return { error: "No court has a game on it." };

  const sessionId = loaded.session.config.sessionId;
  let finished = 0;
  for (const c of occupied) {
    const result = await finishCourt(sessionId, c.number, c.since);
    if ("error" in result && result.error) {
      return finished > 0
        ? done(`Finished ${finished} court${finished === 1 ? "" : "s"}, then hit: ${result.error}`)
        : { error: result.error };
    }
    finished += 1;
  }
  return done(`Finished ${finished} court${finished === 1 ? "" : "s"}.`);
}

/** Form a Group from 2–cap random waiting Players. */
export async function devFormRandomGroup(): Promise<DevResult> {
  const loaded = await loadDevSession();
  if ("error" in loaded) return loaded;

  const waiting = ungroupedWaiting(loaded.session.state);
  const cap = loaded.session.state.groupCap;
  if (waiting.length < 2) return { error: "Need at least two waiting players." };

  const size = Math.min(cap, 2 + Math.floor(Math.random() * (cap - 1)));
  const members = shuffled(waiting).slice(0, Math.min(size, waiting.length));
  const result = await formGroup(loaded.session.config.sessionId, members);
  return fromFloor(result, `Grouped ${members.length} waiting players`);
}

/** Override a random Player's Skill Level to a different one. */
export async function devOverrideRandomSkill(): Promise<DevResult> {
  const loaded = await loadDevSession();
  if ("error" in loaded) return loaded;

  const roster = loaded.session.state.roster;
  if (roster.length === 0) return { error: "Nobody's joined yet." };

  const player = shuffled(roster)[0];
  const options = SKILL_LEVELS.filter((l) => l !== player.skillLevel);
  const level = options[Math.floor(Math.random() * options.length)];
  const result = await overridePlayerSkill(
    loaded.session.config.sessionId,
    player.displayName,
    level,
  );
  return fromFloor(result, `${player.displayName} is now ${level}`);
}

/** Set a random waiting Player aside. */
export async function devSetAsideRandom(): Promise<DevResult> {
  const loaded = await loadDevSession();
  if ("error" in loaded) return loaded;

  const names = loaded.session.state.queue
    .map((e) => nameOf(loaded.session.state, e.playerId))
    .filter((n): n is string => n !== null);
  if (names.length === 0) return { error: "Nobody's in the queue." };

  const name = shuffled(names)[0];
  const result = await setPlayerAside(loaded.session.config.sessionId, name);
  return fromFloor(result, `${name} is set aside`);
}

/** Bring a random paused Player back into the Queue. */
export async function devRequeueRandom(): Promise<DevResult> {
  const loaded = await loadDevSession();
  if ("error" in loaded) return loaded;

  const names = loaded.session.state.paused
    .map((p) => nameOf(loaded.session.state, p.playerId))
    .filter((n): n is string => n !== null);
  if (names.length === 0) return { error: "Nobody's stepped out." };

  const name = shuffled(names)[0];
  const result = await bringPlayerBack(loaded.session.config.sessionId, name);
  return fromFloor(result, `${name} is back in the queue`);
}

/** Swap a random on-court Player for a random waiting one (a-player-short). */
export async function devSwapRandomNoShow(): Promise<DevResult> {
  const loaded = await loadDevSession();
  if ("error" in loaded) return loaded;

  const state = loaded.session.state;
  const occupied = state.courts.filter((c) => c.foursome.length > 0);
  const grouped = new Set(state.groups.flatMap((g) => g.memberIds));
  const waiting = state.queue.filter((e) => !grouped.has(e.playerId));
  if (occupied.length === 0) return { error: "No court has a game on it." };
  if (waiting.length === 0) return { error: "Nobody's waiting to swap in." };

  const court = shuffled(occupied)[0];
  const outName = nameOf(state, shuffled(court.foursome)[0]);
  const inName = nameOf(state, shuffled(waiting)[0].playerId);
  if (!outName || !inName) return { error: "Couldn't resolve those players." };

  const result = await swapNoShow(
    loaded.session.config.sessionId,
    court.number,
    court.since,
    outName,
    inName,
  );
  return fromFloor(result, `Court ${court.number}: ${inName} in for ${outName}`);
}

/** Call Last Call on the running Session. */
export async function devLastCall(): Promise<DevResult> {
  const loaded = await loadDevSession();
  if ("error" in loaded) return loaded;
  const result = await callLastCall(loaded.session.config.sessionId);
  return fromFloor(result, "Last call.");
}

/** Close the running Session (purges the log, writes the Summary). */
export async function devCloseSession(): Promise<DevResult> {
  const loaded = await loadDevSession();
  if ("error" in loaded) return loaded;
  const result = await closeSession(loaded.session.config.sessionId);
  return fromFloor(result, "Session closed.");
}

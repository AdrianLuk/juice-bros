/**
 * The floor's operational actions, reduced to a pure decision over a folded
 * `SessionState`: given the board an Operator is looking at, what event (if
 * any) should their tap append?
 *
 * One copy of the domain rules — Court in range, name resolves to a roster
 * token, the board is not stale — shared by both write paths: the Organizer's
 * (`actions/floor.ts`, a direct INSERT under their owner policy) and a
 * link-authenticated Volunteer's (`actions/volunteer.ts`, the
 * `on_deck_volunteer_append` RPC). ADR 0005: which Operators may fire an event
 * is an authorization gate, never a branch — the decision here is identical for
 * both.
 *
 * Relative imports only and no `server-only`: this is pure logic over a plain
 * object, unit-tested under `node --test`.
 */

import { isSkillLevel, type Operator, type SessionState } from "./session/types.ts";

/**
 * The operational **turnover** events a floor tap can produce — the one list the
 * `FloorEventType` union, `on_deck_volunteer_append`'s whitelist, and operator
 * Undo (#247) all draw from. The roster corrections in `FloorOutcomeType`
 * (#249) are deliberately not here: a walk-up add or a skill fix is corrected
 * forward, never rolled back, and the DB Undo path excludes them too.
 */
export const FLOOR_EVENT_TYPES = [
  "COURT_FINISHED",
  "PLAYER_PAUSED",
  "PLAYER_REQUEUED",
  "FOURSOME_MEMBER_SWAPPED",
  "GROUP_FORMED",
  "GROUP_DISSOLVED",
] as const;

export type FloorEventType = (typeof FLOOR_EVENT_TYPES)[number];

/**
 * Every event a floor decision can emit: the undoable turnover set (which now
 * includes `GROUP_FORMED` — a mis-formed Group is undone, not played out), plus
 * the roster corrections a Volunteer may make — add a walk-up (`PLAYER_JOINED`)
 * and override a Skill Level (`PLAYER_SKILL_SET`) (issue #249) — and the live
 * group cap (`GROUP_CAP_CHANGED`, issue #250), which is corrected forward by
 * setting it again rather than undone. The same set `on_deck_volunteer_append`
 * whitelists for a link-authenticated Volunteer.
 */
export type FloorOutcomeType =
  | FloorEventType
  | "PLAYER_JOINED"
  | "PLAYER_SKILL_SET"
  | "GROUP_CAP_CHANGED"
  // Player-sourced (issue #251) — decided by the same pure `floor-ops`
  // helpers but committed through an `anon` Player RPC, not the operator write
  // paths, and never operator-undoable (kept out of `FLOOR_EVENT_TYPES`).
  | "GROUP_MEMBER_REMOVED"
  // The idle-court nudge's "still going" tap (issue #259). Corrected forward
  // (tap it again, or "Court N done"), never undone — kept out of
  // `FLOOR_EVENT_TYPES`.
  | "COURT_CONFIRMED";

function isFloorEventType(type: string): type is FloorEventType {
  return (FLOOR_EVENT_TYPES as readonly string[]).includes(type);
}

/**
 * How long after an operational event an Operator may still undo it (#247).
 * Bounds "recent events only" — a mistap this game or last is fixable; the
 * night an hour deep is not. The same window `on_deck_undo_window()` enforces
 * in the database.
 */
export const UNDO_WINDOW_MS = 15 * 60 * 1000;

const UNDO_LABEL: Record<FloorEventType, string> = {
  COURT_FINISHED: "the last court finish",
  PLAYER_PAUSED: "the last set-aside",
  PLAYER_REQUEUED: "the last re-queue",
  FOURSOME_MEMBER_SWAPPED: "the last no-show swap",
  GROUP_FORMED: "the last group",
  GROUP_DISSOLVED: "the last group break-up",
};

/** The most recent raw event of a Session — the seq/type/at/operator the fold
 * discards but operator Undo needs. */
export type LastEvent = {
  seq: number;
  type: string;
  /** epoch ms */
  at: number;
  operator: Operator;
};

/**
 * The event operator Undo would drop (`seq`), a phrase for the button
 * (`label`), and who fired it (`by`) so the floor screen can flag undoing
 * *someone else's* tap — or null when the most recent event is structural,
 * Player-sourced, or too old.
 */
export type UndoTarget = {
  seq: number;
  label: string;
  by: Operator["kind"];
};

/**
 * Given a Session's most recent raw event, decide whether the floor screen
 * should offer to undo it. Pure over the event plus `now` (the read model's
 * projection, not the fold — the fold still never reads the clock).
 */
export function describeUndo(
  lastEvent: LastEvent | null,
  now: number,
): UndoTarget | null {
  if (!lastEvent) return null;
  if (!isFloorEventType(lastEvent.type)) return null;
  if (now - lastEvent.at > UNDO_WINDOW_MS) return null;
  return {
    seq: lastEvent.seq,
    label: UNDO_LABEL[lastEvent.type],
    by: lastEvent.operator.kind,
  };
}

/**
 * `event` — append this. `noop` — the board already moved on (a double tap, a
 * stale poll); do nothing, report success. `error` — the tap does not apply;
 * show the message.
 */
export type FloorOpOutcome =
  | { kind: "event"; type: FloorOutcomeType; payload: Record<string, unknown> }
  | { kind: "noop" }
  | { kind: "error"; error: string };

/**
 * A display name back to its roster token. Display names are unique within a
 * Session — the fold suffixes a same-name Player ("Sarah K.", "Sarah K. 2") —
 * so this is unambiguous.
 */
export function tokenForName(state: SessionState, name: string): string | null {
  const trimmed = name?.trim() ?? "";
  return state.roster.find((p) => p.displayName === trimmed)?.id ?? null;
}

/**
 * "Court N done" / "Send next four". `expectedSince` is the `since` the board
 * last rendered for this Court; when it no longer matches, the turnover has
 * already happened and a second `COURT_FINISHED` would yank a Foursome
 * mid-Game — so that is a no-op, not an event.
 */
export function finishCourtOutcome(
  state: SessionState,
  court: number,
  expectedSince: number | null,
): FloorOpOutcome {
  if (
    !Number.isInteger(court) ||
    court < 1 ||
    court > state.config.courtCount
  ) {
    return { kind: "error", error: "That court number isn't on this session." };
  }

  const current = state.courts.find((c) => c.number === court);
  if ((current?.since ?? null) !== expectedSince) {
    return { kind: "noop" };
  }

  return { kind: "event", type: "COURT_FINISHED", payload: { court } };
}

/**
 * The idle-court nudge's "yes, Court N is still going" tap (issue #259).
 * `expectedSince` is the `since` the nudging surface last rendered for the
 * Court; a mismatch (the Game already turned over) makes this a no-op, not an
 * event. A no-op too for a Court not in play — the nudge only ever shows for an
 * occupied Court, so a tap on an empty one is a stale board.
 */
export function confirmCourtOutcome(
  state: SessionState,
  court: number,
  expectedSince: number | null,
): FloorOpOutcome {
  if (
    !Number.isInteger(court) ||
    court < 1 ||
    court > state.config.courtCount
  ) {
    return { kind: "error", error: "That court number isn't on this session." };
  }

  const current = state.courts.find((c) => c.number === court);
  if (!current || current.foursome.length === 0) {
    return { kind: "noop" };
  }
  if ((current.since ?? null) !== expectedSince) {
    return { kind: "noop" };
  }

  return {
    kind: "event",
    type: "COURT_CONFIRMED",
    payload: { court, since: expectedSince },
  };
}

/** "Set aside": an Operator stands a Player down (reason `set-aside`). */
export function setAsideOutcome(
  state: SessionState,
  playerName: string,
): FloorOpOutcome {
  const token = tokenForName(state, playerName);
  if (!token) {
    return { kind: "error", error: "Couldn't find that player." };
  }
  return {
    kind: "event",
    type: "PLAYER_PAUSED",
    payload: { token, reason: "set-aside" },
  };
}

/** "Back in the queue": an Operator re-adds a paused Player. */
export function bringBackOutcome(
  state: SessionState,
  playerName: string,
): FloorOpOutcome {
  const token = tokenForName(state, playerName);
  if (!token) {
    return { kind: "error", error: "Couldn't find that player." };
  }
  return { kind: "event", type: "PLAYER_REQUEUED", payload: { token } };
}

/**
 * The no-show swap: an Operator taps a called Player who didn't appear and
 * names a replacement standing there. `out` must be on the Court, `in` must
 * still be waiting, and the board must not have turned over since it rendered.
 */
export function swapNoShowOutcome(
  state: SessionState,
  court: number,
  expectedSince: number | null,
  outName: string,
  inName: string,
): FloorOpOutcome {
  const current = state.courts.find((c) => c.number === court);
  if (!current || current.foursome.length === 0) {
    return { kind: "error", error: "That court isn't in play." };
  }
  if ((current.since ?? null) !== expectedSince) {
    return {
      kind: "error",
      error: "That court already turned over — nothing to swap.",
    };
  }

  const outToken = tokenForName(state, outName);
  const inToken = tokenForName(state, inName);
  if (!outToken || !current.foursome.includes(outToken)) {
    return { kind: "error", error: "That player isn't on this court." };
  }
  if (!inToken || !state.queue.some((e) => e.playerId === inToken)) {
    return { kind: "error", error: "That replacement isn't waiting anymore." };
  }

  return {
    kind: "event",
    type: "FOURSOME_MEMBER_SWAPPED",
    payload: { court, out: outToken, in: inToken },
  };
}

/** Trim + collapse inner whitespace. The fold re-normalises on the way in
 * (`cleanFirstName`), so this only has to be good enough to validate. */
function tidyFirstName(raw: string): string {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

/** First letter of the input, upper-cased; "" when there is none. */
function tidyLastInitial(raw: string): string {
  return (raw ?? "").trim().match(/[a-z]/i)?.[0].toUpperCase() ?? "";
}

/**
 * "Add a walk-up" (issue #249): an Operator enters a Player with no phone —
 * name, last initial, Skill Level — and they land in the Session and the Queue
 * exactly like a self-registered Player. `token` is a synthetic id minted by
 * the caller (there is no device), passed in so this stays pure.
 *
 * `queueOnJoin` on the payload is what puts them straight in the Queue; the
 * database (`on_deck_volunteer_append`) also requires it on a volunteer-sourced
 * `PLAYER_JOINED`, since a Volunteer only ever adds walk-ups.
 */
export function addWalkupOutcome(
  state: SessionState,
  token: string,
  firstName: string,
  lastInitial: string,
  skillLevel: string,
): FloorOpOutcome {
  const first = tidyFirstName(firstName);
  const initial = tidyLastInitial(lastInitial);
  if (!first) return { kind: "error", error: "Enter a first name." };
  if (!initial) return { kind: "error", error: "Enter a last initial." };
  if (!isSkillLevel(skillLevel)) {
    return { kind: "error", error: "Pick a skill level." };
  }
  if (state.roster.some((p) => p.id === token)) {
    // A minted id already on the roster — a replayed submit. Nothing to do.
    return { kind: "noop" };
  }
  return {
    kind: "event",
    type: "PLAYER_JOINED",
    payload: {
      token,
      firstName: first,
      lastInitial: initial,
      skillLevel,
      queueOnJoin: true,
    },
  };
}

/**
 * "Fix a skill level" (issue #249): an Operator corrects an obviously wrong
 * self-rating on any Player. A no-op when the level already matches, so a
 * double tap doesn't stack events; Match Me reads the new level on its next
 * selection.
 */
export function overrideSkillOutcome(
  state: SessionState,
  playerName: string,
  skillLevel: string,
): FloorOpOutcome {
  if (!isSkillLevel(skillLevel)) {
    return { kind: "error", error: "Pick a skill level." };
  }
  const token = tokenForName(state, playerName);
  if (!token) {
    return { kind: "error", error: "Couldn't find that player." };
  }
  const current = state.roster.find((p) => p.id === token)?.skillLevel;
  if (current === skillLevel) {
    return { kind: "noop" };
  }
  return {
    kind: "event",
    type: "PLAYER_SKILL_SET",
    payload: { token, skillLevel },
  };
}

/**
 * "Queue together" (issue #250): a Volunteer picks 2 to the live group cap
 * waiting Players who asked to play together. Every name must resolve to a
 * Player currently in the Queue and in no other Group. `groupId` is minted by
 * the caller (`group-<uuid>`) and passed in so this stays pure.
 */
export function formGroupOutcome(
  state: SessionState,
  playerNames: readonly string[],
  groupId: string,
): FloorOpOutcome {
  const grouped = new Set(state.groups.flatMap((g) => g.memberIds));
  const seen = new Set<string>();
  const memberTokens: string[] = [];

  for (const raw of playerNames) {
    const name = raw?.trim() ?? "";
    if (!name) continue;
    const token = tokenForName(state, name);
    if (!token) {
      return { kind: "error", error: `Couldn't find ${name}.` };
    }
    if (seen.has(token)) continue;
    seen.add(token);
    if (!state.queue.some((e) => e.playerId === token)) {
      return { kind: "error", error: `${name} isn't in the queue right now.` };
    }
    if (grouped.has(token)) {
      return { kind: "error", error: `${name} is already in a group.` };
    }
    memberTokens.push(token);
  }

  if (memberTokens.length < 2) {
    return { kind: "error", error: "Pick at least two players." };
  }
  if (memberTokens.length > state.groupCap) {
    return {
      kind: "error",
      error: `That's more than the group cap of ${state.groupCap}.`,
    };
  }

  return { kind: "event", type: "GROUP_FORMED", payload: { groupId, memberTokens } };
}

/**
 * "Break up this group" (issue #251): a Volunteer dissolves a waiting Group.
 * Its members stay in the Queue as solos. A no-op for an unknown Group or one
 * already on a Court (that ends on its `COURT_FINISHED`).
 */
export function dissolveGroupOutcome(
  state: SessionState,
  groupId: string,
): FloorOpOutcome {
  const group = state.groups.find((g) => g.id === groupId);
  if (!group || group.courtNumber !== null) {
    return { kind: "noop" };
  }
  return { kind: "event", type: "GROUP_DISSOLVED", payload: { groupId } };
}

/**
 * "Queue together" formed by a Player from their own phone (issue #251): the
 * acting Player (`actorToken`, from their device) plus the names they picked
 * from the current-Session Player list. The actor is always a member — they are
 * added even if they did not tap their own chip. Same Group semantics as the
 * Volunteer path (`formGroupOutcome`): every name resolves, every member is
 * waiting and ungrouped, 2..live cap. `groupId` is minted by the caller.
 */
export function formGroupByPlayerOutcome(
  state: SessionState,
  actorToken: string,
  pickedNames: readonly string[],
  groupId: string,
): FloorOpOutcome {
  const actor = state.roster.find((p) => p.id === actorToken);
  if (!actor) {
    return { kind: "error", error: "Join the session first." };
  }
  if (!state.queue.some((e) => e.playerId === actorToken)) {
    // Caught here so the message is about the caller, not a confusing
    // "<your own name> isn't in the queue" out of the shared check below.
    return { kind: "error", error: "Join the queue before grouping up." };
  }
  // Fold the actor in by name, then hand off to the shared decision so the
  // "waiting / ungrouped / cap" rules are enforced in exactly one place.
  const names = [actor.displayName, ...pickedNames];
  return formGroupOutcome(state, names, groupId);
}

/**
 * "Leave this group" from a member's own phone (issue #251): the acting Player
 * (`actorToken`) steps out of whichever waiting Group they are in. They stay in
 * the Queue. A no-op when they are in no waiting Group.
 */
export function leaveGroupByPlayerOutcome(
  state: SessionState,
  actorToken: string,
): FloorOpOutcome {
  const group = state.groups.find(
    (g) => g.courtNumber === null && g.memberIds.includes(actorToken),
  );
  if (!group) return { kind: "noop" };
  return {
    kind: "event",
    type: "GROUP_MEMBER_REMOVED",
    payload: { groupId: group.id, token: actorToken },
  };
}

/**
 * "Group cap" (issue #250): a Volunteer sets the live cap — normally trimming it
 * to stop one Foursome monopolising a Court, but free to move back up to the
 * Club default (the ceiling) to undo an over-trim. Bounded to
 * `[2, config.groupCap]`; a no-op when it already matches; existing larger
 * Groups are untouched (the fold enforces that).
 */
export function lowerGroupCapOutcome(
  state: SessionState,
  cap: number,
): FloorOpOutcome {
  if (!Number.isInteger(cap) || cap < 2 || cap > state.config.groupCap) {
    return {
      kind: "error",
      error: `Pick a cap between 2 and ${state.config.groupCap}.`,
    };
  }
  if (cap === state.groupCap) return { kind: "noop" };
  return { kind: "event", type: "GROUP_CAP_CHANGED", payload: { cap } };
}

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

import type { SessionState } from "./session/types.ts";

/**
 * The operational turnover events a floor tap can produce. The same closed set
 * `on_deck_volunteer_append` whitelists for a link-authenticated Volunteer.
 */
export type FloorEventType =
  | "COURT_FINISHED"
  | "PLAYER_PAUSED"
  | "PLAYER_REQUEUED"
  | "FOURSOME_MEMBER_SWAPPED";

/**
 * `event` — append this. `noop` — the board already moved on (a double tap, a
 * stale poll); do nothing, report success. `error` — the tap does not apply;
 * show the message.
 */
export type FloorOpOutcome =
  | { kind: "event"; type: FloorEventType; payload: Record<string, unknown> }
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

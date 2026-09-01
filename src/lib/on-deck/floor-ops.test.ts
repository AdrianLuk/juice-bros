import assert from "node:assert/strict";
import test from "node:test";

import { reduceSession } from "./session/reduce.ts";
import type {
  Operator,
  SessionConfig,
  SessionEvent,
} from "./session/types.ts";
import {
  bringBackOutcome,
  finishCourtOutcome,
  setAsideOutcome,
  swapNoShowOutcome,
  tokenForName,
} from "./floor-ops.ts";

const config: SessionConfig = {
  sessionId: "session-1",
  clubId: "club-1",
  venueName: "Ramsden Park",
  courtCount: 8,
  groupCap: 4,
  floorMode: "hybrid",
  seed: "seed-1",
};

const organizer: Operator = { kind: "organizer", userId: "vanessa" };
const player: Operator = { kind: "player" };

let clock = 1_000;
const tick = () => (clock += 1_000);

function started(): SessionEvent {
  return { type: "SESSION_STARTED", at: tick(), operator: organizer };
}
function joined(token: string, first: string): SessionEvent {
  return {
    type: "PLAYER_JOINED",
    at: tick(),
    operator: player,
    token,
    firstName: first,
    lastInitial: "X",
    skillLevel: "intermediate",
  };
}
function queued(token: string): SessionEvent {
  return { type: "PLAYER_QUEUED", at: tick(), operator: player, token };
}
function courtFinished(court: number): SessionEvent {
  return { type: "COURT_FINISHED", at: tick(), operator: organizer, court };
}

/** A Session with `n` joined-and-queued Players, then Court 1 filled once. */
function sessionWithFilledCourt(n: number) {
  const events: SessionEvent[] = [started()];
  for (let i = 1; i <= n; i++) events.push(joined(`p${i}`, `P${i}`));
  for (let i = 1; i <= n; i++) events.push(queued(`p${i}`));
  events.push(courtFinished(1)); // walks a Foursome onto the empty Court 1
  const state = reduceSession(config, events);
  const nameOf = (id: string) =>
    state.roster.find((p) => p.id === id)?.displayName ?? "?";
  return { state, nameOf };
}

test("tokenForName resolves a display name back to its roster token", () => {
  const { state } = sessionWithFilledCourt(6);
  assert.equal(tokenForName(state, "P1 X."), "p1");
  assert.equal(tokenForName(state, "  P2 X.  "), "p2");
  assert.equal(tokenForName(state, "Nobody Here"), null);
});

test("finishCourtOutcome: a fresh board yields a COURT_FINISHED event", () => {
  const { state } = sessionWithFilledCourt(8);
  const since = state.courts[0].since;
  assert.deepEqual(finishCourtOutcome(state, 1, since), {
    kind: "event",
    type: "COURT_FINISHED",
    payload: { court: 1 },
  });
});

test("finishCourtOutcome: a stale `since` is a silent no-op", () => {
  const { state } = sessionWithFilledCourt(8);
  const since = state.courts[0].since ?? 0;
  assert.deepEqual(finishCourtOutcome(state, 1, since + 999), { kind: "noop" });
});

test("finishCourtOutcome: an empty Court with a null expectation still fires", () => {
  const { state } = sessionWithFilledCourt(8);
  assert.equal(state.courts[1].foursome.length, 0);
  assert.deepEqual(finishCourtOutcome(state, 2, null), {
    kind: "event",
    type: "COURT_FINISHED",
    payload: { court: 2 },
  });
});

test("finishCourtOutcome: a Court number off the Session is an error", () => {
  const { state } = sessionWithFilledCourt(8);
  assert.equal(finishCourtOutcome(state, 0, null).kind, "error");
  assert.equal(finishCourtOutcome(state, 99, null).kind, "error");
  assert.equal(finishCourtOutcome(state, 1.5, null).kind, "error");
});

test("setAsideOutcome pauses a named Player as a set-aside", () => {
  const { state, nameOf } = sessionWithFilledCourt(8);
  const waiting = nameOf(state.queue[0].playerId);
  assert.deepEqual(setAsideOutcome(state, waiting), {
    kind: "event",
    type: "PLAYER_PAUSED",
    payload: { token: state.queue[0].playerId, reason: "set-aside" },
  });
  assert.equal(setAsideOutcome(state, "Ghost X.").kind, "error");
});

test("bringBackOutcome re-queues a named Player", () => {
  const { state, nameOf } = sessionWithFilledCourt(8);
  const someone = nameOf(state.roster[0].id);
  assert.deepEqual(bringBackOutcome(state, someone), {
    kind: "event",
    type: "PLAYER_REQUEUED",
    payload: { token: state.roster[0].id },
  });
});

test("swapNoShowOutcome swaps a Player on the Court for one still waiting", () => {
  const { state, nameOf } = sessionWithFilledCourt(8);
  const since = state.courts[0].since;
  const onCourt = nameOf(state.courts[0].foursome[0]);
  const waiting = nameOf(state.queue[0].playerId);

  assert.deepEqual(swapNoShowOutcome(state, 1, since, onCourt, waiting), {
    kind: "event",
    type: "FOURSOME_MEMBER_SWAPPED",
    payload: {
      court: 1,
      out: state.courts[0].foursome[0],
      in: state.queue[0].playerId,
    },
  });
});

test("swapNoShowOutcome rejects an empty Court, a stale board, and a bad pick", () => {
  const { state, nameOf } = sessionWithFilledCourt(8);
  const since = state.courts[0].since;
  const onCourt = nameOf(state.courts[0].foursome[0]);
  const waiting = nameOf(state.queue[0].playerId);

  assert.equal(swapNoShowOutcome(state, 2, null, onCourt, waiting).kind, "error");
  assert.equal(
    swapNoShowOutcome(state, 1, (since ?? 0) + 1, onCourt, waiting).kind,
    "error",
  );
  // `waiting` is not on the Court, so it cannot be the no-show.
  assert.equal(swapNoShowOutcome(state, 1, since, waiting, onCourt).kind, "error");
  // Someone already on the Court is not "still waiting" to swap in.
  const onCourt2 = nameOf(state.courts[0].foursome[1]);
  assert.equal(
    swapNoShowOutcome(state, 1, since, onCourt, onCourt2).kind,
    "error",
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import { reduceSession } from "./session/reduce.ts";
import type {
  Operator,
  SessionConfig,
  SessionEvent,
} from "./session/types.ts";
import {
  addWalkupOutcome,
  bringBackOutcome,
  describeUndo,
  finishCourtOutcome,
  overrideSkillOutcome,
  setAsideOutcome,
  swapNoShowOutcome,
  tokenForName,
  UNDO_WINDOW_MS,
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

test("addWalkupOutcome yields a queued PLAYER_JOINED with the minted token", () => {
  const { state } = sessionWithFilledCourt(6);
  assert.deepEqual(
    addWalkupOutcome(state, "walkup-abc", " Wanda ", "w", "beginner"),
    {
      kind: "event",
      type: "PLAYER_JOINED",
      payload: {
        token: "walkup-abc",
        firstName: "Wanda",
        lastInitial: "W",
        skillLevel: "beginner",
        queueOnJoin: true,
      },
    },
  );
});

test("addWalkupOutcome rejects a blank name, blank initial, or unknown skill", () => {
  const { state } = sessionWithFilledCourt(6);
  assert.equal(addWalkupOutcome(state, "w1", "  ", "W", "beginner").kind, "error");
  assert.equal(addWalkupOutcome(state, "w1", "Wanda", "  ", "beginner").kind, "error");
  assert.equal(addWalkupOutcome(state, "w1", "Wanda", "W", "pro").kind, "error");
});

test("addWalkupOutcome is a no-op when the minted token is somehow already on the roster", () => {
  const { state } = sessionWithFilledCourt(6);
  assert.deepEqual(addWalkupOutcome(state, "p1", "Wanda", "W", "beginner"), {
    kind: "noop",
  });
});

test("overrideSkillOutcome resolves a name and yields PLAYER_SKILL_SET", () => {
  const { state } = sessionWithFilledCourt(6);
  assert.deepEqual(overrideSkillOutcome(state, "P1 X.", "advanced"), {
    kind: "event",
    type: "PLAYER_SKILL_SET",
    payload: { token: "p1", skillLevel: "advanced" },
  });
});

test("overrideSkillOutcome is a no-op when the level already matches", () => {
  const { state } = sessionWithFilledCourt(6);
  // joined() defaults to intermediate.
  assert.deepEqual(overrideSkillOutcome(state, "P1 X.", "intermediate"), {
    kind: "noop",
  });
});

test("overrideSkillOutcome errors on an unknown player or an unknown level", () => {
  const { state } = sessionWithFilledCourt(6);
  assert.equal(overrideSkillOutcome(state, "Ghost X.", "advanced").kind, "error");
  assert.equal(overrideSkillOutcome(state, "P1 X.", "expert").kind, "error");
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

// --- describeUndo (#247) -------------------------------------------------

const NOW = 1_000_000_000_000;
const byOrganizer: Operator = { kind: "organizer", userId: "vanessa" };
const last = (type: string, at = NOW, operator: Operator = byOrganizer) => ({
  seq: 42,
  type,
  at,
  operator,
});

test("describeUndo offers a recent turnover event, with a per-type label and who fired it", () => {
  assert.deepEqual(describeUndo(last("COURT_FINISHED", NOW - 1000), NOW), {
    seq: 42,
    label: "the last court finish",
    by: "organizer",
  });
  assert.equal(describeUndo(last("PLAYER_PAUSED"), NOW)?.label, "the last set-aside");
  assert.equal(
    describeUndo(last("FOURSOME_MEMBER_SWAPPED"), NOW)?.label,
    "the last no-show swap",
  );
  assert.equal(describeUndo(last("PLAYER_REQUEUED"), NOW)?.label, "the last re-queue");
  assert.equal(
    describeUndo(last("COURT_FINISHED", NOW, { kind: "volunteer" }), NOW)?.by,
    "volunteer",
  );
});

test("describeUndo declines a structural or Player-sourced last event", () => {
  for (const type of ["SESSION_STARTED", "PLAYER_JOINED", "PLAYER_QUEUED"]) {
    assert.equal(describeUndo(last(type), NOW), null);
  }
});

test("describeUndo declines an event past the undo window, and an empty log", () => {
  assert.equal(
    describeUndo(last("COURT_FINISHED", NOW - UNDO_WINDOW_MS - 1), NOW),
    null,
  );
  assert.notEqual(
    describeUndo(last("COURT_FINISHED", NOW - UNDO_WINDOW_MS + 1), NOW),
    null,
  );
  assert.equal(describeUndo(null, NOW), null);
});

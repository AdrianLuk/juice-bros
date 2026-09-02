import assert from "node:assert/strict";
import test from "node:test";

import { reduceSession } from "./reduce.ts";
import {
  EXPECTED_GAME_MS,
  IDLE_COURT_NUDGE_MS,
  idleCourts,
} from "./idle-court.ts";
import type { Operator, SessionConfig, SessionEvent } from "./types.ts";

const config: SessionConfig = {
  sessionId: "session-1",
  clubId: "club-1",
  venueName: "Ramsden Park",
  courtCount: 2,
  groupCap: 4,
  seed: "seed-1",
  floorMode: "self-serve",
};

const vanessa: Operator = { kind: "organizer", userId: "vanessa" };
const kiosk: Operator = { kind: "kiosk" };
const player: Operator = { kind: "player" };

let clock = 1_000;
function at(): number {
  clock += 1_000;
  return clock;
}

function joined(token: string): SessionEvent {
  return {
    type: "PLAYER_JOINED",
    at: at(),
    operator: player,
    token,
    firstName: token,
    lastInitial: "X",
    skillLevel: "intermediate",
  };
}

function queued(token: string): SessionEvent {
  return { type: "PLAYER_QUEUED", at: at(), operator: player, token };
}

/** A started Session with `n` joined-and-queued Players. */
function sessionWith(n: number): SessionEvent[] {
  const events: SessionEvent[] = [
    { type: "SESSION_STARTED", at: at(), operator: vanessa },
  ];
  for (let i = 1; i <= n; i++) events.push(joined(`p${i}`));
  for (let i = 1; i <= n; i++) events.push(queued(`p${i}`));
  return events;
}

/** Seat a Foursome on Court 1 at time `seatedAt` by folding a COURT_FINISHED on
 * the empty Court. */
function seatCourt1(events: SessionEvent[], seatedAt: number): SessionEvent[] {
  return [
    ...events,
    { type: "COURT_FINISHED", at: seatedAt, operator: kiosk, court: 1 },
  ];
}

test("a Court just seated is not idle", () => {
  const events = seatCourt1(sessionWith(4), at());
  const state = reduceSession(config, events);
  assert.deepEqual(idleCourts(state, clock + 1_000), []);
});

test("a Court in play past the nudge threshold is flagged", () => {
  const seatedAt = at();
  const state = reduceSession(config, seatCourt1(sessionWith(4), seatedAt));
  // Just short of the threshold: nothing.
  assert.deepEqual(idleCourts(state, seatedAt + IDLE_COURT_NUDGE_MS - 1), []);
  // At the threshold: flagged.
  assert.deepEqual(idleCourts(state, seatedAt + IDLE_COURT_NUDGE_MS), [1]);
});

test("an empty Court is never flagged", () => {
  const state = reduceSession(config, sessionWith(4));
  assert.deepEqual(
    idleCourts(state, clock + IDLE_COURT_NUDGE_MS * 10),
    [],
  );
});

test("COURT_CONFIRMED pushes the nudge out by another game length", () => {
  const seatedAt = at();
  const base = seatCourt1(sessionWith(4), seatedAt);
  const confirmAt = seatedAt + IDLE_COURT_NUDGE_MS;
  const state = reduceSession(config, [
    ...base,
    {
      type: "COURT_CONFIRMED",
      at: confirmAt,
      operator: kiosk,
      court: 1,
      since: seatedAt,
    },
  ]);

  // Right after confirming: not idle any more, even though it was a moment ago.
  assert.deepEqual(idleCourts(state, confirmAt + 1_000), []);
  // Idle again once another full threshold has passed since the confirmation.
  assert.deepEqual(
    idleCourts(state, confirmAt + IDLE_COURT_NUDGE_MS),
    [1],
  );
});

test("COURT_CONFIRMED with a stale `since` is a no-op", () => {
  const seatedAt = at();
  const state = reduceSession(config, [
    ...seatCourt1(sessionWith(4), seatedAt),
    {
      type: "COURT_CONFIRMED",
      at: seatedAt + IDLE_COURT_NUDGE_MS,
      operator: kiosk,
      court: 1,
      since: seatedAt - 999, // never matched the seated Game
    },
  ]);
  // The confirmation didn't take, so the Court is still flagged.
  assert.deepEqual(idleCourts(state, seatedAt + IDLE_COURT_NUDGE_MS), [1]);
});

test("a fresh Game on a Court clears the prior confirmation", () => {
  const seatedAt = at();
  const confirmAt = seatedAt + EXPECTED_GAME_MS;
  const events: SessionEvent[] = [
    ...sessionWith(8),
    { type: "COURT_FINISHED", at: seatedAt, operator: kiosk, court: 1 },
    {
      type: "COURT_CONFIRMED",
      at: confirmAt,
      operator: kiosk,
      court: 1,
      since: seatedAt,
    },
    // Court 1's Game ends and the next Foursome walks on.
    {
      type: "COURT_FINISHED",
      at: confirmAt + 1_000,
      operator: kiosk,
      court: 1,
    },
  ];
  const state = reduceSession(config, events);
  const newSeatedAt = state.courts.find((c) => c.number === 1)?.since;
  assert.ok(newSeatedAt);
  // The new Game is measured from its own seat time, not the stale confirm.
  assert.deepEqual(idleCourts(state, newSeatedAt + IDLE_COURT_NUDGE_MS - 1), []);
  assert.deepEqual(idleCourts(state, newSeatedAt + IDLE_COURT_NUDGE_MS), [1]);
});

test("undo parity: dropping a COURT_CONFIRMED restores the prior nudge state", () => {
  const seatedAt = at();
  const base = seatCourt1(sessionWith(4), seatedAt);
  const withConfirm: SessionEvent[] = [
    ...base,
    {
      type: "COURT_CONFIRMED",
      at: seatedAt + IDLE_COURT_NUDGE_MS,
      operator: kiosk,
      court: 1,
      since: seatedAt,
    },
  ];
  const rolledBack = reduceSession(config, base);
  const undone = reduceSession(config, withConfirm.slice(0, -1));
  assert.deepEqual(undone, rolledBack);
});

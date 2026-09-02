import assert from "node:assert/strict";
import test from "node:test";

import { planTurnNotificationRun } from "./turn-notify-run.ts";
import { reduceSession } from "./session/reduce.ts";
import type {
  Operator,
  SessionConfig,
  SessionEvent,
} from "./session/types.ts";

const config: SessionConfig = {
  sessionId: "session-1",
  clubId: "club-1",
  venueName: "Ramsden Park",
  courtCount: 1,
  groupCap: 4,
  seed: "seed-1",
  floorMode: "self-serve",
};

const vanessa: Operator = { kind: "organizer", userId: "vanessa" };
const player: Operator = { kind: "player" };

let clock = 1_000;
const tick = () => (clock += 1_000);

function started(): SessionEvent {
  return { type: "SESSION_STARTED", at: tick(), operator: vanessa };
}
function joined(token: string): SessionEvent {
  return {
    type: "PLAYER_JOINED",
    at: tick(),
    operator: player,
    token,
    firstName: token,
    lastInitial: "X",
    skillLevel: "intermediate",
  };
}
function queued(token: string): SessionEvent {
  return { type: "PLAYER_QUEUED", at: tick(), operator: player, token };
}
function courtFinished(court: number): SessionEvent {
  return { type: "COURT_FINISHED", at: tick(), operator: vanessa, court };
}

/** Four players onto the one empty Court. */
function seatFour(): { before: ReturnType<typeof reduceSession>; after: ReturnType<typeof reduceSession> } {
  const events: SessionEvent[] = [started()];
  for (let i = 1; i <= 4; i++) events.push(joined(`p${i}`));
  for (let i = 1; i <= 4; i++) events.push(queued(`p${i}`));
  const before = reduceSession(config, events);
  const after = reduceSession(config, [...events, courtFinished(1)]);
  return { before, after };
}

const sub = (id: string): { id: string; endpoint: string; p256dh: string; auth: string } => ({
  id,
  endpoint: `https://push.example/${id}`,
  p256dh: "key",
  auth: "auth",
});

test("no VAPID keys on the deploy => empty plan, feature stays off", () => {
  const { before, after } = seatFour();
  const { sends } = planTurnNotificationRun({
    before,
    after,
    venueName: "Ramsden Park",
    sessionUrl: "https://x/on-deck/session/session-1",
    subscriptionsByPlayer: new Map([["p1", [sub("s1")]]]),
    alreadySent: new Set(),
    sessionId: "session-1",
    pushConfigured: false,
  });
  assert.deepEqual(sends, []);
});

test("only opted-in Players get a send; the rest get nothing", () => {
  const { before, after } = seatFour();
  const { sends } = planTurnNotificationRun({
    before,
    after,
    venueName: "Ramsden Park",
    sessionUrl: "https://x/on-deck/session/session-1",
    subscriptionsByPlayer: new Map([["p2", [sub("s2")]]]),
    alreadySent: new Set(),
    sessionId: "session-1",
    pushConfigured: true,
  });
  assert.equal(sends.length, 1);
  assert.equal(sends[0].playerToken, "p2");
  assert.equal(sends[0].kind, "court");
  assert.deepEqual(sends[0].subscriptions, [sub("s2")]);
});

test("a transition already in the send log does not fire again", () => {
  const { before, after } = seatFour();
  // Derive the exact per-turn key the planner will build, and pre-seed it.
  const first = planTurnNotificationRun({
    before,
    after,
    venueName: "Ramsden Park",
    sessionUrl: "https://x/on-deck/session/session-1",
    subscriptionsByPlayer: new Map([["p1", [sub("s1")]]]),
    alreadySent: new Set(),
    sessionId: "session-1",
    pushConfigured: true,
  });
  const key = `session-1:p1:${first.sends[0].turnKey}`;

  const { sends } = planTurnNotificationRun({
    before,
    after,
    venueName: "Ramsden Park",
    sessionUrl: "https://x/on-deck/session/session-1",
    subscriptionsByPlayer: new Map([["p1", [sub("s1")]]]),
    alreadySent: new Set([key]),
    sessionId: "session-1",
    pushConfigured: true,
  });
  assert.deepEqual(sends, []);
});

test("the court push body names the Court", () => {
  const { before, after } = seatFour();
  const { sends } = planTurnNotificationRun({
    before,
    after,
    venueName: "Ramsden Park",
    sessionUrl: "https://x/on-deck/session/session-1",
    subscriptionsByPlayer: new Map([["p1", [sub("s1")]]]),
    alreadySent: new Set(),
    sessionId: "session-1",
    pushConfigured: true,
  });
  assert.match(sends[0].payload.body, /Court 1/);
  assert.equal(sends[0].payload.url, "https://x/on-deck/session/session-1");
});

test("no turn transition => no send even with everyone opted in", () => {
  const events: SessionEvent[] = [started(), joined("p1"), joined("p2")];
  const before = reduceSession(config, events);
  const after = reduceSession(config, [...events, queued("p1")]);
  const { sends } = planTurnNotificationRun({
    before,
    after,
    venueName: "Ramsden Park",
    sessionUrl: "https://x/on-deck/session/session-1",
    subscriptionsByPlayer: new Map([
      ["p1", [sub("s1")]],
      ["p2", [sub("s2")]],
    ]),
    alreadySent: new Set(),
    sessionId: "session-1",
    pushConfigured: true,
  });
  assert.deepEqual(sends, []);
});

import assert from "node:assert/strict";
import test from "node:test";

import { reduceSession } from "./reduce.ts";
import { turnTransitions } from "./turn-notify.ts";
import type {
  Operator,
  SessionConfig,
  SessionEvent,
  SkillLevel,
} from "./types.ts";

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
const player: Operator = { kind: "player" };

let clock = 1_000;
function tick(): number {
  clock += 1_000;
  return clock;
}

function started(): SessionEvent {
  return { type: "SESSION_STARTED", at: tick(), operator: vanessa };
}

function joined(token: string, skill: SkillLevel = "intermediate"): SessionEvent {
  return {
    type: "PLAYER_JOINED",
    at: tick(),
    operator: player,
    token,
    firstName: token,
    lastInitial: "X",
    skillLevel: skill,
  };
}

function queued(token: string): SessionEvent {
  return { type: "PLAYER_QUEUED", at: tick(), operator: player, token };
}

function courtFinished(court: number): SessionEvent {
  return { type: "COURT_FINISHED", at: tick(), operator: vanessa, court };
}

/** Fold `events`, then fold `events` + `next`, and diff — the shape a caller uses. */
function transitionsAfter(
  events: SessionEvent[],
  next: SessionEvent[],
): ReturnType<typeof turnTransitions> {
  const before = reduceSession(config, events);
  const after = reduceSession(config, [...events, ...next]);
  return turnTransitions(before, after);
}

test("no transitions when nothing about courts or On Deck changed", () => {
  const base = [started(), joined("p1"), joined("p2")];
  assert.deepEqual(transitionsAfter(base, [queued("p1")]), []);
});

test("a Foursome becoming On Deck fires one on-deck transition per member", () => {
  // 2 courts: the first 8 queued fill both Courts (4 each), the next four are
  // "Up next" On Deck.
  const base: SessionEvent[] = [started()];
  for (let i = 1; i <= 12; i++) base.push(joined(`p${i}`));
  for (let i = 1; i <= 8; i++) base.push(queued(`p${i}`));

  // Courts are still empty until a COURT_FINISHED seats them — so queue p1..p8,
  // finish both empty courts to seat them, then queue the On Deck four.
  const seatCourts = [courtFinished(1), courtFinished(2)];
  const seeded = [...base, ...seatCourts];

  const result = transitionsAfter(seeded, [
    queued("p9"),
    queued("p10"),
    queued("p11"),
    queued("p12"),
  ]);

  assert.deepEqual(
    result.map((t) => t.kind),
    ["on-deck", "on-deck", "on-deck", "on-deck"],
  );
  assert.deepEqual(
    new Set(result.map((t) => t.playerId)),
    new Set(["p9", "p10", "p11", "p12"]),
  );
  assert.ok(result.every((t) => t.court === null));
});

test("being assigned a Court fires one court transition carrying the Court number", () => {
  const base: SessionEvent[] = [started()];
  for (let i = 1; i <= 8; i++) base.push(joined(`p${i}`));
  for (let i = 1; i <= 8; i++) base.push(queued(`p${i}`));
  // Seat both courts (p1..p8).
  const seeded = [...base, courtFinished(1), courtFinished(2)];
  // Add four more, they go On Deck; finishing Court 1 promotes them onto it.
  const withOnDeck = [
    ...seeded,
    joined("q1"),
    joined("q2"),
    joined("q3"),
    joined("q4"),
    queued("q1"),
    queued("q2"),
    queued("q3"),
    queued("q4"),
  ];

  const result = transitionsAfter(withOnDeck, [courtFinished(1)]);

  const courtTransitions = result.filter((t) => t.kind === "court");
  assert.equal(courtTransitions.length, 4);
  assert.deepEqual(
    new Set(courtTransitions.map((t) => t.playerId)),
    new Set(["q1", "q2", "q3", "q4"]),
  );
  assert.ok(courtTransitions.every((t) => t.court === 1));
});

test("a Player promoted On Deck -> Court gets only the court transition, not another on-deck one", () => {
  const base: SessionEvent[] = [started()];
  for (let i = 1; i <= 8; i++) base.push(joined(`p${i}`));
  for (let i = 1; i <= 8; i++) base.push(queued(`p${i}`));
  const seeded = [
    ...base,
    courtFinished(1),
    courtFinished(2),
    joined("q1"),
    joined("q2"),
    joined("q3"),
    joined("q4"),
    queued("q1"),
    queued("q2"),
    queued("q3"),
    queued("q4"),
  ];
  // q1..q4 are already On Deck in `seeded`. The next COURT_FINISHED promotes
  // them — the diff from `seeded` -> after must be court-only for them.
  const result = transitionsAfter(seeded, [courtFinished(1)]);
  for (const token of ["q1", "q2", "q3", "q4"]) {
    const forToken = result.filter((t) => t.playerId === token);
    assert.deepEqual(
      forToken.map((t) => t.kind),
      ["court"],
      `${token} should get exactly one court transition`,
    );
  }
});

test("a Player seated straight from a thin Queue (skipping On Deck) still gets a court transition", () => {
  // One court, four players — they go straight on when the empty Court is
  // 'finished', never passing through a committed On Deck Foursome.
  const oneCourt: SessionConfig = { ...config, courtCount: 1 };
  const events: SessionEvent[] = [started()];
  for (let i = 1; i <= 4; i++) events.push(joined(`p${i}`));
  for (let i = 1; i <= 4; i++) events.push(queued(`p${i}`));

  const before = reduceSession(oneCourt, events);
  const after = reduceSession(oneCourt, [...events, courtFinished(1)]);
  const result = turnTransitions(before, after);

  assert.equal(result.length, 4);
  assert.ok(result.every((t) => t.kind === "court" && t.court === 1));
});

test("a no-show swap-in fires a court transition for the replacement only", () => {
  const events: SessionEvent[] = [started()];
  for (let i = 1; i <= 9; i++) events.push(joined(`p${i}`));
  for (let i = 1; i <= 9; i++) events.push(queued(`p${i}`));
  // Seat Court 1 with p1..p4 (Court 2 too, but p9 stays waiting).
  const seeded = [...events, courtFinished(1), courtFinished(2)];

  const swap: SessionEvent = {
    type: "FOURSOME_MEMBER_SWAPPED",
    at: tick(),
    operator: vanessa,
    court: 1,
    out: "p1",
    in: "p9",
  };

  const result = transitionsAfter(seeded, [swap]);
  assert.equal(result.length, 1);
  assert.equal(result[0].playerId, "p9");
  assert.equal(result[0].kind, "court");
  assert.equal(result[0].court, 1);
});

test("turnKey is distinct per Game so a Player is buzzed every turn, not just the first", () => {
  // One court. Seat p1..p4 for Game 1, finish it (they re-queue), and the next
  // COURT_FINISHED seats a fresh Foursome — p1's second turn must carry a
  // different turnKey than their first.
  const oneCourt: SessionConfig = { ...config, courtCount: 1 };
  const events: SessionEvent[] = [started()];
  for (let i = 1; i <= 8; i++) events.push(joined(`p${i}`));
  for (let i = 1; i <= 8; i++) events.push(queued(`p${i}`));

  const game1 = [...events, courtFinished(1)];
  const firstKey = turnTransitions(
    reduceSession(oneCourt, events),
    reduceSession(oneCourt, game1),
  ).find((t) => t.playerId === "p1")!.turnKey;

  // p5..p8 play Game 2; finishing it re-queues them and seats p1..p4 again.
  const game2 = [...game1, courtFinished(1), courtFinished(1)];
  const secondTurn = turnTransitions(
    reduceSession(oneCourt, [...game1, courtFinished(1)]),
    reduceSession(oneCourt, game2),
  ).find((t) => t.playerId === "p1");

  assert.ok(secondTurn, "p1 should get a fresh court transition for Game 2");
  assert.notEqual(secondTurn!.turnKey, firstKey);
});

test("queue-position movement short of On Deck fires nothing", () => {
  // One court, depth-2 On Deck holds 8 committed. Seat the court (p1..p4),
  // queue enough to fill both On Deck Foursomes (p5..p12), then a straggler
  // p13..p16 who sit in the plain Queue behind On Deck.
  const oneCourt: SessionConfig = { ...config, courtCount: 1 };
  const base: SessionEvent[] = [started()];
  for (let i = 1; i <= 16; i++) base.push(joined(`p${i}`));
  for (let i = 1; i <= 4; i++) base.push(queued(`p${i}`));
  const seeded = [...base, courtFinished(1)];
  for (let i = 5; i <= 12; i++) seeded.push(queued(`p${i}`));

  const before = reduceSession(oneCourt, seeded);
  // p13..p16 join the Queue — behind the two committed On Deck Foursomes.
  const after = reduceSession(oneCourt, [
    ...seeded,
    queued("p13"),
    queued("p14"),
    queued("p15"),
    queued("p16"),
  ]);
  const result = turnTransitions(before, after);
  assert.deepEqual(result, []);
});

test("determinism: the same before/after states always diff to the same transitions", () => {
  const base: SessionEvent[] = [started()];
  for (let i = 1; i <= 12; i++) base.push(joined(`p${i}`));
  for (let i = 1; i <= 8; i++) base.push(queued(`p${i}`));
  const seeded = [...base, courtFinished(1), courtFinished(2)];
  const next = [queued("p9"), queued("p10"), queued("p11"), queued("p12")];

  const a = transitionsAfter(seeded, next);
  const b = transitionsAfter(seeded, next);
  assert.deepEqual(a, b);
});

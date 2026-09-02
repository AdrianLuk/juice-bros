import assert from "node:assert/strict";
import test from "node:test";

import { projectSummary } from "./summary.ts";
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
  floorMode: "hybrid",
};

const vanessa: Operator = { kind: "organizer", userId: "vanessa" };
const player: Operator = { kind: "player" };

const MIN = 60_000;
let clock = 0;
function at(minutes: number): number {
  clock = minutes * MIN;
  return clock;
}

function started(min: number): SessionEvent {
  return { type: "SESSION_STARTED", at: at(min), operator: vanessa };
}
function joined(
  min: number,
  token: string,
  skillLevel: SkillLevel = "intermediate",
): SessionEvent {
  return {
    type: "PLAYER_JOINED",
    at: at(min),
    operator: player,
    token,
    firstName: token,
    lastInitial: "X",
    skillLevel,
  };
}
function queued(min: number, token: string): SessionEvent {
  return { type: "PLAYER_QUEUED", at: at(min), operator: player, token };
}
function courtFinished(min: number, court: number): SessionEvent {
  return { type: "COURT_FINISHED", at: at(min), operator: vanessa, court };
}

test("an empty Session projects zeroed aggregates", () => {
  const summary = projectSummary(config, [started(0)]);
  assert.equal(summary.attendance, 0);
  assert.equal(summary.gamesPlayed, 0);
  assert.equal(summary.waitTime.longestWaitMin, 0);
  assert.equal(summary.waitTime.sampleSize, 0);
  assert.deepEqual(summary.skillMix, {
    newbie: 0,
    beginner: 0,
    intermediate: 0,
    advanced: 0,
  });
});

test("attendance counts every distinct Player who joined", () => {
  const events: SessionEvent[] = [started(0)];
  for (let i = 1; i <= 6; i++) events.push(joined(1, `p${i}`));
  // A replayed join for p1 must not double-count.
  events.push(joined(2, "p1"));
  assert.equal(projectSummary(config, events).attendance, 6);
});

test("gamesPlayed counts only occupied Courts finishing, and splits per Court", () => {
  // 8 players queue at minute 0. Courts start empty; the first COURT_FINISHED
  // per Court is "send next four" and carries no Game.
  const events: SessionEvent[] = [started(0)];
  for (let i = 1; i <= 8; i++) events.push(joined(0, `p${i}`));
  for (let i = 1; i <= 8; i++) events.push(queued(0, `p${i}`));
  events.push(courtFinished(1, 1)); // seats Court 1 (no Game)
  events.push(courtFinished(2, 2)); // seats Court 2 (no Game)
  events.push(courtFinished(15, 1)); // Court 1: a real Game
  events.push(courtFinished(30, 1)); // Court 1: a second real Game
  events.push(courtFinished(31, 2)); // Court 2: a real Game

  const summary = projectSummary(config, events);
  assert.equal(summary.gamesPlayed, 3);
  assert.deepEqual(summary.courtUtilization.perCourt, [2, 1]);
  assert.equal(summary.courtUtilization.courtCount, 2);
  assert.equal(summary.courtUtilization.gamesPerCourt, 1.5);
});

test("wait-time distribution, longest and average are correct against a known log", () => {
  // Two Courts, 12 players all queued at minute 0.
  const events: SessionEvent[] = [started(0)];
  for (let i = 1; i <= 12; i++) events.push(joined(0, `p${i}`));
  for (let i = 1; i <= 12; i++) events.push(queued(0, `p${i}`));
  // Seat both Courts at minute 0 — p1-4 on Court 1, p5-8 on Court 2, each a
  // 0-minute wait. p9-12 keep waiting (wait began at 0).
  events.push(courtFinished(0, 1));
  events.push(courtFinished(0, 2));
  // Court 1 finishes at minute 12 — p1-4 re-queue (wait resets to 12); p9-12,
  // waiting since 0, walk on → a 12-minute wait each.
  events.push(courtFinished(12, 1));
  // Court 2 finishes at minute 40 — p5-8 re-queue. The four seated now are
  // p1-4, waiting since minute 12 → 28 minutes each.
  events.push(courtFinished(40, 2));

  const summary = projectSummary(config, events);
  // Completed waits: 8 × 0 (startup), 4 × 12 (p9-12), 4 × 28 (p1-4). = 16.
  assert.equal(summary.waitTime.sampleSize, 16);
  assert.equal(summary.waitTime.longestWaitMin, 28);
  // (8*0 + 4*12 + 4*28) / 16 = 160/16 = 10.
  assert.equal(summary.waitTime.averageWaitMin, 10);

  const buckets = summary.waitTime.distribution;
  assert.equal(buckets[0].count, 8); // [0,5)
  assert.equal(buckets[1].count, 0); // [5,10)
  assert.equal(buckets[2].count, 4); // [10,20)
  assert.equal(buckets[3].count, 4); // [20,30)
  assert.equal(buckets[4].count, 0); // [30,∞)
});

test("skillMix is the roster head-count by declared level", () => {
  const events: SessionEvent[] = [
    started(0),
    joined(1, "a", "newbie"),
    joined(1, "b", "advanced"),
    joined(1, "c", "advanced"),
    joined(1, "d", "intermediate"),
  ];
  assert.deepEqual(projectSummary(config, events).skillMix, {
    newbie: 1,
    beginner: 0,
    intermediate: 1,
    advanced: 2,
  });
});

test("projectSummary is deterministic and unaffected by a trailing LAST_CALL / SESSION_CLOSED", () => {
  const events: SessionEvent[] = [started(0)];
  for (let i = 1; i <= 8; i++) events.push(joined(1, `p${i}`));
  for (let i = 1; i <= 8; i++) events.push(queued(1, `p${i}`));
  events.push(courtFinished(15, 1));

  const bare = projectSummary(config, events);
  const wrapped = projectSummary(config, [
    ...events,
    { type: "LAST_CALL", at: at(60), operator: vanessa },
    { type: "SESSION_CLOSED", at: at(61), operator: vanessa },
  ]);
  assert.deepEqual(bare, wrapped);
});
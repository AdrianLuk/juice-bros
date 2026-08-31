import assert from "node:assert/strict";
import test from "node:test";

import { reduceSession } from "./reduce.ts";
import { playerCourt, queuePosition } from "./types.ts";
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
  courtCount: 8,
  groupCap: 4,
  floorMode: "hybrid",
  seed: "seed-1",
};

const vanessa: Operator = { kind: "organizer", userId: "vanessa" };

let clock = 1_000;
/** Monotonic fake timestamps so tests never touch the real clock. */
function tick(): number {
  clock += 1_000;
  return clock;
}

function started(operator: Operator = vanessa): SessionEvent {
  return { type: "SESSION_STARTED", at: tick(), operator };
}

const player: Operator = { kind: "player" };

function queued(token: string): SessionEvent {
  return { type: "PLAYER_QUEUED", at: tick(), operator: player, token };
}

function courtFinished(court: number, operator: Operator = vanessa): SessionEvent {
  return { type: "COURT_FINISHED", at: tick(), operator, court };
}

/** `started()` plus `count` joined-and-queued Players, tokens `p1`..`pN`. */
function sessionWith(count: number): SessionEvent[] {
  const events: SessionEvent[] = [started()];
  for (let i = 1; i <= count; i++) {
    events.push(joined(`p${i}`, `P${i}`, "X"));
  }
  for (let i = 1; i <= count; i++) {
    events.push(queued(`p${i}`));
  }
  return events;
}

const smallConfig: SessionConfig = { ...config, courtCount: 2 };

function joined(
  token: string,
  firstName: string,
  lastInitial: string,
  skillLevel: SkillLevel = "intermediate",
): SessionEvent {
  return {
    type: "PLAYER_JOINED",
    at: tick(),
    operator: player,
    token,
    firstName,
    lastInitial,
    skillLevel,
  };
}

test("an empty log folds to a pending Session carrying its config", () => {
  const state = reduceSession(config, []);

  assert.equal(state.status, "pending");
  assert.equal(state.startedAt, null);
  assert.equal(state.startedBy, null);
  assert.deepEqual(state.config, config);
});

test("SESSION_STARTED opens the Session and records when and by whom", () => {
  const event = started();
  const state = reduceSession(config, [event]);

  assert.equal(state.status, "open");
  assert.equal(state.startedAt, event.at);
  assert.deepEqual(state.startedBy, vanessa);
});

test("a replayed duplicate SESSION_STARTED does not move the start time or Operator", () => {
  const first = started(vanessa);
  const second = started({ kind: "organizer", userId: "someone-else" });

  const state = reduceSession(config, [first, second]);

  assert.equal(state.startedAt, first.at);
  assert.deepEqual(state.startedBy, vanessa);
});

test("an empty log folds to an empty roster", () => {
  assert.deepEqual(reduceSession(config, []).roster, []);
});

test("PLAYER_JOINED folds a Player into the roster with their name and level", () => {
  const events = [started(), joined("tok-sarah", "Sarah", "K", "advanced")];
  const state = reduceSession(config, events);

  assert.equal(state.roster.length, 1);
  assert.deepEqual(state.roster[0], {
    id: "tok-sarah",
    firstName: "Sarah",
    lastInitial: "K",
    skillLevel: "advanced",
    displayName: "Sarah K.",
    joinedAt: events[1].at,
  });
});

test("the roster is in join order", () => {
  const state = reduceSession(config, [
    started(),
    joined("tok-a", "Ann", "A"),
    joined("tok-b", "Bo", "B"),
    joined("tok-c", "Cy", "C"),
  ]);

  assert.deepEqual(
    state.roster.map((p) => p.id),
    ["tok-a", "tok-b", "tok-c"],
  );
});

test("a replayed PLAYER_JOINED with a token already in the roster is a no-op", () => {
  const first = joined("tok-sarah", "Sarah", "K", "advanced");
  const replay = joined("tok-sarah", "Sarah", "K", "newbie");

  const state = reduceSession(config, [started(), first, replay]);

  assert.equal(state.roster.length, 1);
  assert.equal(state.roster[0].skillLevel, "advanced");
});

test("a second Player with the same name and initial gets a numeric suffix", () => {
  const state = reduceSession(config, [
    started(),
    joined("tok-1", "Sarah", "K"),
    joined("tok-2", "Sarah", "K"),
    joined("tok-3", "Sarah", "K"),
  ]);

  assert.deepEqual(
    state.roster.map((p) => p.displayName),
    ["Sarah K.", "Sarah K. 2", "Sarah K. 3"],
  );
});

test("the same-name check ignores case and surrounding whitespace", () => {
  const state = reduceSession(config, [
    started(),
    joined("tok-1", "Sarah", "K"),
    joined("tok-2", " sarah ", " k "),
  ]);

  assert.equal(state.roster[1].displayName, "Sarah K. 2");
});

test("a PLAYER_JOINED before the Session opens is ignored", () => {
  const state = reduceSession(config, [joined("tok-early", "Early", "B")]);

  assert.deepEqual(state.roster, []);
});

test("undo drops the last join: re-folding the shorter log restores the prior roster", () => {
  const events = [started(), joined("tok-1", "Ann", "A")];
  const before = reduceSession(config, events);
  const after = reduceSession(config, [...events, joined("tok-2", "Bo", "B")]);

  assert.notDeepEqual(after.roster, before.roster);
  assert.deepEqual(reduceSession(config, events).roster, before.roster);
});

test("folding is deterministic — identical config and events give identical state", () => {
  const events: SessionEvent[] = [started()];

  assert.deepEqual(
    reduceSession(config, events),
    reduceSession(config, events),
  );
});

test("undo is dropping the last event: re-folding the shorter log restores the prior state", () => {
  const before = reduceSession(config, []);
  const event = started();
  const after = reduceSession(config, [event]);

  assert.notDeepEqual(after, before);
  assert.deepEqual(reduceSession(config, [event].slice(0, -1)), before);
});

// --- the rotation loop (#243) --------------------------------------------

test("a fresh Session has one empty Court per config.courtCount and an empty Queue", () => {
  const state = reduceSession(smallConfig, [started()]);

  assert.deepEqual(state.queue, []);
  assert.deepEqual(state.courts, [
    { number: 1, foursome: [], since: null },
    { number: 2, foursome: [], since: null },
  ]);
});

test("PLAYER_QUEUED puts a Player in the Queue and they can read their position", () => {
  const events = [
    started(),
    joined("p1", "Ann", "A"),
    joined("p2", "Bo", "B"),
    queued("p1"),
    queued("p2"),
  ];
  const state = reduceSession(smallConfig, events);

  assert.deepEqual(
    state.queue.map((e) => e.playerId),
    ["p1", "p2"],
  );
  assert.equal(queuePosition(state, "p1"), 1);
  assert.equal(queuePosition(state, "p2"), 2);
});

test("a PLAYER_QUEUED for a token not on the roster is ignored", () => {
  const state = reduceSession(smallConfig, [started(), queued("ghost")]);
  assert.deepEqual(state.queue, []);
});

test("a replayed PLAYER_QUEUED for a Player already queued is a no-op", () => {
  const state = reduceSession(smallConfig, [
    started(),
    joined("p1", "Ann", "A"),
    queued("p1"),
    queued("p1"),
  ]);
  assert.equal(state.queue.length, 1);
});

test("the Queue is ordered longest-wait-first", () => {
  const state = reduceSession(config, [
    started(),
    joined("p1", "Ann", "A"),
    joined("p2", "Bo", "B"),
    joined("p3", "Cy", "C"),
    queued("p2"),
    queued("p3"),
    queued("p1"),
  ]);

  assert.deepEqual(
    state.queue.map((e) => e.playerId),
    ["p2", "p3", "p1"],
  );
});

test("a queued Player is not pulled onto an empty Court — selection waits for COURT_FINISHED", () => {
  const state = reduceSession(smallConfig, sessionWith(8));

  assert.equal(state.courts[0].foursome.length, 0);
  assert.equal(state.queue.length, 8);
});

test("COURT_FINISHED on an empty Court seats the longest-waiting Foursome", () => {
  const state = reduceSession(smallConfig, [...sessionWith(6), courtFinished(1)]);

  assert.deepEqual(state.courts[0].foursome, ["p1", "p2", "p3", "p4"]);
  assert.deepEqual(
    state.queue.map((e) => e.playerId),
    ["p5", "p6"],
  );
  assert.equal(playerCourt(state, "p1"), 1);
});

test("COURT_FINISHED with fewer than four waiting leaves the Court empty", () => {
  const state = reduceSession(smallConfig, [...sessionWith(3), courtFinished(1)]);
  assert.equal(state.courts[0].foursome.length, 0);
  assert.equal(state.queue.length, 3);
});

test("COURT_FINISHED re-queues the four coming off and the next four by Wait Time take the Court", () => {
  const state = reduceSession(smallConfig, [
    ...sessionWith(8),
    courtFinished(1), // seats p1..p4
    courtFinished(1), // p1..p4 re-queue behind p5..p8, who walk on
  ]);

  assert.deepEqual(state.courts[0].foursome, ["p5", "p6", "p7", "p8"]);
  assert.deepEqual(
    state.queue.map((e) => e.playerId),
    ["p1", "p2", "p3", "p4"],
  );
});

test("Wait Time resets to the COURT_FINISHED moment for a Player coming off", () => {
  const events = [...sessionWith(8), courtFinished(1), courtFinished(1)];
  const finishedAt = events[events.length - 1].at;
  const state = reduceSession(smallConfig, events);

  const p1 = state.queue.find((e) => e.playerId === "p1");
  assert.equal(p1?.waitSince, finishedAt);
});

test("simultaneous Court finishes fold one at a time with no Player double-assigned", () => {
  const state = reduceSession(smallConfig, [
    ...sessionWith(16),
    courtFinished(1), // p1..p4 onto Court 1
    courtFinished(2), // p5..p8 onto Court 2
    courtFinished(1), // p1..p4 re-queue; p9..p12 onto Court 1
    courtFinished(2), // p5..p8 re-queue; p13..p16 onto Court 2
  ]);

  assert.deepEqual(state.courts[0].foursome, ["p9", "p10", "p11", "p12"]);
  assert.deepEqual(state.courts[1].foursome, ["p13", "p14", "p15", "p16"]);

  const assigned = state.courts.flatMap((c) => c.foursome);
  assert.equal(new Set(assigned).size, assigned.length);
  assert.deepEqual(
    [...state.queue.map((e) => e.playerId)].sort(),
    ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"],
  );
});

test("with nobody else waiting, the four coming off a Court go straight back on", () => {
  const state = reduceSession(smallConfig, [
    ...sessionWith(4),
    courtFinished(1),
    courtFinished(1),
  ]);
  assert.deepEqual(state.courts[0].foursome, ["p1", "p2", "p3", "p4"]);
});

test("COURT_FINISHED for an out-of-range Court is ignored", () => {
  const state = reduceSession(smallConfig, [...sessionWith(8), courtFinished(9)]);
  assert.equal(state.courts[0].foursome.length, 0);
  assert.equal(state.queue.length, 8);
});

test("undo drops the last COURT_FINISHED: re-folding the shorter log restores the prior rotation", () => {
  const base = [...sessionWith(8), courtFinished(1)];
  const before = reduceSession(smallConfig, base);
  const after = reduceSession(smallConfig, [...base, courtFinished(1)]);

  assert.notDeepEqual(after.courts, before.courts);
  assert.deepEqual(reduceSession(smallConfig, base).courts, before.courts);
});

test("a PLAYER_QUEUED before the Session opens is ignored", () => {
  const state = reduceSession(smallConfig, [queued("p1")]);
  assert.deepEqual(state.queue, []);
});

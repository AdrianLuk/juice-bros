import assert from "node:assert/strict";
import test from "node:test";

import { reduceSession } from "./reduce.ts";
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

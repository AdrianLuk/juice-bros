import assert from "node:assert/strict";
import test from "node:test";

import type { RosterPlayer, SessionState } from "./types.ts";
import {
  floorRosterFrom,
  rotationViewFrom,
  type LoadedSession,
} from "./rotation-view.ts";

/**
 * Proof of the extraction (#514): this whole file runs under `node --test`
 * with no `@/` alias and no `server-only` in its import graph — which
 * `rotation.ts` (the old home of this projection) never could, since
 * `server-only` throws outside a `react-server` build.
 *
 * The projection is tested directly against a hand-built `SessionState`
 * rather than through the fold — `reduce.test.ts` already covers what the
 * fold produces; this file covers what the read model does with it.
 */

const NOW = 1_700_000_000_000;

function player(id: string, joinedAt: number): RosterPlayer {
  return {
    id,
    firstName: id.toUpperCase(),
    lastInitial: "X",
    skillLevel: "intermediate",
    displayName: `${id.toUpperCase()} X.`,
    joinedAt,
  };
}

function baseState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    config: {
      sessionId: "session-1",
      clubId: "club-1",
      venueName: "Ramsden Park",
      courtCount: 2,
      groupCap: 4,
      floorMode: "hybrid",
      seed: "seed-1",
    },
    groupCap: 4,
    groups: [],
    startedAt: NOW - 60_000,
    startedBy: { kind: "organizer", userId: "vanessa" },
    lastCallAt: null,
    status: "open",
    roster: [],
    queue: [],
    courts: [
      { number: 1, foursome: [], since: null },
      { number: 2, foursome: [], since: null },
    ],
    onDeck: [],
    paused: [],
    waitStartByPlayer: {},
    courtConfirmedAt: {},
    completedGames: [],
    completedWaits: [],
    ...overrides,
  };
}

function loaded(state: SessionState): LoadedSession {
  return {
    config: state.config,
    status: state.status === "closed" ? "closed" : "open",
    state,
    events: [],
    lastEvent: null,
  };
}

test("rotationViewFrom: a Court's foursome and an untouched Court both project", () => {
  const state = baseState({
    roster: [player("p1", NOW - 40_000), player("p2", NOW - 40_000)],
    courts: [
      { number: 1, foursome: ["p1", "p2"], since: NOW - 10_000 },
      { number: 2, foursome: [], since: null },
    ],
  });
  const view = rotationViewFrom(loaded(state), undefined, NOW);

  assert.deepEqual(view.courts[0].players, ["P1 X.", "P2 X."]);
  assert.equal(view.courts[0].since, NOW - 10_000);
  assert.deepEqual(view.courts[1].players, []);
  assert.equal(view.courts[1].since, null);
});

test("rotationViewFrom: a solo waiter projects into the queue, not On Deck", () => {
  const state = baseState({
    roster: [player("p1", NOW - 5_000)],
    queue: [{ playerId: "p1", waitSince: NOW - 5_000 }],
  });
  const view = rotationViewFrom(loaded(state), undefined, NOW);

  assert.equal(view.queuedCount, 1);
  assert.deepEqual(view.queue, [
    { kind: "solo", name: "P1 X.", waitSince: NOW - 5_000 },
  ]);
  assert.deepEqual(view.waitingNames, ["P1 X."]);
});

test("rotationViewFrom: an On Deck Foursome's members are excluded from the queue", () => {
  const state = baseState({
    roster: [
      player("p1", NOW - 5_000),
      player("p2", NOW - 5_000),
      player("p3", NOW - 5_000),
    ],
    queue: [
      { playerId: "p1", waitSince: NOW - 5_000 },
      { playerId: "p2", waitSince: NOW - 5_000 },
      { playerId: "p3", waitSince: NOW - 2_000 },
    ],
    onDeck: [{ players: ["p1", "p2"], committedAt: NOW - 3_000, groupId: null }],
  });
  const view = rotationViewFrom(loaded(state), undefined, NOW);

  assert.deepEqual(view.onDeck, [["P1 X.", "P2 X."]]);
  assert.deepEqual(view.onDeckIsGroup, [false]);
  assert.equal(view.queuedCount, 1);
  assert.deepEqual(view.waitingNames, ["P3 X."]);
});

test("rotationViewFrom: `me` reports the caller's own queue position and reads no other Player's", () => {
  // A real device token, unlike the short `p1`/`p2` ids the other fixtures
  // use — `rotationViewFrom` matches `me` against the raw token, and refuses
  // anything under 8 chars (ADR 0001: too short to be a real one).
  const state = baseState({
    roster: [player("player01", NOW - 5_000), player("player02", NOW - 5_000)],
    queue: [
      { playerId: "player01", waitSince: NOW - 5_000 },
      { playerId: "player02", waitSince: NOW - 3_000 },
    ],
  });
  const view = rotationViewFrom(loaded(state), "player01", NOW);

  assert.ok(view.me);
  assert.equal(view.me?.position, 1);
  assert.equal(view.me?.court, null);
  assert.equal(view.me?.paused, false);
});

test("rotationViewFrom: a short token never resolves to `me`", () => {
  const state = baseState({
    roster: [player("player01", NOW - 5_000)],
    queue: [{ playerId: "player01", waitSince: NOW - 5_000 }],
  });
  const view = rotationViewFrom(loaded(state), "short", NOW);
  assert.equal(view.me, null);
});

test("rotationViewFrom: skillByName keys every rostered Player by display name", () => {
  const state = baseState({
    roster: [player("p1", NOW - 5_000), player("p2", NOW - 5_000)],
  });
  const view = rotationViewFrom(loaded(state), undefined, NOW);

  assert.deepEqual(view.skillByName, {
    "P1 X.": "intermediate",
    "P2 X.": "intermediate",
  });
});

test("floorRosterFrom: every rostered Player, in roster order, with their Skill Level", () => {
  const state = baseState({
    roster: [player("p2", NOW - 1_000), player("p1", NOW - 5_000)],
  });
  const roster = floorRosterFrom(loaded(state));

  assert.deepEqual(roster, [
    { name: "P2 X.", skillLevel: "intermediate" },
    { name: "P1 X.", skillLevel: "intermediate" },
  ]);
});

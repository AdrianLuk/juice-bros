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

/** `started()` plus one joined-and-queued Player per Skill Level given. */
function sessionWithSkills(skills: SkillLevel[]): SessionEvent[] {
  const events: SessionEvent[] = [started()];
  skills.forEach((skill, i) => events.push(joined(`p${i + 1}`, `P${i + 1}`, "X", skill)));
  skills.forEach((_, i) => events.push(queued(`p${i + 1}`)));
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

test("COURT_FINISHED on an empty Court seats a Foursome anchored by the longest waiter", () => {
  const state = reduceSession(smallConfig, [...sessionWith(6), courtFinished(1)]);

  assert.equal(state.courts[0].foursome.length, 4);
  assert.equal(state.courts[0].foursome[0], "p1", "the anchor leads");
  assert.equal(state.queue.length, 2);
  assert.equal(playerCourt(state, "p1"), 1);
  // The two left behind were in the Queue; none of the seated four remain.
  for (const seated of state.courts[0].foursome) {
    assert.ok(!state.queue.some((e) => e.playerId === seated));
  }
});

test("COURT_FINISHED with fewer than four waiting leaves the Court empty", () => {
  const state = reduceSession(smallConfig, [...sessionWith(3), courtFinished(1)]);
  assert.equal(state.courts[0].foursome.length, 0);
  assert.equal(state.queue.length, 3);
});

test("COURT_FINISHED re-queues the four coming off; the next Foursome is anchored by whoever now waits longest", () => {
  const afterFirst = reduceSession(smallConfig, [
    ...sessionWith(8),
    courtFinished(1),
  ]);
  const firstFour = afterFirst.courts[0].foursome;
  const stillWaiting = afterFirst.queue.map((e) => e.playerId);

  const state = reduceSession(smallConfig, [
    ...sessionWith(8),
    courtFinished(1),
    courtFinished(1),
  ]);

  // The four coming off are all back in the Queue...
  for (const id of firstFour) {
    assert.ok(state.queue.some((e) => e.playerId === id));
  }
  // ...and the new Foursome is drawn from those who were still waiting,
  // anchored by the one who had waited longest (they sort ahead of the
  // just-re-queued four).
  assert.equal(state.courts[0].foursome.length, 4);
  assert.equal(state.courts[0].foursome[0], stillWaiting[0]);
});

test("Wait Time resets to the COURT_FINISHED moment for a Player coming off", () => {
  const base = sessionWith(8);
  const firstFinish = courtFinished(1);
  const secondFinish = courtFinished(1);
  const events = [...base, firstFinish, secondFinish];

  const seatedFirst = reduceSession(smallConfig, [...base, firstFinish])
    .courts[0].foursome;
  const state = reduceSession(smallConfig, events);

  // Everyone sent back to the Queue by the second finish carries its `at`.
  for (const id of seatedFirst) {
    const entry = state.queue.find((e) => e.playerId === id);
    if (entry) assert.equal(entry.waitSince, secondFinish.at);
  }
});

test("simultaneous Court finishes fold one at a time with no Player double-assigned", () => {
  const state = reduceSession(smallConfig, [
    ...sessionWith(16),
    courtFinished(1),
    courtFinished(2),
    courtFinished(1),
    courtFinished(2),
  ]);

  assert.equal(state.courts[0].foursome.length, 4);
  assert.equal(state.courts[1].foursome.length, 4);

  const assigned = state.courts.flatMap((c) => c.foursome);
  assert.equal(new Set(assigned).size, assigned.length, "nobody on two Courts");

  const queued = state.queue.map((e) => e.playerId);
  assert.equal(new Set(queued).size, queued.length, "nobody queued twice");
  // Everyone is either playing or waiting, exactly once.
  assert.equal(assigned.length + queued.length, 16);
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

// --- Match Me through the fold (#244) -----------------------------------

test("the fold seats a same-Skill Foursome over a mixed one", () => {
  // p1 (anchor, intermediate) + a window of two intermediates and three
  // advanced. Match Me takes the intermediates.
  const skills: SkillLevel[] = [
    "intermediate",
    "advanced",
    "intermediate",
    "advanced",
    "intermediate",
    "advanced",
  ];
  const state = reduceSession(smallConfig, [
    ...sessionWithSkills(skills),
    courtFinished(1),
  ]);

  assert.equal(state.courts[0].foursome[0], "p1", "anchor leads");
  assert.deepEqual(
    state.courts[0].foursome.map((id) => idSkill(state, id)).sort(),
    ["advanced", "intermediate", "intermediate", "intermediate"],
  );
});

test("the fold rotates two Courts deterministically when Skill Level pins the picks", () => {
  // Four intermediates then four advanced — Match Me keeps each Court to one
  // level, so every seat is forced and the whole rotation is exact.
  const events = sessionWithSkills([
    "intermediate",
    "intermediate",
    "intermediate",
    "intermediate",
    "advanced",
    "advanced",
    "advanced",
    "advanced",
  ]);
  const state = reduceSession(smallConfig, [
    ...events,
    courtFinished(1), // p1..p4 (intermediates)
    courtFinished(2), // p5..p8 (advanced)
  ]);

  assert.deepEqual(state.courts[0].foursome, ["p1", "p2", "p3", "p4"]);
  assert.deepEqual(state.courts[1].foursome, ["p5", "p6", "p7", "p8"]);
  assert.deepEqual(state.queue, []);
});

test("the fold avoids re-pairing a Foursome across consecutive Games (Variety)", () => {
  // Eight intermediates. Court 1's first Game, then finish it: the four
  // coming off should not be the four Match Me picks next.
  const base = sessionWith(8);
  const first = reduceSession(smallConfig, [...base, courtFinished(1)]);
  const firstFour = new Set(first.courts[0].foursome);

  const next = reduceSession(smallConfig, [
    ...base,
    courtFinished(1),
    courtFinished(1),
  ]);
  const overlap = next.courts[0].foursome.filter((id) => firstFour.has(id));

  // The anchor may be forced (longest wait), but the Foursome as a whole is
  // fresh — no more than the anchor carries over.
  assert.ok(overlap.length <= 1, `overlap was ${overlap.join(", ")}`);
});

test("the fold's selection is deterministic — same events, same Foursome", () => {
  const events = [...sessionWith(12), courtFinished(1), courtFinished(2)];
  const a = reduceSession(config, events);
  const b = reduceSession(config, events);

  assert.deepEqual(a.courts, b.courts);
  assert.deepEqual(a.completedGames, b.completedGames);
});

test("a different seed can seat a different Foursome from the same events", () => {
  const events = [...sessionWith(12), courtFinished(1)];
  const one = reduceSession({ ...config, seed: "one" }, events);
  const two = reduceSession({ ...config, seed: "two" }, events);

  // Both anchor the longest waiter; the trio behind can differ.
  assert.equal(one.courts[0].foursome[0], two.courts[0].foursome[0]);
  // (not asserting they differ — two seeds may coincide — only that each is
  // internally consistent, covered above.)
  assert.equal(one.courts[0].foursome.length, 4);
});

test("COURT_FINISHED records the finished Game for Variety history", () => {
  const base = sessionWith(8);
  const state = reduceSession(smallConfig, [...base, courtFinished(1)]);
  assert.equal(state.completedGames.length, 0, "an empty Court carries no Game");

  const played = reduceSession(smallConfig, [
    ...base,
    courtFinished(1),
    courtFinished(1),
  ]);
  assert.equal(played.completedGames.length, 1);
  assert.equal(played.completedGames[0].players.length, 4);
});

function idSkill(
  state: ReturnType<typeof reduceSession>,
  id: string,
): SkillLevel {
  return state.roster.find((p) => p.id === id)!.skillLevel;
}

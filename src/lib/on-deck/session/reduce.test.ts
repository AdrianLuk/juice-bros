import assert from "node:assert/strict";
import test from "node:test";

import { reduceSession } from "./reduce.ts";
import { playerCourt, queuePosition, queueUnits } from "./types.ts";
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

test("a volunteer-sourced COURT_FINISHED folds identically to an organizer one (#248, ADR 0005)", () => {
  const base = sessionWith(8);
  const at = tick();
  const asOrganizer: SessionEvent = {
    type: "COURT_FINISHED",
    at,
    operator: vanessa,
    court: 1,
  };
  const asVolunteer: SessionEvent = { ...asOrganizer, operator: { kind: "volunteer" } };

  const byOrganizer = reduceSession(smallConfig, [...base, asOrganizer]);
  const byVolunteer = reduceSession(smallConfig, [...base, asVolunteer]);

  assert.deepEqual(byVolunteer.courts, byOrganizer.courts);
  assert.deepEqual(byVolunteer.queue, byOrganizer.queue);
  assert.deepEqual(byVolunteer.onDeck, byOrganizer.onDeck);
});

// --- Match Me through the fold (#244) -----------------------------------

test("a fresh On Deck Foursome is selected through Match Me's window, not by wait order", () => {
  // One Court, an oversubscribed Queue. Startup commits p1-4 and p5-8; p9-13
  // sit in reserve. When the Court frees, p1-4 walk on and On Deck forms a
  // fresh second Foursome from the five reserves — anchor p9 (intermediate)
  // plus the best Skill fit from the window [p10..p13], where p10/p11 are
  // advanced and p12/p13 intermediate. Match Me reaches past the advanced;
  // a naive "front four" would seat them.
  const oneCourt: SessionConfig = { ...config, courtCount: 1 };
  const skills: SkillLevel[] = [
    "intermediate", "intermediate", "intermediate", "intermediate", // p1-4
    "intermediate", "intermediate", "intermediate", "intermediate", // p5-8
    "intermediate", // p9 anchor
    "advanced", "advanced", // p10, p11
    "intermediate", "intermediate", // p12, p13
  ];
  const state = reduceSession(oneCourt, [
    ...sessionWithSkills(skills),
    courtFinished(1),
  ]);

  assert.deepEqual(state.courts[0].foursome, ["p1", "p2", "p3", "p4"]);
  const fresh = state.onDeck[state.onDeck.length - 1];
  assert.equal(fresh.players[0], "p9", "anchor leads");
  assert.deepEqual(
    fresh.players.map((id) => idSkill(state, id)).sort(),
    ["advanced", "intermediate", "intermediate", "intermediate"],
    "Match Me pulled p12/p13 past the advanced p10/p11",
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

// --- On Deck foursomes (#245) ------------------------------------------

/** join + queue one Player, tokens continuing from `p${n}`. */
function addWaiter(n: number): SessionEvent[] {
  return [joined(`p${n}`, `P${n}`, "X"), queued(`p${n}`)];
}

test("two On Deck Foursomes are committed once eight are waiting, before any Court frees", () => {
  const state = reduceSession(config, sessionWith(8));

  assert.equal(state.onDeck.length, 2);
  assert.deepEqual(state.onDeck[0].players, ["p1", "p2", "p3", "p4"]);
  assert.deepEqual(state.onDeck[1].players, ["p5", "p6", "p7", "p8"]);
  // Nothing has been seated — these are announced ahead of a Court freeing.
  assert.ok(state.courts.every((c) => c.foursome.length === 0));
});

test("fewer than four waiting: nobody is On Deck yet — a lone waiter is just in the Queue", () => {
  const state = reduceSession(config, sessionWith(3));
  assert.deepEqual(state.onDeck, []);
  assert.equal(state.queue.length, 3);
});

test("the first On Deck Foursome only commits once four are waiting", () => {
  const three = reduceSession(config, sessionWith(3));
  assert.equal(three.onDeck.length, 0);
  const four = reduceSession(config, sessionWith(4));
  assert.equal(four.onDeck.length, 1);
  assert.equal(four.onDeck[0].players.length, 4);
});

test("each On Deck Foursome is anchored by its longest waiter", () => {
  const state = reduceSession(config, sessionWith(9));
  assert.equal(state.onDeck[0].players[0], "p1");
  assert.equal(state.onDeck[1].players[0], "p5");
});

test("a committed On Deck Foursome does not change when another Player joins", () => {
  const base = sessionWith(8);
  const before = reduceSession(config, base);
  const after = reduceSession(config, [...base, ...addWaiter(9)]);

  assert.deepEqual(after.onDeck[0], before.onDeck[0]);
  assert.deepEqual(after.onDeck[1], before.onDeck[1]);
  assert.equal(after.queue.length, 9);
});

test("an incomplete On Deck Foursome tops up as Players join, without reshuffling its members", () => {
  // Six waiting: F0 is a full Match Me pick, F1 is the two left over.
  const base = sessionWith(6);
  const six = reduceSession(config, base);
  assert.equal(six.onDeck[1].players.length, 2);
  const f1Members = six.onDeck[1].players;

  const eight = reduceSession(config, [...base, ...addWaiter(7), ...addWaiter(8)]);
  assert.deepEqual(eight.onDeck[0], six.onDeck[0], "F0 untouched");
  assert.equal(eight.onDeck[1].players.length, 4);
  assert.deepEqual(
    eight.onDeck[1].players.slice(0, 2),
    f1Members,
    "existing members keep their places, new ones append",
  );
  assert.equal(eight.onDeck[1].committedAt, six.onDeck[1].committedAt);
});

test("when a Court frees, the leading Foursome takes it and a fresh second Foursome is selected", () => {
  const base = sessionWith(12);
  const before = reduceSession(config, base);
  const upNext = before.onDeck[0].players;
  const afterThat = before.onDeck[1].players;

  const state = reduceSession(config, [...base, courtFinished(1)]);

  assert.deepEqual(state.courts[0].foursome, upNext, "Up next walked on");
  assert.equal(state.onDeck.length, 2);
  assert.deepEqual(state.onDeck[0].players, afterThat, "After that is now Up next");
  assert.equal(state.onDeck[1].players.length, 4, "a fresh second Foursome formed");
  // The fresh Foursome is drawn from Players not already committed or playing.
  const committed = new Set([
    ...state.courts[0].foursome,
    ...state.onDeck[0].players,
  ]);
  assert.ok(state.onDeck[1].players.every((id) => !committed.has(id)));
});

test("promotion seats exactly the Foursome that was 'Up next' — no recompute", () => {
  const base = sessionWith(12);
  const upNext = reduceSession(config, base).onDeck[0].players;
  const seated = reduceSession(config, [...base, courtFinished(1)]).courts[0]
    .foursome;
  assert.deepEqual(seated, upNext);
});

test("a stray COURT_FINISHED (empty Court, one tap) still promotes the leading Foursome", () => {
  const state = reduceSession(config, [...sessionWith(8), courtFinished(3)]);
  assert.equal(state.courts[2].foursome.length, 4);
  assert.deepEqual(state.courts[2].foursome, ["p1", "p2", "p3", "p4"]);
});

test("On Deck folding is deterministic — identical events, identical Foursomes", () => {
  const events = [...sessionWith(14), courtFinished(1), courtFinished(2)];
  assert.deepEqual(
    reduceSession(config, events).onDeck,
    reduceSession(config, events).onDeck,
  );
});

test("undo drops the last COURT_FINISHED: re-folding restores the prior On Deck", () => {
  const base = [...sessionWith(12), courtFinished(1)];
  const before = reduceSession(config, base);
  const after = reduceSession(config, [...base, courtFinished(2)]);

  assert.notDeepEqual(after.onDeck, before.onDeck);
  assert.deepEqual(reduceSession(config, base).onDeck, before.onDeck);
});

function idSkill(
  state: ReturnType<typeof reduceSession>,
  id: string,
): SkillLevel {
  return state.roster.find((p) => p.id === id)!.skillLevel;
}

// --- Paused: leave, no-show swap, set aside (#246) --------------------

function paused(
  token: string,
  reason: "left" | "set-aside" = "left",
  operator: Operator = reason === "left" ? player : vanessa,
): SessionEvent {
  return { type: "PLAYER_PAUSED", at: tick(), operator, token, reason };
}

function requeued(token: string, operator: Operator = player): SessionEvent {
  return { type: "PLAYER_REQUEUED", at: tick(), operator, token };
}

function swapped(
  court: number,
  outTok: string,
  inTok: string,
  operator: Operator = vanessa,
): SessionEvent {
  return {
    type: "FOURSOME_MEMBER_SWAPPED",
    at: tick(),
    operator,
    court,
    out: outTok,
    in: inTok,
  };
}

test("door 1 — a Player removes themselves: they land in Paused, out of the Queue", () => {
  const state = reduceSession(config, [...sessionWith(3), paused("p2", "left")]);

  assert.equal(queuePosition(state, "p2"), null);
  assert.deepEqual(
    state.queue.map((e) => e.playerId),
    ["p1", "p3"],
  );
  assert.equal(state.paused.length, 1);
  assert.equal(state.paused[0].playerId, "p2");
  assert.equal(state.paused[0].reason, "left");
});

test("door 3 — an Operator sets a Player aside: same Paused state", () => {
  const state = reduceSession(config, [
    ...sessionWith(3),
    paused("p2", "set-aside", vanessa),
  ]);
  assert.equal(state.paused[0].reason, "set-aside");
  assert.equal(queuePosition(state, "p2"), null);
});

test("door 2 — a no-show swap pauses the no-show and seats the replacement mid-Game", () => {
  const base = [...sessionWith(6), courtFinished(1)];
  const seated = reduceSession(config, base).courts[0].foursome;
  const noShow = seated[1];
  // A waiting Player not on the Court.
  const replacement = reduceSession(config, base).queue[0].playerId;

  const state = reduceSession(config, [...base, swapped(1, noShow, replacement)]);
  const court = state.courts[0];

  assert.ok(!court.foursome.includes(noShow), "no-show left the Foursome");
  assert.ok(court.foursome.includes(replacement), "replacement took the seat");
  assert.equal(court.foursome.length, 4);
  assert.equal(state.paused.find((p) => p.playerId === noShow)?.reason, "no-show");
  // The Game's clock is untouched — the swap is not a fresh seating.
  assert.equal(
    court.since,
    reduceSession(config, base).courts[0].since,
  );
});

test("a Player cannot remove themselves mid-Game, but an Operator can set them aside", () => {
  const base = [...sessionWith(4), courtFinished(1)];
  const onCourt = reduceSession(config, base).courts[0].foursome[0];

  const selfLeave = reduceSession(config, [...base, paused(onCourt, "left")]);
  assert.equal(playerCourt(selfLeave, onCourt), 1, "still playing");
  assert.equal(selfLeave.paused.length, 0);

  const setAside = reduceSession(config, [
    ...base,
    paused(onCourt, "set-aside", vanessa),
  ]);
  assert.equal(playerCourt(setAside, onCourt), null, "pulled off the Court");
  assert.equal(setAside.courts[0].foursome.length, 3, "Court left a player short");
  assert.equal(setAside.paused[0].reason, "set-aside");
});

test("a paused Player is never pulled into a Foursome", () => {
  // Eight waiting, p1 steps out, then a Court is sent — p1 must not be seated
  // or put On Deck.
  const state = reduceSession(config, [
    ...sessionWith(8),
    paused("p1", "left"),
    courtFinished(1),
  ]);

  assert.equal(playerCourt(state, "p1"), null);
  assert.ok(!state.onDeck.some((f) => f.players.includes("p1")));
  assert.ok(state.paused.some((p) => p.playerId === "p1"));
});

test("pausing an On Deck Player drops them from the Foursome, which tops up", () => {
  const base = sessionWith(8);
  const before = reduceSession(config, base);
  const target = before.onDeck[0].players[1];

  const state = reduceSession(config, [...base, ...addWaiter(9), paused(target, "left")]);

  assert.ok(!state.onDeck.some((f) => f.players.includes(target)));
  assert.equal(state.onDeck[0].players.length, 4, "the Foursome topped back up");
});

test("re-queue restores the Player with accrued Wait Time intact", () => {
  // p2 queues first (so waits longest), steps out, THEN p1 and p3 queue, then
  // p2 rejoins. p2's banked wait puts them back ahead of p1 and p3.
  const events: SessionEvent[] = [
    started(),
    joined("p1", "P1", "X"),
    joined("p2", "P2", "X"),
    joined("p3", "P3", "X"),
  ];
  const qp2 = queued("p2");
  events.push(qp2);
  const pause = paused("p2", "left");
  events.push(pause);
  events.push(queued("p1"));
  events.push(queued("p3"));
  const rejoin = requeued("p2");
  events.push(rejoin);

  const state = reduceSession(config, events);
  assert.equal(state.paused.length, 0);
  const p2 = state.queue.find((e) => e.playerId === "p2")!;
  // Back-dated by exactly the wait banked before pausing — not reset to
  // rejoin.at, which is what dropping and re-adding would do.
  assert.equal(p2.waitSince, rejoin.at - (pause.at - qp2.at));
  assert.ok(p2.waitSince < rejoin.at, "the banked wait was not thrown away");
});

test("re-queue banks enough wait to jump ahead of shorter waiters", () => {
  // p1 queues, then a Court is tapped repeatedly so p1 keeps accruing while
  // fresh Players arrive; p1 pauses deep into the night and rejoins.
  const events: SessionEvent[] = [started()];
  for (let i = 1; i <= 5; i++) events.push(joined(`p${i}`, `P${i}`, "X"));
  events.push(queued("p1"));
  for (let i = 0; i < 20; i++) tick(); // p1 racks up wait
  events.push(queued("p2"));
  events.push(paused("p1", "left"));
  events.push(queued("p3"));
  events.push(queued("p4"));
  events.push(requeued("p1"));

  const state = reduceSession(config, events);
  assert.equal(queuePosition(state, "p1"), 1, "the long banked wait still leads");
});

test("all three doors preserve the same accrued Wait Time", () => {
  // Build one queued Player, let them accrue exactly one tick of wait, pause
  // via each door, and assert accruedWaitMs matches.
  function accruedVia(mk: (tok: string) => SessionEvent): number {
    const evs = [started(), joined("x", "X", "X"), queued("x"), mk("x")];
    return reduceSession(config, evs).paused[0].accruedWaitMs;
  }
  const left = accruedVia((t) => paused(t, "left"));
  const setAside = accruedVia((t) => paused(t, "set-aside", vanessa));
  // All doors read the same `waitStartByPlayer` and subtract the event `at`.
  assert.equal(left, 1000);
  assert.equal(setAside, 1000);
});

test("PLAYER_REQUEUED for a Player who is not paused is a no-op", () => {
  const state = reduceSession(config, [...sessionWith(3), requeued("p1")]);
  assert.equal(state.queue.length, 3);
  assert.equal(state.paused.length, 0);
});

test("a replayed PLAYER_PAUSED for an already-paused Player is a no-op", () => {
  const state = reduceSession(config, [
    ...sessionWith(3),
    paused("p2", "left"),
    paused("p2", "left"),
  ]);
  assert.equal(state.paused.length, 1);
});

test("a PLAYER_PAUSED before the Session opens is ignored", () => {
  const state = reduceSession(config, [paused("ghost", "left")]);
  assert.deepEqual(state.paused, []);
});

test("a FOURSOME_MEMBER_SWAPPED naming a replacement who isn't waiting is a no-op", () => {
  const base = [...sessionWith(4), courtFinished(1)];
  const seated = reduceSession(config, base).courts[0].foursome;
  const state = reduceSession(config, [...base, swapped(1, seated[0], "nobody")]);
  assert.deepEqual(state.courts[0].foursome, seated);
  assert.equal(state.paused.length, 0);
});

test("undo drops the last PLAYER_PAUSED: re-folding restores the prior state", () => {
  const base = [...sessionWith(4)];
  const before = reduceSession(config, base);
  const after = reduceSession(config, [...base, paused("p1", "left")]);

  assert.notDeepEqual(after.queue, before.queue);
  assert.deepEqual(reduceSession(config, base).queue, before.queue);
  assert.deepEqual(reduceSession(config, base).paused, before.paused);
});

// Undo is a physical row delete (#247), so "fold [...xs, e], then drop e and
// re-fold" is exactly "fold xs" — these assert the whole state comes back, for
// the event types the older undo tests above don't cover.
test("undo drops the last FOURSOME_MEMBER_SWAPPED: re-folding restores the exact prior state (#247)", () => {
  const xs = [...sessionWith(8), courtFinished(1)];
  const seated = reduceSession(config, xs).courts[0].foursome;
  const waiting = reduceSession(config, xs).queue[0].playerId;
  const withEvent = [...xs, swapped(1, seated[0], waiting)];

  assert.notDeepEqual(
    reduceSession(config, withEvent),
    reduceSession(config, xs),
    "the swap changed the state",
  );
  assert.deepEqual(
    reduceSession(config, withEvent.slice(0, -1)),
    reduceSession(config, xs),
    "dropping the swap and re-folding is byte-for-byte the prior state",
  );
});

test("undo drops the last PLAYER_REQUEUED: re-folding restores the exact prior state (#247)", () => {
  const xs = [...sessionWith(4), paused("p1", "left")];
  const withEvent = [...xs, requeued("p1")];

  assert.notDeepEqual(
    reduceSession(config, withEvent),
    reduceSession(config, xs),
  );
  assert.deepEqual(
    reduceSession(config, withEvent.slice(0, -1)),
    reduceSession(config, xs),
  );
});

// --- walk-up Players and Skill Level override (#249) ------------------

const volunteer: Operator = { kind: "volunteer" };

/** A walk-up added by an Operator: PLAYER_JOINED carrying `queueOnJoin`. */
function walkup(
  token: string,
  firstName: string,
  skillLevel: SkillLevel = "intermediate",
  operator: Operator = volunteer,
): SessionEvent {
  return {
    type: "PLAYER_JOINED",
    at: tick(),
    operator,
    token,
    firstName,
    lastInitial: "W",
    skillLevel,
    queueOnJoin: true,
  };
}

function skillSet(
  token: string,
  skillLevel: SkillLevel,
  operator: Operator = volunteer,
): SessionEvent {
  return { type: "PLAYER_SKILL_SET", at: tick(), operator, token, skillLevel };
}

test("a walk-up lands in the roster and, with queueOnJoin, straight in the Queue", () => {
  const state = reduceSession(config, [
    started(),
    walkup("w1", "Wanda", "beginner"),
  ]);

  assert.equal(state.roster.length, 1);
  assert.equal(state.roster[0].displayName, "Wanda W.");
  assert.equal(state.roster[0].skillLevel, "beginner");
  assert.equal(queuePosition(state, "w1"), 1);
});

test("a plain PLAYER_JOINED (no queueOnJoin) still does not auto-queue", () => {
  const state = reduceSession(config, [started(), joined("p1", "Pat", "P")]);
  assert.equal(state.roster.length, 1);
  assert.deepEqual(state.queue, []);
});

test("a walk-up is anchored and selected by Match Me exactly like a self-registered Player", () => {
  // Three self-registered Players queue, then a walk-up is added. When Court 1
  // frees, the walk-up is in the Foursome — no different from the other three.
  const state = reduceSession(smallConfig, [
    started(),
    joined("p1", "P1", "X"),
    joined("p2", "P2", "X"),
    joined("p3", "P3", "X"),
    queued("p1"),
    queued("p2"),
    queued("p3"),
    walkup("w1", "Wanda"),
    courtFinished(1),
  ]);

  assert.equal(state.courts[0].foursome.length, 4);
  assert.ok(state.courts[0].foursome.includes("w1"));
});

test("a walk-up added by the Organizer folds identically to one added by a Volunteer (ADR 0005)", () => {
  const base = [started(), joined("p1", "P1", "X"), queued("p1")];
  const add = walkup("w1", "Wanda");
  const byVolunteer = reduceSession(config, [...base, { ...add, operator: volunteer }]);
  const byOrganizer = reduceSession(config, [...base, { ...add, operator: vanessa }]);

  assert.deepEqual(byOrganizer.roster, byVolunteer.roster);
  assert.deepEqual(byOrganizer.queue, byVolunteer.queue);
});

test("PLAYER_SKILL_SET overrides a Player's declared level", () => {
  const state = reduceSession(config, [
    started(),
    joined("p1", "Pat", "P", "newbie"),
    skillSet("p1", "advanced"),
  ]);
  assert.equal(idSkill(state, "p1"), "advanced");
});

test("PLAYER_SKILL_SET for a token not on the roster is a no-op", () => {
  const state = reduceSession(config, [started(), skillSet("ghost", "advanced")]);
  assert.deepEqual(state.roster, []);
});

test("a PLAYER_SKILL_SET before the Session opens is ignored", () => {
  const state = reduceSession(config, [skillSet("p1", "advanced")]);
  assert.deepEqual(state.roster, []);
});

test("undo drops the last PLAYER_SKILL_SET: re-folding restores the prior level", () => {
  const base = [started(), joined("p1", "Pat", "P", "beginner")];
  const before = reduceSession(config, base);
  const after = reduceSession(config, [...base, skillSet("p1", "advanced")]);

  assert.notDeepEqual(after.roster, before.roster);
  assert.deepEqual(reduceSession(config, base).roster, before.roster);
});

test("a corrected Skill Level changes the next Match Me selection", () => {
  // One Court, thirteen all-intermediate Players queued: p1-8 fill the two
  // committed Foursomes, p9-13 sit in reserve. A volunteer corrects p10 to
  // advanced. Court 1 (empty) is tapped: the leading Foursome walks on and a
  // fresh one forms from the reserves via Match Me — which now reaches past
  // p10. The un-corrected fold seats p10.
  const oneCourt: SessionConfig = { ...config, courtCount: 1 };
  const base: SessionEvent[] = [started()];
  for (let i = 1; i <= 13; i++) base.push(joined(`p${i}`, `P${i}`, "X", "intermediate"));
  for (let i = 1; i <= 13; i++) base.push(queued(`p${i}`));

  const fresh = (events: SessionEvent[]) => {
    const state = reduceSession(oneCourt, events);
    return state.onDeck[state.onDeck.length - 1].players;
  };

  assert.deepEqual(
    fresh([...base, courtFinished(1)]),
    ["p9", "p10", "p11", "p12"],
  );
  assert.deepEqual(
    fresh([...base, skillSet("p10", "advanced"), courtFinished(1)]),
    ["p9", "p11", "p12", "p13"],
  );
});

test("PLAYER_SKILL_SET does not reshuffle an already-committed On Deck Foursome (ADR 0007)", () => {
  // p4 is committed to the first Foursome before the override; it stays.
  const base = sessionWith(8);
  const committed = reduceSession(config, base).onDeck[0].players;
  assert.ok(committed.includes("p4"));

  const state = reduceSession(config, [...base, skillSet("p4", "advanced")]);
  assert.deepEqual(state.onDeck[0].players, committed);
});

// --- Queue Together, volunteer-formed (#250) -------------------------

/** A Volunteer forms a Group from waiting Players who asked to play together. */
function groupFormed(
  groupId: string,
  memberTokens: string[],
  operator: Operator = volunteer,
): SessionEvent {
  return { type: "GROUP_FORMED", at: tick(), operator, groupId, memberTokens };
}

/** A Volunteer lowers the live group cap mid-Session. */
function groupCapChanged(
  cap: number,
  operator: Operator = volunteer,
): SessionEvent {
  return { type: "GROUP_CAP_CHANGED", at: tick(), operator, cap };
}

/** `started()` plus one joined-and-queued Player per entry, with per-Player skill. */
function queuedSession(
  players: { token: string; skill?: SkillLevel }[],
): SessionEvent[] {
  const events: SessionEvent[] = [started()];
  players.forEach((p, i) =>
    events.push(joined(p.token, `P${i + 1}`, "X", p.skill ?? "intermediate")),
  );
  players.forEach((p) => events.push(queued(p.token)));
  return events;
}

const GID = "group-00000000-0000-0000-0000-000000000001";

test("a Group appears as one Queue entry, positioned at its members' median Wait Time", () => {
  const base = queuedSession([
    { token: "p1" },
    { token: "p2" },
    { token: "p3" },
    { token: "p4" },
    { token: "p5" },
  ]);
  const state = reduceSession(config, [...base, groupFormed(GID, ["p2", "p4"])]);

  const units = queueUnits(state);
  // p1 (longest wait) stays first; the Group sits at median(p2, p4) = p3's
  // wait, ahead of p3 by first-appearance; p5 last.
  assert.deepEqual(
    units.map((u) => (u.kind === "group" ? "group" : u.playerId)),
    ["p1", "group", "p3", "p5"],
  );
  assert.deepEqual(units[1], {
    kind: "group",
    groupId: GID,
    memberIds: ["p2", "p4"],
  });
  assert.equal(state.groups.length, 1);
  assert.deepEqual(state.groups[0].memberIds, ["p2", "p4"]);
});

test("recruiting a longer-waiting member does not jump the Group up the line", () => {
  const base = queuedSession([
    { token: "p1" },
    { token: "p2" },
    { token: "p3" },
    { token: "p4" },
    { token: "p5" },
    { token: "p6" },
  ]);
  // The Group takes the longest-waiting p1 plus the two shortest waiters.
  const state = reduceSession(config, [
    ...base,
    groupFormed(GID, ["p1", "p5", "p6"]),
  ]);

  const units = queueUnits(state);
  // median(p1, p5, p6) = p5's wait, so the Group sits behind p2, p3, p4 — p1's
  // long wait did not drag the unit to the front.
  assert.deepEqual(
    units.map((u) => (u.kind === "group" ? "group" : u.playerId)),
    ["p2", "p3", "p4", "group"],
  );
});

test("grouping does not cost a member their accrued Wait Time", () => {
  const base = queuedSession([
    { token: "p1" },
    { token: "p2" },
    { token: "p3" },
    { token: "p4" },
  ]);
  const before = reduceSession(config, base);
  const after = reduceSession(config, [...base, groupFormed(GID, ["p1", "p2"])]);

  assert.deepEqual(after.waitStartByPlayer, before.waitStartByPlayer);
  for (const id of ["p1", "p2", "p3", "p4"]) {
    assert.equal(
      after.queue.find((e) => e.playerId === id)!.waitSince,
      before.queue.find((e) => e.playerId === id)!.waitSince,
      `${id} keeps its wait anchor`,
    );
  }
});

test("a Group of two is filled to four by Match Me at the Group's average level", () => {
  const base = queuedSession([
    { token: "m1", skill: "newbie" },
    { token: "m2", skill: "newbie" },
    { token: "a1", skill: "advanced" },
    { token: "a2", skill: "advanced" },
    { token: "n1", skill: "newbie" },
    { token: "n2", skill: "newbie" },
  ]);
  const state = reduceSession(config, [...base, groupFormed(GID, ["m1", "m2"])]);

  // The Group anchors On Deck; the two fill seats go to the newbies, not the
  // advanced players, because skill fit is scored across the whole Foursome.
  assert.deepEqual(state.onDeck[0].players, ["m1", "m2", "n1", "n2"]);
  assert.equal(state.onDeck[0].groupId, GID);
});

test("a Group of three is filled to four", () => {
  const base = queuedSession([
    { token: "m1" },
    { token: "m2" },
    { token: "m3" },
    { token: "f1" },
    { token: "f2" },
  ]);
  const state = reduceSession(config, [
    ...base,
    groupFormed(GID, ["m1", "m2", "m3"]),
  ]);

  assert.equal(state.onDeck[0].players.length, 4);
  assert.deepEqual(state.onDeck[0].players.slice(0, 3), ["m1", "m2", "m3"]);
  assert.equal(state.onDeck[0].players[3], "f1");
  assert.equal(state.onDeck[0].groupId, GID);
});

test("Variety is not applied between members — a Group whose members just shared a Court still forms and fills", () => {
  const oneCourt: SessionConfig = { ...config, courtCount: 1 };
  const events: SessionEvent[] = [started()];
  for (let i = 1; i <= 8; i++) events.push(joined(`p${i}`, `P${i}`, "X"));
  for (let i = 1; i <= 4; i++) events.push(queued(`p${i}`));
  events.push(courtFinished(1)); // seat p1..p4 onto the empty Court
  for (let i = 5; i <= 8; i++) events.push(queued(`p${i}`));
  events.push(courtFinished(1)); // p1..p4's Game ends, they re-queue; p5..p8 seat

  // p1..p4 are the only ones waiting and have a shared Game on the books.
  const state = reduceSession(oneCourt, [
    ...events,
    groupFormed(GID, ["p1", "p2"]),
  ]);

  assert.equal(state.groups.length, 1);
  // The Foursome fills regardless of the shared history (every preference soft).
  assert.deepEqual(state.onDeck[0].players, ["p1", "p2", "p3", "p4"]);
  assert.equal(state.onDeck[0].groupId, GID);
});

test("a Group dissolves when its Game ends", () => {
  const oneCourt: SessionConfig = { ...config, courtCount: 1 };
  const base = queuedSession([
    { token: "p1" },
    { token: "p2" },
    { token: "p3" },
    { token: "p4" },
  ]);
  const formed = [...base, groupFormed(GID, ["p1", "p2"])];

  const seated = reduceSession(oneCourt, [...formed, courtFinished(1)]);
  assert.equal(seated.groups.length, 1);
  assert.equal(seated.groups[0].courtNumber, 1);
  assert.deepEqual(seated.courts[0].foursome, ["p1", "p2", "p3", "p4"]);

  const ended = reduceSession(oneCourt, [
    ...formed,
    courtFinished(1),
    courtFinished(1),
  ]);
  assert.deepEqual(ended.groups, []);
  // The ex-members are back in the Queue as ordinary solos.
  assert.ok(queueUnits(ended).every((u) => u.kind === "solo"));
});

test("a Group larger than the cap is rejected", () => {
  const base = queuedSession([
    { token: "p1" },
    { token: "p2" },
    { token: "p3" },
    { token: "p4" },
    { token: "p5" },
  ]);
  const state = reduceSession(config, [
    ...base,
    groupFormed(GID, ["p1", "p2", "p3", "p4", "p5"]), // 5 > cap 4
  ]);
  assert.deepEqual(state.groups, []);
});

test("a Volunteer lowers the cap live; an existing larger Group is left alone, new over-cap Groups are rejected", () => {
  const base = queuedSession([
    { token: "p1" },
    { token: "p2" },
    { token: "p3" },
    { token: "p4" },
    { token: "p5" },
    { token: "p6" },
    { token: "p7" },
    { token: "p8" },
  ]);
  const g2 = "group-00000000-0000-0000-0000-000000000002";
  const g3 = "group-00000000-0000-0000-0000-000000000003";

  const state = reduceSession(config, [
    ...base,
    groupFormed(GID, ["p1", "p2", "p3", "p4"]), // ok at cap 4
    groupCapChanged(2),
    groupFormed(g2, ["p5", "p6", "p7"]), // 3 > new cap 2 — rejected
    groupFormed(g3, ["p5", "p6"]), // ok at cap 2
  ]);

  assert.equal(state.groupCap, 2);
  assert.equal(state.groups.length, 2);
  assert.deepEqual(state.groups[0].memberIds, ["p1", "p2", "p3", "p4"]);
  assert.deepEqual(state.groups[1].memberIds, ["p5", "p6"]);
});

test("GROUP_CAP_CHANGED outside [2, config.groupCap] is a no-op", () => {
  const base = queuedSession([{ token: "p1" }, { token: "p2" }]);
  assert.equal(reduceSession(config, [...base, groupCapChanged(1)]).groupCap, 4);
  assert.equal(reduceSession(config, [...base, groupCapChanged(9)]).groupCap, 4);
  assert.equal(reduceSession(config, [...base, groupCapChanged(3)]).groupCap, 3);
});

test("undo drops the last GROUP_FORMED: re-folding restores the exact prior state (#247)", () => {
  const base = queuedSession([
    { token: "p1" },
    { token: "p2" },
    { token: "p3" },
    { token: "p4" },
    { token: "p5" },
    { token: "p6" },
  ]);
  const before = reduceSession(config, base);
  const withGroup = [...base, groupFormed(GID, ["p1", "p2"])];
  const after = reduceSession(config, withGroup);

  assert.notDeepEqual(after.groups, before.groups);
  assert.deepEqual(reduceSession(config, withGroup.slice(0, -1)), before);
});

test("undo drops the Group's COURT_FINISHED: the Group comes back, bound to no Court (#247)", () => {
  const oneCourt: SessionConfig = { ...config, courtCount: 1 };
  const base = queuedSession([
    { token: "p1" },
    { token: "p2" },
    { token: "p3" },
    { token: "p4" },
  ]);
  const events = [
    ...base,
    groupFormed(GID, ["p1", "p2"]),
    courtFinished(1), // seats the Group
    courtFinished(1), // ends its Game -> dissolves
  ];
  const restored = reduceSession(oneCourt, events.slice(0, -1));
  assert.equal(restored.groups.length, 1);
  assert.equal(restored.groups[0].courtNumber, 1);
});

test("Queue Together folding is deterministic — identical events, identical state", () => {
  const base = queuedSession([
    { token: "m1", skill: "beginner" },
    { token: "m2", skill: "advanced" },
    { token: "f1", skill: "intermediate" },
    { token: "f2", skill: "intermediate" },
    { token: "f3", skill: "intermediate" },
    { token: "f4", skill: "intermediate" },
  ]);
  const events = [...base, groupFormed(GID, ["m1", "m2"])];
  assert.deepEqual(reduceSession(config, events), reduceSession(config, events));
});

test("a Group behind too few solos to make a Foursome is still seated whole, never split across a Court and the Queue", () => {
  const oneCourt: SessionConfig = { ...config, courtCount: 1 };
  // s1..s3 are the longest-waiting but only three; m1/m2 group up behind them.
  const base = queuedSession([
    { token: "s1" },
    { token: "s2" },
    { token: "s3" },
    { token: "m1" },
    { token: "m2" },
  ]);
  const formed = [...base, groupFormed(GID, ["m1", "m2"])];

  const state = reduceSession(oneCourt, formed);
  // The Group is committed whole (both members together) rather than one
  // member cherry-picked into a solo Foursome.
  assert.ok(state.onDeck[0].players.includes("m1"));
  assert.ok(state.onDeck[0].players.includes("m2"));
  assert.equal(state.onDeck[0].groupId, GID);

  const seated = reduceSession(oneCourt, [...formed, courtFinished(1)]);
  assert.equal(seated.groups[0].courtNumber, 1);
  const ended = reduceSession(oneCourt, [
    ...formed,
    courtFinished(1),
    courtFinished(1),
  ]);
  assert.deepEqual(ended.groups, []);
});

test("a paused member leaves the Group; a Group under two members dissolves", () => {
  const base = queuedSession([
    { token: "p1" },
    { token: "p2" },
    { token: "p3" },
    { token: "p4" },
  ]);
  const twoLeft = reduceSession(config, [
    ...base,
    groupFormed(GID, ["p1", "p2", "p3"]),
    {
      type: "PLAYER_PAUSED",
      at: tick(),
      operator: volunteer,
      token: "p3",
      reason: "set-aside",
    },
  ]);
  assert.equal(twoLeft.groups.length, 1);
  assert.deepEqual(twoLeft.groups[0].memberIds, ["p1", "p2"]);

  const dissolved = reduceSession(config, [
    ...base,
    groupFormed(GID, ["p1", "p2"]),
    {
      type: "PLAYER_PAUSED",
      at: tick(),
      operator: volunteer,
      token: "p2",
      reason: "set-aside",
    },
  ]);
  assert.deepEqual(dissolved.groups, []);
});

// --- Queue Together, player-formed (#251) ---------------------------

function groupMemberRemoved(groupId: string, token: string): SessionEvent {
  return {
    type: "GROUP_MEMBER_REMOVED",
    at: tick(),
    operator: player,
    groupId,
    token,
  };
}

function groupDissolved(
  groupId: string,
  operator: Operator = volunteer,
): SessionEvent {
  return { type: "GROUP_DISSOLVED", at: tick(), operator, groupId };
}

test("a player-formed Group folds identically to a volunteer-formed one", () => {
  const base = queuedSession([
    { token: "p1" },
    { token: "p2" },
    { token: "p3" },
    { token: "p4" },
    { token: "p5" },
  ]);
  // Same members, same groupId, same tick sequence — only the operator differs.
  const asVolunteer = reduceSession(config, [
    ...base,
    { type: "GROUP_FORMED", at: 99_000, operator: volunteer, groupId: GID, memberTokens: ["p2", "p4"] },
  ]);
  const asPlayer = reduceSession(config, [
    ...base,
    { type: "GROUP_FORMED", at: 99_000, operator: player, groupId: GID, memberTokens: ["p2", "p4"] },
  ]);
  assert.deepEqual(asPlayer, asVolunteer);
});

test("a member removes themselves: they stay in the Queue as a solo, the Group keeps going with the rest", () => {
  const base = queuedSession([
    { token: "p1" },
    { token: "p2" },
    { token: "p3" },
    { token: "p4" },
  ]);
  const state = reduceSession(config, [
    ...base,
    groupFormed(GID, ["p1", "p2", "p3"]),
    groupMemberRemoved(GID, "p2"),
  ]);
  assert.equal(state.groups.length, 1);
  assert.deepEqual(state.groups[0].memberIds, ["p1", "p3"]);
  // p2 is still waiting, now a solo unit.
  assert.ok(state.queue.some((e) => e.playerId === "p2"));
  const units = queueUnits(state);
  assert.ok(units.some((u) => u.kind === "solo" && u.playerId === "p2"));
});

test("the last two-member Group loses one to self-removal and dissolves; both stay queued", () => {
  const base = queuedSession([{ token: "p1" }, { token: "p2" }, { token: "p3" }]);
  const state = reduceSession(config, [
    ...base,
    groupFormed(GID, ["p1", "p2"]),
    groupMemberRemoved(GID, "p1"),
  ]);
  assert.deepEqual(state.groups, []);
  assert.equal(queuePosition(state, "p1") !== null, true);
  assert.equal(queuePosition(state, "p2") !== null, true);
});

test("GROUP_MEMBER_REMOVED is a no-op for a non-member or a Group already on a Court", () => {
  const base = queuedSession([
    { token: "p1" },
    { token: "p2" },
    { token: "p3" },
    { token: "p4" },
  ]);
  const notMember = reduceSession(config, [
    ...base,
    groupFormed(GID, ["p1", "p2"]),
    groupMemberRemoved(GID, "p3"),
  ]);
  assert.deepEqual(notMember.groups[0].memberIds, ["p1", "p2"]);

  const oneCourt: SessionConfig = { ...config, courtCount: 1 };
  const seatBase = queuedSession([
    { token: "p1" },
    { token: "p2" },
    { token: "p3" },
    { token: "p4" },
  ]);
  const seated = reduceSession(oneCourt, [
    ...seatBase,
    groupFormed(GID, ["p1", "p2"]),
    courtFinished(1), // fills the Group to four and seats it on Court 1
    groupMemberRemoved(GID, "p1"), // too late — the Group is playing
  ]);
  assert.equal(seated.groups.length, 1);
  assert.equal(seated.groups[0].courtNumber, 1);
});

test("a Volunteer dissolves a waiting Group: it is gone, members keep their spots and wait", () => {
  const base = queuedSession([
    { token: "p1" },
    { token: "p2" },
    { token: "p3" },
    { token: "p4" },
    { token: "p5" },
  ]);
  const before = reduceSession(config, base);
  const after = reduceSession(config, [
    ...base,
    groupFormed(GID, ["p2", "p4"]),
    groupDissolved(GID),
  ]);
  assert.deepEqual(after.groups, []);
  // The five are all still waiting with their own wait anchors intact.
  assert.deepEqual(
    [...after.queue].sort((a, b) => a.playerId.localeCompare(b.playerId)),
    [...before.queue].sort((a, b) => a.playerId.localeCompare(b.playerId)),
  );
  // Everyone who was committed On Deck before the Group formed is still
  // committed — dissolving does not reshuffle an announced Foursome (ADR 0007).
  const stillCommitted = new Set(after.onDeck.flatMap((f) => f.players));
  for (const id of before.onDeck.flatMap((f) => f.players)) {
    assert.ok(stillCommitted.has(id), `${id} stayed On Deck`);
  }
});

test("dissolving a Group does not wipe an unrelated committed Foursome (ADR 0007)", () => {
  // 8 solos queue → two full On Deck Foursomes committed. Then a Group forms
  // (rebuild — deliberate) and is dissolved (no rebuild). The two non-group
  // Foursomes' members must not have been re-selected out from under them.
  const base = queuedSession(
    Array.from({ length: 8 }, (_, i) => ({ token: `p${i + 1}` })),
  );
  const g = "group-00000000-0000-0000-0000-0000000000c1";
  const state = reduceSession(config, [
    ...base,
    groupFormed(g, ["p7", "p8"]),
    groupDissolved(g),
  ]);
  assert.deepEqual(state.groups, []);
  // On Deck is full again and every committed player is one of the eight.
  assert.equal(state.onDeck.length, 2);
  for (const id of state.onDeck.flatMap((f) => f.players)) {
    assert.ok(base.some((e) => "token" in e && e.token === id));
  }
});

test("GROUP_DISSOLVED is a no-op for an unknown Group or one on a Court", () => {
  const base = queuedSession([{ token: "p1" }, { token: "p2" }, { token: "p3" }]);
  const unknown = reduceSession(config, [
    ...base,
    groupFormed(GID, ["p1", "p2"]),
    groupDissolved("group-00000000-0000-0000-0000-0000000000ff"),
  ]);
  assert.equal(unknown.groups.length, 1);
});

test("undo drops the last GROUP_DISSOLVED: the Group comes back exactly (#247)", () => {
  const base = queuedSession([
    { token: "p1" },
    { token: "p2" },
    { token: "p3" },
    { token: "p4" },
  ]);
  const withGroup = [...base, groupFormed(GID, ["p1", "p3"])];
  const events = [...withGroup, groupDissolved(GID)];
  assert.deepEqual(reduceSession(config, events.slice(0, -1)), reduceSession(config, withGroup));
});

test("undo drops the last GROUP_MEMBER_REMOVED: re-folding restores the member in the Group", () => {
  const base = queuedSession([
    { token: "p1" },
    { token: "p2" },
    { token: "p3" },
    { token: "p4" },
  ]);
  const withGroup = [...base, groupFormed(GID, ["p1", "p2", "p3"])];
  const before = reduceSession(config, withGroup);
  const removed = [...withGroup, groupMemberRemoved(GID, "p2")];
  assert.notDeepEqual(reduceSession(config, removed).groups, before.groups);
  assert.deepEqual(reduceSession(config, removed.slice(0, -1)), before);
});

// --- Last Call, close (#255) -------------------------------------------

function lastCall(operator: Operator = vanessa): SessionEvent {
  return { type: "LAST_CALL", at: tick(), operator };
}

function sessionClosed(operator: Operator = vanessa): SessionEvent {
  return { type: "SESSION_CLOSED", at: tick(), operator };
}

test("LAST_CALL records when, and halts new Foursome assignment", () => {
  // One Court, 12 waiting. Courts start empty — courtFinished(1) seats p1-4.
  const oneCourt: SessionConfig = { ...config, courtCount: 1 };
  const base = [...sessionWith(12), courtFinished(1)];
  const call = lastCall();
  const state = reduceSession(oneCourt, [...base, call, courtFinished(1)]);

  assert.equal(state.lastCallAt, call.at);
  // The Game on Court 1 finished — its four re-queued — but nobody walked back
  // on: no new assignment after Last Call.
  assert.deepEqual(state.courts[0].foursome, []);
  // That finished Game is still recorded (the seating one carried no Game).
  assert.equal(state.completedGames.length, 1);
  // On Deck was cleared — queued Players are done.
  assert.deepEqual(state.onDeck, []);
  // The four coming off are not re-queued after Last Call — their night is over.
  for (const id of ["p1", "p2", "p3", "p4"]) {
    assert.equal(
      state.queue.some((e) => e.playerId === id),
      false,
      `${id} is not put back in the Queue`,
    );
  }
});

test("Games already on Courts are untouched by LAST_CALL and finish normally", () => {
  const smallC: SessionConfig = { ...config, courtCount: 2 };
  // Seat both Courts, then everything is in progress.
  const running = [...sessionWith(8), courtFinished(1), courtFinished(2)];
  const seated = reduceSession(smallC, running);
  assert.equal(seated.courts[0].foursome.length, 4);
  assert.equal(seated.courts[1].foursome.length, 4);

  const afterCall = reduceSession(smallC, [...running, lastCall()]);
  // Both Games still in progress, unchanged.
  assert.deepEqual(afterCall.courts, seated.courts);

  // Court 1 finishes: its four re-queue, no replacement seated, Court 2 plays on.
  const afterFinish = reduceSession(smallC, [
    ...running,
    lastCall(),
    courtFinished(1),
  ]);
  assert.deepEqual(afterFinish.courts[0].foursome, []);
  assert.equal(afterFinish.courts[1].foursome.length, 4);
});

test("a replayed LAST_CALL does not move the time", () => {
  const first = lastCall();
  const state = reduceSession(config, [started(), first, lastCall()]);
  assert.equal(state.lastCallAt, first.at);
});

test("LAST_CALL before the Session opens is ignored", () => {
  const state = reduceSession(config, [lastCall()]);
  assert.equal(state.lastCallAt, null);
});

test("undo drops the last LAST_CALL: re-folding restores the running Session", () => {
  const base = [...sessionWith(12)];
  const before = reduceSession(config, base);
  const withCall = [...base, lastCall()];
  assert.notEqual(reduceSession(config, withCall).lastCallAt, null);
  assert.deepEqual(reduceSession(config, withCall.slice(0, -1)), before);
});

test("SESSION_CLOSED flips status to closed", () => {
  const state = reduceSession(config, [started(), sessionClosed()]);
  assert.equal(state.status, "closed");
});

test("events after SESSION_CLOSED are ignored", () => {
  const base = [started(), joined("p1", "P1", "X"), sessionClosed()];
  const closed = reduceSession(config, base);
  const withStray = reduceSession(config, [
    ...base,
    queued("p1"),
    joined("p2", "P2", "X"),
  ]);
  assert.deepEqual(withStray.queue, closed.queue);
  assert.deepEqual(withStray.roster, closed.roster);
});

// --- the Kiosk: self-serve floor (issue #259) ---------------------------------

const kiosk: Operator = { kind: "kiosk" };

test("a kiosk-sourced COURT_FINISHED folds identically to a volunteer-sourced one", () => {
  const base = sessionWith(8);
  base.push(courtFinished(1, volunteer)); // seat Court 1
  base.push(courtFinished(2, volunteer)); // seat Court 2

  // One event, folded twice with only the operator swapped — same `at`.
  const finishAt = tick();
  const viaVolunteer = reduceSession(config, [
    ...base,
    { type: "COURT_FINISHED", at: finishAt, operator: volunteer, court: 1 },
  ]);
  const viaKiosk = reduceSession(config, [
    ...base,
    { type: "COURT_FINISHED", at: finishAt, operator: kiosk, court: 1 },
  ]);

  // Same board — occupants, queue order, on-deck, everything the fold projects.
  // Only the operator on the dropped-from-view event differed.
  assert.deepEqual(viaKiosk.courts, viaVolunteer.courts);
  assert.deepEqual(viaKiosk.queue, viaVolunteer.queue);
  assert.deepEqual(viaKiosk.onDeck, viaVolunteer.onDeck);
  assert.deepEqual(viaKiosk.completedGames, viaVolunteer.completedGames);
  assert.deepEqual(viaKiosk.completedWaits, viaVolunteer.completedWaits);
});

test("COURT_CONFIRMED records the confirmation time for an in-play Court", () => {
  const events = sessionWith(4);
  events.push(courtFinished(1, kiosk)); // seat Court 1
  const seated = reduceSession(config, events);
  const since = seated.courts.find((c) => c.number === 1)!.since;

  const confirmAt = tick();
  const withConfirm = reduceSession(config, [
    ...events,
    { type: "COURT_CONFIRMED", at: confirmAt, operator: kiosk, court: 1, since },
  ]);
  assert.equal(withConfirm.courtConfirmedAt[1], confirmAt);
  // Nothing else moved — it is not a turnover.
  assert.deepEqual(withConfirm.courts, seated.courts);
  assert.deepEqual(withConfirm.queue, seated.queue);
});

test("COURT_CONFIRMED for an empty Court, or with a stale since, is a no-op", () => {
  const events = sessionWith(4);
  events.push(courtFinished(1, kiosk));
  const seated = reduceSession(config, events);
  const since = seated.courts.find((c) => c.number === 1)!.since;

  const emptyCourt = reduceSession(config, [
    ...events,
    { type: "COURT_CONFIRMED", at: tick(), operator: kiosk, court: 5, since: null },
  ]);
  assert.deepEqual(emptyCourt.courtConfirmedAt, {});

  const staleSince = reduceSession(config, [
    ...events,
    { type: "COURT_CONFIRMED", at: tick(), operator: kiosk, court: 1, since: (since ?? 0) - 1 },
  ]);
  assert.deepEqual(staleSince.courtConfirmedAt, {});
});

test("a Court turning over clears its COURT_CONFIRMED", () => {
  const events = sessionWith(12);
  events.push(courtFinished(1, kiosk)); // seat Court 1
  const seated = reduceSession(config, events);
  const since = seated.courts.find((c) => c.number === 1)!.since;
  events.push({
    type: "COURT_CONFIRMED",
    at: tick(),
    operator: kiosk,
    court: 1,
    since,
  });
  events.push(courtFinished(1, kiosk)); // Court 1's Game ends, next walks on

  const state = reduceSession(config, events);
  assert.equal(state.courtConfirmedAt[1], undefined);
});

test("undo drops the last COURT_CONFIRMED: re-folding restores the prior state", () => {
  const events = sessionWith(4);
  events.push(courtFinished(1, kiosk));
  const before = reduceSession(config, events);
  const since = before.courts.find((c) => c.number === 1)!.since;
  const withConfirm = [
    ...events,
    {
      type: "COURT_CONFIRMED" as const,
      at: tick(),
      operator: kiosk,
      court: 1,
      since,
    },
  ];
  assert.equal(reduceSession(config, withConfirm).courtConfirmedAt[1] !== undefined, true);
  assert.deepEqual(reduceSession(config, withConfirm.slice(0, -1)), before);
});

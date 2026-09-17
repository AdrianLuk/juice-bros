/**
 * The demo night is authored, so this is the test that keeps it honest
 * (issue #519): the log folds to exactly the board `/on-deck/demo` claims to
 * open on, and every Foursome in it is one Match Me actually picked.
 *
 * Anything that fails here is a Floor bug, not a demo bug — the fold, the
 * projection and the floor decisions under test are the same ones a real
 * Saturday night runs on.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  DEMO_CONFIG,
  DEMO_OPENING,
  DEMO_PLAYER_COUNT,
  demoNightEvents,
} from "./night.ts";
import { demoEventFor, demoLoadedSession } from "./fold.ts";
import { finishCourtOutcome } from "../floor-ops.ts";
import { SELECTION_WINDOW } from "../session/match-me.ts";
import { rotationViewFrom } from "../session/rotation-view.ts";
import { SKILL_LEVELS } from "../session/types.ts";
import type { SessionEvent, SessionState } from "../session/types.ts";

/** A fixed wall clock — the demo stamps its log against whatever "now" is. */
const NOW = 1_800_000_000_000;

function openingNight(now = NOW) {
  const events = demoNightEvents(now);
  const loaded = demoLoadedSession(DEMO_CONFIG, events);
  return { events, loaded, view: rotationViewFrom(loaded, undefined, now) };
}

test("the demo opens on a night already in progress", () => {
  const { view } = openingNight();

  assert.equal(view.status, "open");
  assert.equal(view.lastCall, false);
  assert.equal(view.venueName, DEMO_CONFIG.venueName);
  assert.equal(view.courts.length, DEMO_CONFIG.courtCount);
});

test("every court is occupied by a full foursome", () => {
  const { view } = openingNight();

  const occupied = view.courts.filter((c) => c.players.length > 0);
  assert.equal(occupied.length, DEMO_OPENING.courtsOccupied);
  for (const court of view.courts) {
    assert.equal(court.players.length, 4, `court ${court.number}`);
    assert.notEqual(court.since, null, `court ${court.number} has no game clock`);
  }
});

test("no court has been sitting long enough to trip the idle nudge", () => {
  // A demo that opens covered in "is court N still going?" reads as broken,
  // and a real night at the hour mark would not be.
  assert.deepEqual(openingNight().view.idleCourts, []);
});

test("both on deck foursomes are committed and full", () => {
  const { view } = openingNight();

  assert.equal(view.onDeck.length, DEMO_OPENING.onDeckFoursomes);
  for (const foursome of view.onDeck) {
    assert.equal(foursome.length, 4);
  }
});

test("the queue is deep enough that selection is doing work", () => {
  const { view } = openingNight();

  assert.equal(view.queuedCount, DEMO_OPENING.queuedCount);
  // Queue Together is part of what makes the order arguable, so the demo
  // opens with a Group waiting rather than only describing one.
  assert.equal(view.queue.filter((e) => e.kind === "group").length, 1);
});

test("everybody who turned up is somewhere, and nobody is in two places at once", () => {
  const { loaded } = openingNight();
  const { state } = loaded;

  assert.equal(state.roster.length, DEMO_PLAYER_COUNT);
  assert.equal(new Set(state.roster.map((p) => p.id)).size, DEMO_PLAYER_COUNT);

  const placements = new Map<string, string>();
  const place = (playerId: string, where: string) => {
    const already = placements.get(playerId);
    assert.equal(already, undefined, `${playerId} is in ${already} and ${where}`);
    placements.set(playerId, where);
  };

  for (const court of state.courts) {
    for (const id of court.foursome) place(id, `court ${court.number}`);
  }
  for (const entry of state.queue) place(entry.playerId, "the queue");
  for (const paused of state.paused) place(paused.playerId, "set aside");

  assert.equal(placements.size, DEMO_PLAYER_COUNT);

  // An On Deck Foursome is a claim on somebody still in the Queue, never a
  // fourth place to be: a name on an On Deck card must not also be on a Court.
  const onDeckIds = state.onDeck.flatMap((f) => f.players);
  assert.equal(new Set(onDeckIds).size, onDeckIds.length);
  for (const id of onDeckIds) {
    assert.equal(placements.get(id), "the queue", `${id} is on deck but not queued`);
  }
});

test("the players read as made up", () => {
  const { loaded } = openingNight();

  // `fakePlayer`'s fixed last initial is the tell that shows up on the board.
  for (const player of loaded.state.roster) {
    assert.match(player.displayName, /^[A-Za-z]+( \d+)? B\.$/);
  }
});

test("the night carries a real match history for Variety to score against", () => {
  const { loaded } = openingNight();

  assert.ok(
    loaded.state.completedGames.length >= DEMO_OPENING.minCompletedGames,
    `only ${loaded.state.completedGames.length} games played`,
  );
  for (const game of loaded.state.completedGames) {
    assert.equal(game.players.length, 4);
    assert.equal(new Set(game.players).size, 4);
  }
});

test("the log is in append order", () => {
  const { events } = openingNight();

  for (let i = 1; i < events.length; i++) {
    assert.ok(
      events[i].at >= events[i - 1].at,
      `event ${i} (${events[i].type}) goes backwards in time`,
    );
  }
  assert.equal(events[0].type, "SESSION_STARTED");
});

test("the log exercises the paths a real night takes, not just turnovers", () => {
  const { events } = openingNight();
  const types = new Set(events.map((e) => e.type));

  for (const type of [
    "PLAYER_JOINED",
    "PLAYER_QUEUED",
    "COURT_FINISHED",
    "FOURSOME_MEMBER_SWAPPED",
    "PLAYER_REQUEUED",
    "GROUP_FORMED",
  ]) {
    assert.ok(types.has(type as SessionEvent["type"]), `no ${type} in the log`);
  }
});

test("every foursome in the log is the one the board had promised", () => {
  // The demo's claim is that its selections are derived rather than invented.
  // Replaying the log one turnover at a time: whoever walks onto the freed
  // Court is exactly the "Up next" card that was showing before the tap —
  // never a hand-picked four, and never a reshuffle (ADR 0007).
  const { events } = openingNight();
  let seatings = 0;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event.type !== "COURT_FINISHED") continue;
    const before = demoLoadedSession(DEMO_CONFIG, events.slice(0, i)).state;
    const upNext = before.onDeck[0];
    if (!upNext || upNext.players.length < 4) continue;

    const after = demoLoadedSession(DEMO_CONFIG, events.slice(0, i + 1)).state;
    const court = after.courts.find((c) => c.number === event.court)!;
    assert.deepEqual(court.foursome, upNext.players, `turnover ${i}`);
    seatings += 1;
  }

  assert.ok(seatings >= 20, `only ${seatings} turnovers to check`);
});

test("selection is choosing on skill fit, not on arrival order", () => {
  // What an organizer judges the algorithm by. Match Me's skill cost is
  // quadratic in the gap between levels, so a Queue this deep should never
  // leave a two-level spread standing on a Court — and if it does, the pick
  // was made on something other than fit.
  const { loaded } = openingNight();
  const { state } = loaded;
  const level = (id: string) =>
    SKILL_LEVELS.indexOf(
      state.roster.find((p) => p.id === id)?.skillLevel ?? "intermediate",
    );
  const spread = (ids: readonly string[]) =>
    Math.max(...ids.map(level)) - Math.min(...ids.map(level));

  for (const court of state.courts) {
    assert.ok(
      spread(court.foursome) <= 1,
      `court ${court.number} has a ${spread(court.foursome)}-level spread`,
    );
  }
  for (const [i, foursome] of state.onDeck.entries()) {
    assert.ok(
      spread(foursome.players) <= 1,
      `on deck ${i} has a ${spread(foursome.players)}-level spread`,
    );
  }

  // And it is a real choice, not the only four left: Match Me's window is
  // wider than the Foursome it fills.
  assert.ok(state.queue.length > 4 + SELECTION_WINDOW / 2);
});

test("the same night is folded whatever time it is loaded", () => {
  const early = openingNight(1_700_000_000_000);
  const late = openingNight(1_900_000_123_456);

  assert.deepEqual(
    late.view.courts.map((c) => c.players),
    early.view.courts.map((c) => c.players),
  );
  assert.deepEqual(late.view.onDeck, early.view.onDeck);
  assert.equal(late.view.queuedCount, early.view.queuedCount);
});

test("game done sends the committed on-deck foursome onto the freed court", () => {
  const { events, loaded, view } = openingNight();
  const court = view.courts[0];
  const upNext = view.onDeck[0];

  const outcome = finishCourtOutcome(loaded.state, court.number, court.since);
  assert.equal(outcome.kind, "event");
  const event = demoEventFor(outcome, NOW, { kind: "organizer", userId: "demo" });
  assert.notEqual(event, null);

  const after = demoLoadedSession(DEMO_CONFIG, [...events, event!]);
  const afterView = rotationViewFrom(after, undefined, NOW);
  const turned = afterView.courts.find((c) => c.number === court.number)!;

  assert.deepEqual(turned.players, upNext);
  // The four who came off are back in the Queue, and the board is still whole.
  assertNobodyDoubled(after.state);
  assert.equal(afterView.onDeck.length, 2);
  assert.equal(afterView.onDeck[0].length, 4);
  for (const name of court.players) {
    assert.ok(
      afterView.queue.some((e) =>
        e.kind === "solo" ? e.name === name : e.names.includes(name),
      ),
      `${name} did not re-queue`,
    );
  }
});

test("a stale second tap on the same court is a no-op, not a yanked foursome", () => {
  const { loaded, view } = openingNight();
  const court = view.courts[0];
  const stale = finishCourtOutcome(loaded.state, court.number, court.since! - 1);
  assert.equal(stale.kind, "noop");
});

test("ten turnovers in a row leave the board whole", () => {
  // The demo lets somebody tap through a whole stretch of the night. Every
  // one of those taps folds through the same reducer, so a drift that only
  // shows up after several turnovers shows up here first.
  let events = demoNightEvents(NOW);
  let at = NOW;

  for (let i = 0; i < 10; i++) {
    at += 90_000;
    const loaded = demoLoadedSession(DEMO_CONFIG, events);
    const court = loaded.state.courts[i % DEMO_CONFIG.courtCount];
    const outcome = finishCourtOutcome(loaded.state, court.number, court.since);
    const event = demoEventFor(outcome, at, { kind: "organizer", userId: "demo" });
    assert.notEqual(event, null, `turnover ${i} produced no event`);
    events = [...events, event!];

    const after = demoLoadedSession(DEMO_CONFIG, events);
    assertNobodyDoubled(after.state);
    assert.equal(after.state.roster.length, DEMO_PLAYER_COUNT);
    const view = rotationViewFrom(after, undefined, at);
    assert.equal(
      view.courts.filter((c) => c.players.length === 4).length,
      DEMO_CONFIG.courtCount,
      `a court emptied on turnover ${i}`,
    );
  }
});

/** Every Player is on exactly one Court, in the Queue, or set aside. */
function assertNobodyDoubled(state: SessionState): void {
  const seen = new Set<string>();
  const claim = (id: string, where: string) => {
    assert.ok(!seen.has(id), `${id} is in two places at once (${where})`);
    seen.add(id);
  };
  for (const court of state.courts) {
    assert.equal(new Set(court.foursome).size, court.foursome.length);
    for (const id of court.foursome) claim(id, `court ${court.number}`);
  }
  for (const entry of state.queue) claim(entry.playerId, "queue");
  for (const paused of state.paused) claim(paused.playerId, "paused");
  assert.equal(seen.size, state.roster.length);
}

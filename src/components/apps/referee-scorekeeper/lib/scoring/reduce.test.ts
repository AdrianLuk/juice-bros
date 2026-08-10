import assert from "node:assert/strict";
import test from "node:test";

import { reduceMatch } from "./reduce.ts";
import { scoreCall, serverCourt, servingPlayer } from "./selectors.ts";
import type { MatchConfig, MatchEvent, TeamId } from "./types.ts";

const doubles11: MatchConfig = {
  scoring: "sideout",
  doubles: true,
  pointsToWin: 11,
  winBy: 2,
  bestOf: 3,
  freezeRule: false,
  switchAtScore: 6,
  switchAtScoreDecidingGameOnly: true,
  timeoutsPerGame: 2,
  timeoutSeconds: 60,
  medicalTimeoutSeconds: 900,
  equipmentTimeoutSeconds: 120,
  players: { A: ["Amy", "Alex"], B: ["Ben", "Bea"] },
};

const singles11: MatchConfig = {
  ...doubles11,
  doubles: false,
  bestOf: 1,
  players: { A: ["Amy"], B: ["Ben"] },
};

const rally21: MatchConfig = {
  ...doubles11,
  scoring: "rally",
  pointsToWin: 21,
  winBy: 1, // rally formats close out flat — see `winByFor`
  bestOf: 1,
  switchAtScore: 11,
};

let clock = 1_000;
/** Monotonic fake timestamps so tests never touch the real clock. */
function tick(): number {
  clock += 1_000;
  return clock;
}

function rally(team: TeamId): MatchEvent {
  return { type: "RALLY_WON", at: tick(), team };
}

function rallies(teams: string): MatchEvent[] {
  return [...teams].map((t) => rally(t as TeamId));
}

function serveFirst(team: TeamId): MatchEvent {
  return { type: "PREMATCH", at: 1_000, winner: team, server: team };
}

/**
 * Append whatever rallies are needed for `team` to win one point: take the
 * serve back if they don't have it, then win a rally on serve.
 */
function scorePoint(
  config: MatchConfig,
  events: MatchEvent[],
  team: TeamId
): void {
  let guard = 0;
  while (reduceMatch(config, events).current.serving !== team) {
    events.push(rally(team));
    if (++guard > 4) throw new Error("could not win the serve back");
  }
  events.push(rally(team));
}

test("side-out doubles opens at 0-0-2 and the first lost rally ends the turn", () => {
  const events = [serveFirst("A")];
  assert.equal(scoreCall(reduceMatch(doubles11, events)), "0-0-2");

  events.push(rally("B"));
  const after = reduceMatch(doubles11, events);
  assert.equal(scoreCall(after), "0-0-1", "server 2 losing hands over the serve");
  assert.equal(after.current.serving, "B");
});

test("scripted game to 11 — score call after every event", () => {
  const script: Array<[TeamId, string]> = [
    ["A", "1-0-2"], // serving team scores
    ["A", "2-0-2"],
    ["B", "0-2-1"], // side-out: B serves, server 1
    ["B", "1-2-1"],
    ["A", "1-2-2"], // A wins off B's first server → second server up
    ["A", "2-1-1"], // second server lost too → side-out back to A
    ["A", "3-1-1"],
    ["A", "4-1-1"],
    ["A", "5-1-1"],
    ["A", "6-1-1"],
    ["A", "7-1-1"],
    ["A", "8-1-1"],
    ["A", "9-1-1"],
    ["A", "10-1-1"],
    ["A", "11-1-1"],
  ];

  const events: MatchEvent[] = [serveFirst("A")];
  for (const [team, expected] of script) {
    events.push(rally(team));
    assert.equal(
      scoreCall(reduceMatch(doubles11, events)),
      expected,
      `after ${team} won rally ${events.length - 1}`
    );
  }

  const final = reduceMatch(doubles11, events);
  assert.equal(final.current.complete, true);
  assert.equal(final.current.winner, "A");
});

test("deuce game runs past 11 and finishes 15-13", () => {
  const events: MatchEvent[] = [serveFirst("A")];

  // Trade points to 13-13. The lead never reaches 2, so nobody wins early.
  for (let i = 0; i < 13; i++) {
    scorePoint(doubles11, events, "A");
    scorePoint(doubles11, events, "B");
  }

  let state = reduceMatch(doubles11, events);
  assert.deepEqual(state.current.scores, { A: 13, B: 13 });
  assert.equal(state.current.complete, false, "13-13 is not a win at win-by-2");

  scorePoint(doubles11, events, "A");
  state = reduceMatch(doubles11, events);
  assert.deepEqual(state.current.scores, { A: 14, B: 13 });
  assert.equal(state.current.complete, false, "14-13 is only a one-point lead");

  scorePoint(doubles11, events, "A");
  state = reduceMatch(doubles11, events);
  assert.deepEqual(state.current.scores, { A: 15, B: 13 });
  assert.equal(state.current.complete, true);
  assert.equal(state.current.winner, "A");
});

test("serving team scoring swaps its own players; a side-out does not", () => {
  const events: MatchEvent[] = [serveFirst("A")];
  assert.deepEqual(reduceMatch(doubles11, events).current.positions.A, [
    "Amy",
    "Alex",
  ]);

  events.push(rally("A"));
  const scored = reduceMatch(doubles11, events);
  assert.deepEqual(scored.current.positions.A, ["Alex", "Amy"]);
  assert.deepEqual(scored.current.positions.B, ["Ben", "Bea"], "receivers stay put");

  // A is at 1 (odd) so Alex is on the even court and Amy serves from the odd side.
  assert.equal(scored.current.serverNumber, 2);

  events.push(rally("B"));
  const sideout = reduceMatch(doubles11, events);
  assert.equal(sideout.current.serving, "B");
  assert.equal(sideout.current.serverNumber, 1);
  assert.deepEqual(
    sideout.current.positions,
    scored.current.positions,
    "a side-out never moves anyone"
  );
});

test("second server: the partner takes over on the correct side, not the player who just lost the rally", () => {
  const events: MatchEvent[] = [serveFirst("A"), rally("B")]; // immediate side-out (A opened at server 2)
  const server1 = reduceMatch(doubles11, events);
  assert.equal(server1.current.serving, "B");
  assert.equal(server1.current.serverNumber, 1);
  assert.deepEqual(server1.current.positions.B, ["Ben", "Bea"]);
  assert.equal(servingPlayer(server1), "Ben");

  events.push(rally("B")); // Ben (server 1) scores and swaps to the odd side
  const stillBen = reduceMatch(doubles11, events);
  assert.equal(stillBen.current.serverNumber, 1);
  assert.deepEqual(stillBen.current.positions.B, ["Bea", "Ben"]);
  assert.equal(servingPlayer(stillBen), "Ben", "same server, now on the odd side");

  events.push(rally("A")); // Ben loses — hands off to Bea, not a full side-out
  const server2 = reduceMatch(doubles11, events);
  assert.equal(server2.current.serving, "B", "still B's turn to serve");
  assert.equal(server2.current.serverNumber, 2);
  assert.deepEqual(
    server2.current.scores,
    stillBen.current.scores,
    "no score changes on the handoff"
  );
  assert.deepEqual(
    server2.current.positions.B,
    stillBen.current.positions.B,
    "nobody moves on the handoff — Bea serves from wherever she already stands"
  );
  assert.equal(
    servingPlayer(server2),
    "Bea",
    "the partner serves next, not the player who just lost the rally"
  );
  assert.equal(
    serverCourt(server2),
    "even",
    "Bea was on the even side all along — the handoff doesn't require her to match B's (unchanged) odd-score parity"
  );
});

test("side-out: the right-court player serves first even when the team's score is odd", () => {
  const events: MatchEvent[] = [serveFirst("A"), rally("A")];
  // A scored, so Amy and Alex switched: Alex is now on the right, and Amy —
  // the game's starting server — is on the left, matching A's odd score.
  const scored = reduceMatch(doubles11, events);
  assert.deepEqual(scored.current.scores, { A: 1, B: 0 });
  assert.deepEqual(scored.current.positions.A, ["Alex", "Amy"]);
  assert.equal(servingPlayer(scored), "Amy", "Amy keeps serving, now from the left");

  // Hand the serve to B and straight back, leaving A's score untouched at 1.
  events.push(rally("B")); // A was on server 2 → side-out to B
  events.push(rally("A")); // B's server 1 loses → handoff to server 2
  events.push(rally("A")); // B's server 2 loses → side-out back to A

  const regained = reduceMatch(doubles11, events);
  assert.equal(regained.current.serving, "A");
  assert.equal(regained.current.serverNumber, 1);
  assert.deepEqual(regained.current.scores, { A: 1, B: 0 }, "A's score is still odd");
  assert.deepEqual(
    regained.current.positions.A,
    ["Alex", "Amy"],
    "a side-out moves nobody"
  );
  assert.equal(
    serverCourt(regained),
    "even",
    "a team gaining the serve always opens from the right/even court"
  );
  assert.equal(
    servingPlayer(regained),
    "Alex",
    "the right-court player serves first — not Amy, whose left-court position merely tracks the odd score"
  );
});

// Setup lets a ref name a team's first server independently of the order the
// names were typed in, by reordering `config.players` before build. The
// reducer has no notion of "player 1" — it just starts serving from whoever
// is at position index 0 — so this is the contract that feature depends on.
test("the first server is whoever occupies position index 0, not a fixed 'player 1' role", () => {
  const playerTwoFirst: MatchConfig = {
    ...doubles11,
    players: { A: ["Alex", "Amy"], B: ["Bea", "Ben"] },
  };

  const state = reduceMatch(playerTwoFirst, [serveFirst("A")]);
  assert.deepEqual(state.current.positions.A, ["Alex", "Amy"]);
  assert.equal(servingPlayer(state), "Alex", "whoever is first in config.players opens serve");
});

test("singles has no server number and serves by score parity", () => {
  const events: MatchEvent[] = [serveFirst("A")];
  assert.equal(scoreCall(reduceMatch(singles11, events)), "0-0");

  events.push(rally("B"));
  const state = reduceMatch(singles11, events);
  assert.equal(state.current.serving, "B", "one lost rally is a side-out in singles");
  assert.equal(state.current.serverNumber, 1);
});

test("rally scoring gives the receiver both the point and the serve", () => {
  const events: MatchEvent[] = [serveFirst("A"), rally("B")];
  const state = reduceMatch(rally21, events);
  assert.deepEqual(state.current.scores, { A: 0, B: 1 });
  assert.equal(state.current.serving, "B");
});

// The setup toggles make singles and rally scoring independent, so this pairing
// is reachable even though no preset ships it.
test("singles rally scoring never uses a second server", () => {
  const singlesRally = { ...singles11, scoring: "rally" as const };
  const events: MatchEvent[] = [serveFirst("A"), rally("A"), rally("B"), rally("B")];
  const state = reduceMatch(singlesRally, events);

  assert.deepEqual(state.current.scores, { A: 1, B: 2 });
  assert.equal(state.current.serving, "B");
  assert.equal(state.current.serverNumber, 1);
  assert.equal(scoreCall(state), "2-1", "no server number in singles");
});

/** Trading rallies one for one leaves both teams on 10 with B holding serve. */
const TEN_ALL = "ABABABABABABABABABAB";

test("rally scoring closes out at the target with no deuce", () => {
  const rally11: MatchConfig = {
    ...rally21,
    pointsToWin: 11,
    freezeRule: false,
    switchAtScore: 6,
  };
  const events: MatchEvent[] = [serveFirst("A"), ...rallies(TEN_ALL)];
  assert.deepEqual(reduceMatch(rally11, events).current.scores, { A: 10, B: 10 });

  events.push(rally("A"));
  const state = reduceMatch(rally11, events);
  assert.equal(state.current.complete, true, "11-10 ends it — no two-point margin");
  assert.equal(state.current.winner, "A");
  assert.deepEqual(state.current.scores, { A: 11, B: 10 });
});

test("rally scoring set to win by 2 plays past the target — the USAP margin", () => {
  const rally11Deuce: MatchConfig = {
    ...rally21,
    pointsToWin: 11,
    winBy: 2,
    freezeRule: false,
    switchAtScore: 6,
  };
  const events: MatchEvent[] = [serveFirst("A"), ...rallies(TEN_ALL)];

  events.push(rally("A"));
  const gamePoint = reduceMatch(rally11Deuce, events);
  assert.deepEqual(gamePoint.current.scores, { A: 11, B: 10 });
  assert.equal(gamePoint.current.complete, false, "11-10 is only game point");
  assert.equal(gamePoint.current.serving, "A", "the receiver took point and serve");

  events.push(rally("B"));
  assert.deepEqual(
    reduceMatch(rally11Deuce, events).current.scores,
    { A: 11, B: 11 },
    "B claws it back rather than losing on the first game point"
  );

  events.push(rally("B"), rally("B"));
  const won = reduceMatch(rally11Deuce, events);
  assert.equal(won.current.complete, true, "13-11 closes it");
  assert.equal(won.current.winner, "B");
  assert.deepEqual(won.current.scores, { A: 11, B: 13 });
});

test("win by 1 and the freeze rule together: 10-10 is still only winnable on serve", () => {
  const rally11: MatchConfig = {
    ...rally21,
    pointsToWin: 11,
    freezeRule: true,
    switchAtScore: 6,
  };
  const events: MatchEvent[] = [serveFirst("A"), ...rallies(TEN_ALL)];
  const tenAll = reduceMatch(rally11, events);
  assert.deepEqual(tenAll.current.scores, { A: 10, B: 10 });
  assert.equal(tenAll.current.serving, "B");

  events.push(rally("A")); // would be 11-10 A, but A is receiving
  const frozen = reduceMatch(rally11, events);
  assert.deepEqual(frozen.current.scores, { A: 10, B: 10 }, "held at 10-10");
  assert.equal(frozen.current.serving, "A");
  assert.equal(frozen.current.complete, false);

  events.push(rally("A"));
  const won = reduceMatch(rally11, events);
  assert.equal(won.current.complete, true);
  assert.deepEqual(won.current.scores, { A: 11, B: 10 });
});

test("freeze rule: winning the rally while receiving at game point is a side-out, not a scored point", () => {
  const rallyFreeze: MatchConfig = { ...rally21, pointsToWin: 11, bestOf: 1, freezeRule: true };

  // B serves first; A runs its score to 10 entirely while holding serve, so
  // the only receiving win left to test is the one that would cross 11.
  const events: MatchEvent[] = [serveFirst("B"), rally("A")];
  for (let i = 0; i < 9; i++) events.push(rally("A"));
  // Hand serve back to B without touching A's score, so A is receiving.
  events.push(rally("B"));

  const beforeGamePoint = reduceMatch(rallyFreeze, events);
  assert.deepEqual(beforeGamePoint.current.scores, { A: 10, B: 1 });
  assert.equal(beforeGamePoint.current.serving, "B");

  events.push(rally("A")); // A would win the rally, and the game, while receiving
  const sidedOut = reduceMatch(rallyFreeze, events);
  assert.deepEqual(
    sidedOut.current.scores,
    { A: 10, B: 1 },
    "no point scored — this is just a side-out, same as losing the serve normally"
  );
  assert.equal(sidedOut.current.serving, "A", "service still passes, exactly like any other side-out");
  assert.equal(sidedOut.current.complete, false);

  events.push(rally("A")); // now serving — this point actually counts
  const won = reduceMatch(rallyFreeze, events);
  assert.equal(won.current.complete, true);
  assert.equal(won.current.winner, "A");
  assert.deepEqual(won.current.scores, { A: 11, B: 1 });
});

test("freeze rule: an ordinary receiving win still scores normally when it's not game point", () => {
  const rallyFreeze: MatchConfig = { ...rally21, pointsToWin: 11, bestOf: 1, freezeRule: true };
  const events: MatchEvent[] = [serveFirst("A"), rally("B")]; // B receives and wins — nowhere near game point

  const state = reduceMatch(rallyFreeze, events);
  assert.deepEqual(state.current.scores, { A: 0, B: 1 }, "the trailing team still gets the point");
  assert.equal(state.current.serving, "B");
});

test("freeze rule also holds a game point scored via technical foul", () => {
  const rallyFreeze: MatchConfig = { ...rally21, pointsToWin: 11, bestOf: 1, freezeRule: true };

  const events: MatchEvent[] = [serveFirst("B")];
  for (let i = 0; i < 11; i++) {
    events.push({ type: "TECHNICAL_FOUL", at: 1_000 + i, team: "B" });
  }
  const atGamePoint = reduceMatch(rallyFreeze, events);
  assert.deepEqual(atGamePoint.current.scores, { A: 11, B: 0 });
  assert.equal(atGamePoint.current.serving, "B", "a foul point never changes service");
  assert.equal(
    atGamePoint.current.complete,
    false,
    "A only reached game point by fouls while B still serves — frozen"
  );

  events.push(rally("A")); // A wins outright, but still as the receiver
  const stillFrozen = reduceMatch(rallyFreeze, events);
  assert.equal(stillFrozen.current.complete, false);
  assert.equal(stillFrozen.current.serving, "A");

  events.push(rally("A")); // now serving — this one counts
  const won = reduceMatch(rallyFreeze, events);
  assert.equal(won.current.complete, true);
  assert.equal(won.current.winner, "A");
});

test("freeze rule is inert under side-out scoring even if left on", () => {
  const sideoutFrozen: MatchConfig = { ...doubles11, freezeRule: true };
  const events: MatchEvent[] = [serveFirst("A")];
  for (let i = 0; i < 11; i++) scorePoint(sideoutFrozen, events, "A");

  const state = reduceMatch(sideoutFrozen, events);
  assert.equal(state.current.complete, true, "side-out scoring ignores the freeze toggle");
  assert.equal(state.current.winner, "A");
});

test("doubles rally scoring still swaps the serving pair on a point", () => {
  const doublesRally = { ...doubles11, scoring: "rally" as const };
  const events: MatchEvent[] = [serveFirst("A"), rally("A")];
  const state = reduceMatch(doublesRally, events);

  assert.deepEqual(state.current.scores, { A: 1, B: 0 });
  assert.deepEqual(state.current.positions.A, ["Alex", "Amy"]);
  assert.equal(scoreCall(state), "1-0", "rally scoring drops the server number");
});

test("undo parity: replaying without the last event equals the state before it", () => {
  // Every event in this log must move the state, or the notDeepEqual below is
  // meaningless — hence PREMATCH handing the serve to B rather than to A.
  const events: MatchEvent[] = [
    { type: "PREMATCH", at: 1_000, winner: "B", server: "B" },
    ...rallies("BBAABBA"),
    { type: "TIMEOUT_STARTED", at: tick(), team: "A", kind: "standard" },
  ];

  for (let i = events.length; i > 0; i--) {
    const before = reduceMatch(doubles11, events.slice(0, i - 1));
    const appended = reduceMatch(doubles11, events.slice(0, i));
    const undone = reduceMatch(doubles11, events.slice(0, i).slice(0, -1));
    assert.deepEqual(undone, before, `undo at index ${i} must restore exactly`);
    assert.notDeepEqual(appended, undone, `event ${i - 1} should change something`);
  }
});

test("determinism: same events reduce identically regardless of wall clock", () => {
  const events: MatchEvent[] = [
    serveFirst("A"),
    { type: "RALLY_WON", at: 2_000, team: "A" },
    { type: "TIMEOUT_STARTED", at: 3_000, team: "B", kind: "standard" },
    { type: "TIMEOUT_PAUSED", at: 4_000 },
  ];
  const first = reduceMatch(doubles11, events);
  const busyWait = Date.now() + 5;
  while (Date.now() < busyWait) {
    /* let the wall clock move */
  }
  const second = reduceMatch(doubles11, events);
  assert.deepEqual(second, first);
});

test("third standard timeout is refused; a medical timeout at the same point is not", () => {
  const base: MatchEvent[] = [
    serveFirst("A"),
    { type: "TIMEOUT_STARTED", at: 2_000, team: "A", kind: "standard" },
    { type: "TIMEOUT_ENDED", at: 3_000, reason: "expired" },
    { type: "TIMEOUT_STARTED", at: 4_000, team: "A", kind: "standard" },
    { type: "TIMEOUT_ENDED", at: 5_000, reason: "ended_early" },
  ];

  const third = reduceMatch(doubles11, [
    ...base,
    { type: "TIMEOUT_STARTED", at: 6_000, team: "A", kind: "standard" },
  ]);
  assert.equal(third.activeTimeout, null, "third standard timeout is ignored");
  assert.equal(third.timeoutHistory.length, 2);
  assert.equal(third.current.timeoutsUsed.A, 2);

  const medical = reduceMatch(doubles11, [
    ...base,
    { type: "TIMEOUT_STARTED", at: 6_000, team: "A", kind: "medical" },
  ]);
  assert.equal(medical.activeTimeout?.kind, "medical");
  assert.equal(medical.timeoutHistory.length, 3);
  assert.equal(
    medical.current.timeoutsUsed.A,
    2,
    "medical does not consume the allowance"
  );
  assert.equal(medical.activeTimeout?.durationMs, 900_000);
});

test("a timeout cannot start while another is running", () => {
  const state = reduceMatch(doubles11, [
    serveFirst("A"),
    { type: "TIMEOUT_STARTED", at: 2_000, team: "A", kind: "standard" },
    { type: "TIMEOUT_STARTED", at: 2_500, team: "B", kind: "medical" },
  ]);
  assert.equal(state.timeoutHistory.length, 1);
  assert.equal(state.activeTimeout?.team, "A");
});

test("standard timeout allowance resets each game", () => {
  // Timeouts after game point are refused, so call it before the win.
  const beforeWin: MatchEvent[] = [serveFirst("A")];
  for (let i = 0; i < 10; i++) beforeWin.push(rally("A"));
  beforeWin.push(
    { type: "TIMEOUT_STARTED", at: 90_000, team: "A", kind: "standard" },
    { type: "TIMEOUT_ENDED", at: 91_000, reason: "expired" },
    rally("A"),
    { type: "GAME_CONFIRMED", at: 95_000 }
  );

  const state = reduceMatch(doubles11, beforeWin);
  assert.equal(state.games.length, 2, "game 2 has started");
  assert.equal(state.current.timeoutsUsed.A, 0, "allowance resets");
  assert.equal(state.current.firstServer, "B", "first serve alternates by game");
  assert.equal(state.timeoutHistory.length, 1, "history spans the whole match");
});

test("scoreAtCall is frozen at the moment of the call", () => {
  const events: MatchEvent[] = [serveFirst("A")];
  // Drive to 6-3, then take the serve back so A is serving at the call.
  for (let i = 0; i < 6; i++) scorePoint(doubles11, events, "A");
  for (let i = 0; i < 3; i++) scorePoint(doubles11, events, "B");
  while (reduceMatch(doubles11, events).current.serving !== "A") {
    events.push(rally("A"));
  }

  const atCall = reduceMatch(doubles11, events);
  assert.deepEqual(atCall.current.scores, { A: 6, B: 3 });
  assert.equal(atCall.current.serving, "A");

  events.push({ type: "TIMEOUT_STARTED", at: tick(), team: "A", kind: "standard" });
  events.push({ type: "TIMEOUT_ENDED", at: tick(), reason: "expired" });
  for (let i = 0; i < 4; i++) events.push(rally("A"));

  const later = reduceMatch(doubles11, events);
  assert.deepEqual(later.current.scores, { A: 10, B: 3 });
  assert.deepEqual(later.timeoutHistory[0].scoreAtCall, { A: 6, B: 3 });
  assert.equal(later.timeoutHistory[0].servingAtCall, "A");
  assert.equal(later.timeoutHistory[0].ordinal, 1);
  assert.equal(later.timeoutHistory[0].gameNumber, 1);
});

test("undoing TIMEOUT_STARTED removes the record and restores the count", () => {
  const events: MatchEvent[] = [
    serveFirst("A"),
    { type: "TIMEOUT_STARTED", at: 2_000, team: "B", kind: "standard" },
  ];
  const withTimeout = reduceMatch(doubles11, events);
  assert.equal(withTimeout.timeoutHistory.length, 1);
  assert.equal(withTimeout.current.timeoutsUsed.B, 1);

  const undone = reduceMatch(doubles11, events.slice(0, -1));
  assert.equal(undone.timeoutHistory.length, 0);
  assert.equal(undone.current.timeoutsUsed.B, 0);
  assert.equal(undone.activeTimeout, null);
});

test("pause accounting: 60s timeout paused from 20s to 50s has 40s left", () => {
  const state = reduceMatch(doubles11, [
    serveFirst("A"),
    { type: "TIMEOUT_STARTED", at: 0, team: "A", kind: "standard" },
    { type: "TIMEOUT_PAUSED", at: 20_000 },
    { type: "TIMEOUT_RESUMED", at: 50_000 },
  ]);

  const active = state.activeTimeout;
  assert.ok(active);
  assert.equal(active.accumulatedMs, 20_000);
  assert.equal(active.runningSince, 50_000);
  assert.equal(state.timeoutHistory[0].pausedMs, 30_000);
  assert.equal(state.timeoutHistory[0].pauseCount, 1);

  // remaining at the instant of resume
  const remaining = active.durationMs - active.accumulatedMs;
  assert.equal(remaining, 40_000);
});

test("two pause/resume cycles accumulate correctly", () => {
  const state = reduceMatch(doubles11, [
    { type: "TIMEOUT_STARTED", at: 0, team: "A", kind: "standard" },
    { type: "TIMEOUT_PAUSED", at: 10_000 },
    { type: "TIMEOUT_RESUMED", at: 25_000 },
    { type: "TIMEOUT_PAUSED", at: 35_000 },
    { type: "TIMEOUT_RESUMED", at: 40_000 },
  ]);

  assert.equal(state.activeTimeout?.accumulatedMs, 20_000);
  assert.equal(state.activeTimeout?.runningSince, 40_000);
  assert.equal(state.timeoutHistory[0].pausedMs, 20_000);
  assert.equal(state.timeoutHistory[0].pauseCount, 2);
});

test("double pause and redundant resume are no-ops", () => {
  const state = reduceMatch(doubles11, [
    { type: "TIMEOUT_STARTED", at: 0, team: "A", kind: "standard" },
    { type: "TIMEOUT_PAUSED", at: 10_000 },
    { type: "TIMEOUT_PAUSED", at: 12_000 },
    { type: "TIMEOUT_RESUMED", at: 20_000 },
    { type: "TIMEOUT_RESUMED", at: 22_000 },
  ]);

  assert.equal(state.activeTimeout?.accumulatedMs, 10_000);
  assert.equal(state.activeTimeout?.runningSince, 20_000);
  assert.equal(state.timeoutHistory[0].pauseCount, 1);
  assert.equal(state.timeoutHistory[0].pausedMs, 10_000);
});

test("ending a paused timeout is valid and banks the paused span", () => {
  const state = reduceMatch(doubles11, [
    { type: "TIMEOUT_STARTED", at: 0, team: "A", kind: "standard" },
    { type: "TIMEOUT_PAUSED", at: 15_000 },
    { type: "TIMEOUT_ENDED", at: 45_000, reason: "ended_early" },
  ]);

  assert.equal(state.activeTimeout, null);
  assert.equal(state.timeoutHistory[0].endedAt, 45_000);
  assert.equal(state.timeoutHistory[0].endReason, "ended_early");
  assert.equal(state.timeoutHistory[0].pausedMs, 30_000);
});

test("rallies during an active timeout are ignored", () => {
  const state = reduceMatch(doubles11, [
    serveFirst("A"),
    { type: "TIMEOUT_STARTED", at: 2_000, team: "A", kind: "standard" },
    { type: "RALLY_WON", at: 3_000, team: "A" },
    { type: "RALLY_WON", at: 4_000, team: "B" },
  ]);
  assert.deepEqual(state.current.scores, { A: 0, B: 0 });
});

test("rallies after game point are ignored until GAME_CONFIRMED", () => {
  const events: MatchEvent[] = [serveFirst("A")];
  for (let i = 0; i < 11; i++) events.push(rally("A"));
  events.push(rally("A"), rally("B"));

  const stalled = reduceMatch(doubles11, events);
  assert.deepEqual(stalled.current.scores, { A: 11, B: 0 });
  assert.equal(stalled.current.complete, true);
  assert.equal(stalled.games.length, 1, "no auto-advance");

  events.push({ type: "GAME_CONFIRMED", at: 999_000 });
  const confirmed = reduceMatch(doubles11, events);
  assert.equal(confirmed.gamesWon.A, 1);
  assert.equal(confirmed.games.length, 2);
  assert.equal(confirmed.matchComplete, false, "best of 3 needs two games");
});

test("technical foul awards a point without touching service or positions", () => {
  const events: MatchEvent[] = [serveFirst("A"), rally("A")];
  const before = reduceMatch(doubles11, events);

  events.push({ type: "TECHNICAL_FOUL", at: 10_000, team: "B" });
  const after = reduceMatch(doubles11, events);

  assert.deepEqual(after.current.scores, { A: 2, B: 0 });
  assert.equal(after.current.serving, before.current.serving);
  assert.equal(after.current.serverNumber, before.current.serverNumber);
  assert.deepEqual(after.current.positions, before.current.positions);
});

test("technical warnings are counted separately from score", () => {
  const state = reduceMatch(doubles11, [
    serveFirst("A"),
    { type: "TECHNICAL_WARNING", at: 5_000, team: "B" },
    { type: "TECHNICAL_WARNING", at: 6_000, team: "B" },
  ]);
  assert.deepEqual(state.warnings, { A: 0, B: 2 });
  assert.deepEqual(state.current.scores, { A: 0, B: 0 });
});

test("side switch flags once, and only in the deciding game", () => {
  const game1: MatchEvent[] = [serveFirst("A")];
  for (let i = 0; i < 7; i++) game1.push(rally("A"));
  assert.equal(
    reduceMatch(doubles11, game1).current.sidesSwitched,
    false,
    "best of 3: no mid-game switch in game 1"
  );

  const alwaysSwitch = { ...doubles11, switchAtScoreDecidingGameOnly: false };
  const state = reduceMatch(alwaysSwitch, game1);
  assert.equal(state.current.sidesSwitched, true);
});

test("PREMATCH sets the serving team from the resolved server, independent of who won", () => {
  // The winner isn't necessarily the server — e.g. the winner chose "receive",
  // or gave "side" to the opponent who then chose to serve. The reducer
  // doesn't re-derive this; it trusts whatever the coin-toss screen resolved.
  const winnerReceives = reduceMatch(doubles11, [
    { type: "PREMATCH", at: 1_000, winner: "A", server: "B" },
  ]);
  assert.equal(winnerReceives.current.serving, "B");
  assert.equal(winnerReceives.current.firstServer, "B");

  const winnerServes = reduceMatch(doubles11, [
    { type: "PREMATCH", at: 1_000, winner: "A", server: "A" },
  ]);
  assert.equal(winnerServes.current.serving, "A");

  const late = reduceMatch(doubles11, [
    serveFirst("A"),
    { type: "PREMATCH", at: 2_000, winner: "B", server: "B" },
  ]);
  assert.equal(late.current.serving, "A", "a second PREMATCH is ignored");
});

test("match completes once a team reaches the required game wins", () => {
  const events: MatchEvent[] = [serveFirst("A")];
  for (let game = 0; game < 2; game++) {
    const server = reduceMatch(doubles11, events).current.serving;
    // Hand the serve to A if needed, then run out the game.
    if (server !== "A") {
      events.push(rally("A"));
      if (reduceMatch(doubles11, events).current.serving !== "A") {
        events.push(rally("A"));
      }
    }
    while (!reduceMatch(doubles11, events).current.complete) {
      events.push(rally("A"));
    }
    events.push({ type: "GAME_CONFIRMED", at: 500_000 + game });
  }

  const state = reduceMatch(doubles11, events);
  assert.equal(state.matchComplete, true);
  assert.equal(state.gamesWon.A, 2);
  assert.equal(state.games.length, 2, "no game 3 is created after a 2-0 match");
});

test("MATCH_ENDED completes the match without crediting anyone a game win", () => {
  const events: MatchEvent[] = [serveFirst("A"), rally("A"), rally("A")];
  const state = reduceMatch(doubles11, [
    ...events,
    { type: "MATCH_ENDED", at: 90_000 },
  ]);

  assert.equal(state.matchComplete, true);
  assert.deepEqual(state.gamesWon, { A: 0, B: 0 }, "nobody reached the required game count");
  assert.deepEqual(state.current.scores, { A: 2, B: 0 }, "the partial score is preserved");
  assert.equal(state.games.length, 1, "the in-progress game stays as-is, not force-completed");
});

test("MATCH_ENDED closes out any active timeout and further events are ignored", () => {
  const events: MatchEvent[] = [
    serveFirst("A"),
    { type: "TIMEOUT_STARTED", at: 2_000, team: "A", kind: "standard" },
    { type: "MATCH_ENDED", at: 3_000 },
  ];

  const ended = reduceMatch(doubles11, events);
  assert.equal(ended.matchComplete, true);
  assert.equal(ended.activeTimeout, null, "no timeout should read as open once the match is over");

  const after = reduceMatch(doubles11, [
    ...events,
    { type: "RALLY_WON", at: 4_000, team: "A" },
    { type: "MATCH_ENDED", at: 5_000 },
  ]);
  assert.deepEqual(after, ended, "events after MATCH_ENDED are all no-ops");
});

test("undoing MATCH_ENDED returns to live play", () => {
  const events: MatchEvent[] = [serveFirst("A"), rally("A")];
  const withEnd = reduceMatch(doubles11, [...events, { type: "MATCH_ENDED", at: 9_000 }]);
  assert.equal(withEnd.matchComplete, true);

  const undone = reduceMatch(doubles11, events);
  assert.equal(undone.matchComplete, false);
  assert.deepEqual(undone.current.scores, { A: 1, B: 0 });
});

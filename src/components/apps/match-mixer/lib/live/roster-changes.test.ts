import assert from "node:assert/strict";
import test from "node:test";

import { parsePoolHeaders, parseRoster, rosterText } from "../engine/roster.ts";
import type { Format, Round } from "../engine/types.ts";
import { decodeShareLink, encodeSharePayload } from "../persistence/share-link.ts";
import type { MixerEvent } from "./events.ts";
import { rebuild, runItAgainPayload, type RebuiltMixer } from "./rebuild.ts";

/**
 * Late arrivals and early departures (#692), read through `rebuild`: the
 * Schedule is rebuilt from the Config plus the player added and player left
 * events, so every check here is "same inputs, same board".
 */

const names = (count: number, prefix = "P") => Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);

function config(
  lines: readonly string[],
  numbers: { courts: number; rounds: number; format?: Format; mixed?: boolean; pools?: number; seed?: number },
): string {
  const text = lines.join("\n");
  const marked = numbers.mixed === true;
  return encodeSharePayload({
    roster: parseRoster(text, [], marked),
    headers: parsePoolHeaders(text),
    courts: numbers.courts,
    rounds: numbers.rounds,
    seed: numbers.seed ?? 4242,
    format: numbers.format ?? "rotating",
    mixed: marked,
    pools: numbers.pools,
  });
}

let id = 0;
const event = (kind: string, payload: Record<string, unknown>): MixerEvent => ({ id: ++id, kind, payload });
const started = (round: number) => event("round_started", { round });
const added = (lines: string[], pool = 0) => event("player_added", { lines, pool });
const back = (player: number) => event("player_added", { player });
const left = (player: number) => event("player_left", { player });

function built(cfg: string, events: MixerEvent[]): RebuiltMixer {
  const live = rebuild(cfg, events);
  assert.ok(live, "the board redraws");
  return live;
}

/** Every Round of every Pool, in board order. */
const roundsOf = (live: RebuiltMixer): Round[][] => live.draw.pools.map((pool) => [...pool.schedule.rounds]);

/** Global Roster indices seated in one Round of one Pool. */
function seatedIn(live: RebuiltMixer, pool: number, round: number): number[] {
  const { members, schedule } = live.draw.pools[pool];
  return schedule.rounds[round].games.flatMap((game) => game.sides.flat().map((player) => members[player])).sort((a, b) => a - b);
}

const nine = config(names(9), { courts: 2, rounds: 6 });

test("an added Player sits out the locked Rounds and plays the rest, which are rebuilt", () => {
  const before = built(nine, [started(1)]);
  const after = built(nine, [started(1), added(["Late"])]);

  // Rounds 1 and 2 are locked: byte-identical, and the newcomer is in neither.
  assert.deepEqual(roundsOf(after).map((pool) => pool.slice(0, 2)), roundsOf(before).map((pool) => pool.slice(0, 2)));
  assert.equal(after.draw.config.roster[9].name, "Late");
  for (const round of [0, 1]) {
    assert.ok(!seatedIn(after, 0, round).includes(9));
    assert.ok(!after.draw.pools[0].schedule.rounds[round].byes.includes(9));
  }
  // Counted as Byes for the locked Rounds, so they play the next one.
  assert.ok(seatedIn(after, 0, 2).includes(9));
  assert.equal(after.draw.pools[0].schedule.rounds.length, 6);
});

test("the same Config and events always rebuild the same board", () => {
  const events = [started(1), added(["Late"]), started(2), left(3)];
  assert.deepEqual(roundsOf(built(nine, events)), roundsOf(built(nine, [...events])));
});

test("taking an added Player off before their first Round puts the board back exactly", () => {
  const before = built(nine, [started(1)]);
  const undone = built(nine, [started(1), added(["Late"]), left(9)]);
  assert.deepEqual(roundsOf(undone), roundsOf(before));
  // Nor do they leave a row behind in the Standings.
  assert.deepEqual(undone.standings, before.standings);
});

test("a Player marked as left is off the board from the next unlocked Round, and the locked ones stand", () => {
  const before = built(nine, [started(2)]);
  const after = built(nine, [started(2), left(4)]);
  assert.deepEqual(roundsOf(after).map((pool) => pool.slice(0, 3)), roundsOf(before).map((pool) => pool.slice(0, 3)));
  for (const round of [3, 4, 5]) {
    assert.ok(!seatedIn(after, 0, round).includes(4));
    assert.ok(!after.draw.pools[0].schedule.rounds[round].byes.includes(4));
  }
  assert.equal(after.playing[4], false);
});

test("a court that would go short drops its Game rather than playing three", () => {
  const eight = config(names(8), { courts: 2, rounds: 5 });
  const after = built(eight, [left(0)]);
  assert.equal(after.draw.pools[0].schedule.rounds[0].games.length, 2);
  for (const round of [1, 2, 3, 4]) {
    const { games, byes } = after.draw.pools[0].schedule.rounds[round];
    assert.equal(games.length, 1);
    assert.equal(byes.length, 3);
    // The Game left standing keeps its court.
    assert.ok(games[0].court === 0 || games[0].court === 1);
  }
});

test("a Player who left and comes back is on the board again from the next unlocked Round", () => {
  const after = built(nine, [left(4), started(3), back(4)]);
  assert.ok(!seatedIn(after, 0, 2).includes(4));
  assert.ok(!seatedIn(after, 0, 3).includes(4));
  assert.equal(after.playing[4], true);
  assert.ok([4, 5].some((round) => seatedIn(after, 0, round).includes(4)));
});

test("a score far ahead locks every Round up to it, so a change lands after it", () => {
  const after = built(nine, [event("score_entered", { round: 3, court: 0, score: [11, 5] }), added(["Late"])]);
  assert.equal(after.joined[9], 5);
  for (const round of [0, 1, 2, 3, 4]) assert.ok(!seatedIn(after, 0, round).includes(9));
});

/** Which two Roster indices share a Side anywhere from this Round on. */
function partnersFrom(live: RebuiltMixer, pool: number, from: number): Set<string> {
  const { members, schedule } = live.draw.pools[pool];
  const pairs = new Set<string>();
  for (const round of schedule.rounds.slice(from)) {
    for (const game of round.games) {
      for (const side of game.sides) if (side.length === 2) pairs.add(side.map((p) => members[p]).sort((a, b) => a - b).join("+"));
    }
  }
  return pairs;
}

test("fixed partners adds a Pairing, which plays as a pair, and loses one whole", () => {
  const fixed = config(names(10), { courts: 2, rounds: 6, format: "fixed" });
  const before = built(fixed, [started(1)]);

  // One line is not a Pairing, so it changes nothing.
  assert.deepEqual(roundsOf(built(fixed, [started(1), added(["Solo"])])), roundsOf(before));

  const after = built(fixed, [started(1), added(["Ann", "Bea"])]);
  assert.deepEqual(roundsOf(after).map((pool) => pool.slice(0, 2)), roundsOf(before).map((pool) => pool.slice(0, 2)));
  const pairs = partnersFrom(after, 0, 2);
  assert.ok(pairs.has("10+11"));
  // Every Side from there on is still one of the declared Pairings.
  for (const pair of pairs) {
    const [a, b] = pair.split("+").map(Number);
    assert.equal(b, a + 1);
    assert.equal(a % 2, 0);
  }

  const gone = built(fixed, [started(1), left(3)]);
  for (const round of [2, 3, 4, 5]) {
    const seated = seatedIn(gone, 0, round);
    assert.ok(!seated.includes(2) && !seated.includes(3));
  }
});

test("singles seats a late arrival as a Side of one", () => {
  const singles = config(names(7), { courts: 3, rounds: 6, format: "singles" });
  const before = built(singles, [started(1)]);
  const after = built(singles, [started(1), added(["Late"])]);
  assert.deepEqual(roundsOf(after).map((pool) => pool.slice(0, 2)), roundsOf(before).map((pool) => pool.slice(0, 2)));
  assert.ok(seatedIn(after, 0, 2).includes(7));
  for (const round of after.draw.pools[0].schedule.rounds) for (const game of round.games) assert.equal(game.sides[0].length, 1);
});

test("mixed doubles reads the late arrival's Marker and keeps every Team one of each", () => {
  const lines = [...names(5, "M").map((n) => `${n} M`), ...names(5, "F").map((n) => `${n} F`)];
  const mixed = config(lines, { courts: 2, rounds: 6, mixed: true });
  const after = built(mixed, [started(1), added(["Late F"]), added(["Later M"])]);
  assert.equal(after.draw.config.roster[10].marker, "F");
  assert.equal(after.draw.config.roster[10].name, "Late");
  const { roster } = after.draw.pools[0];
  for (const round of after.draw.pools[0].schedule.rounds) {
    for (const game of round.games) {
      for (const side of game.sides) assert.deepEqual(side.map((p) => roster[p].marker).sort(), ["F", "M"]);
    }
  }
  assert.ok(seatedIn(after, 0, 2).includes(10));
});

test("on a pooled board only the chosen Pool is rebuilt, and courts never move", () => {
  const pooled = config(names(14), { courts: 3, rounds: 6, pools: 2 });
  const before = built(pooled, [started(1)]);
  const after = built(pooled, [started(1), added(["Late"], 1)]);

  assert.deepEqual(after.draw.pools[0], before.draw.pools[0]);
  assert.ok(after.draw.pools[1].members.includes(14));
  assert.deepEqual(after.draw.pools[1].schedule.rounds.slice(0, 2), before.draw.pools[1].schedule.rounds.slice(0, 2));
  const courts = (live: RebuiltMixer, pool: number) =>
    new Set(live.draw.pools[pool].schedule.rounds.flatMap((round) => round.games.map((game) => game.court)));
  assert.deepEqual(courts(after, 1), courts(before, 1));
});

test("on a declared board the late arrival joins the Pool under its header", () => {
  const declared = config(["--- 3.5", ...names(6, "A"), "--- 4.0", ...names(5, "B")], { courts: 2, rounds: 5 });
  const after = built(declared, [added(["Late"], 1)]);
  assert.equal(after.draw.pools[1].label, "4.0");
  assert.equal(after.draw.pools[1].roster.at(-1)?.name, "Late");
  assert.ok(!after.draw.pools[0].members.includes(11));
});

test("a late arrival's Standings row says which Round they joined, and scores stay on their Games", () => {
  const after = built(nine, [
    event("score_entered", { round: 0, court: 0, score: [11, 7] }),
    started(2),
    added(["Late"]),
  ]);
  const late = after.standings[0].rows.find((row) => row.name === "Late");
  assert.equal(late?.joined, 3);
  assert.deepEqual(after.scores.get("0:0"), [11, 7]);
  const winners = after.draw.pools[0].schedule.rounds[0].games.find((game) => game.court === 0)?.sides[0] ?? [];
  for (const player of winners) {
    assert.equal(after.standings[0].rows.find((row) => row.players.includes(player))?.wins, 1);
  }
});

/** The Roster box "Run it again" opens with, as the organizer would read it. */
function nextWeek(cfg: string, events: MixerEvent[]): string {
  const payload = runItAgainPayload(cfg, events);
  assert.ok(payload, "the night has a Run it again payload");
  const board = decodeShareLink(payload);
  assert.ok(board, "the payload decodes");
  return rosterText(board.config.roster, board.config.headers ?? []);
}

test("Run it again keeps the night's late arrivals, and the Players who left early", () => {
  const night = nextWeek(nine, [started(1), added(["Late"]), left(2)]);
  assert.equal(night, [...names(9), "Late"].join("\n"));
});

test("Run it again leaves out an arrival taken off before their first Round", () => {
  assert.equal(runItAgainPayload(nine, [started(1), added(["Late"]), left(9)]), nine);
});

test("Run it again opens a night without changes on exactly its Config", () => {
  assert.equal(runItAgainPayload(nine, [started(1)]), nine);
});

test("Run it again puts a declared board's late arrival under their Pool's header, with a Marker kept", () => {
  const pool = (prefix: string, size: number) => [
    ...names(size, prefix).map((n) => `${n} M`),
    ...names(size, `${prefix}f`).map((n) => `${n} F`),
  ];
  const lines = ["--- 3.5", ...pool("A", 3), "--- 4.0", ...pool("B", 4)];
  const declared = config(lines, { courts: 3, rounds: 5, mixed: true });
  const night = nextWeek(declared, [added(["Late F"], 0)]);
  assert.deepEqual(night.split("\n").slice(0, 9), [...lines.slice(0, 7), "Late F", "--- 4.0"]);
});

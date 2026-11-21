import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  checkDreambreakerScore,
  dreambreakerSlots,
  rotationOf,
  seedTeams,
  slotStatuses,
  type DreambreakerResult,
} from "./dreambreakers.ts";

const TEAMS = ["t1", "t2", "t3", "t4"];

/** A final between two Teams: `a` scored `sa`, `b` scored `sb`. */
const r = (a: string, b: string, sa: number, sb: number): DreambreakerResult => ({ teamA: a, teamB: b, scoreA: sa, scoreB: sb });

describe("checkDreambreakerScore", () => {
  it("takes 21 to anything from 0 to 20, either way round", () => {
    assert.equal(checkDreambreakerScore(21, 20), null);
    assert.equal(checkDreambreakerScore(0, 21), null);
  });

  it("refuses 22-20, 21-21, and anything with no 21", () => {
    assert.notEqual(checkDreambreakerScore(22, 20), null);
    assert.notEqual(checkDreambreakerScore(21, 21), null);
    assert.notEqual(checkDreambreakerScore(15, 11), null);
    assert.notEqual(checkDreambreakerScore(21, -1), null);
    assert.notEqual(checkDreambreakerScore(21, 2.5), null);
  });
});

describe("dreambreakerSlots", () => {
  const slots = dreambreakerSlots(TEAMS);

  it("plays every Team against every other Team once", () => {
    assert.equal(slots.length, 6);
    const pairs = new Set(slots.map((slot) => [slot.teamA, slot.teamB].sort().join("-")));
    assert.equal(pairs.size, 6);
  });

  it("puts two at a time on courts 1 and 2, each Team in one at a time", () => {
    for (const turn of [1, 2, 3]) {
      const inTurn = slots.filter((slot) => slot.turn === turn);
      assert.deepEqual(inTurn.map((slot) => slot.court), [0, 1]);
      assert.equal(new Set(inTurn.flatMap((slot) => [slot.teamA, slot.teamB])).size, 4);
    }
  });
});

describe("slotStatuses", () => {
  const slots = dreambreakerSlots(TEAMS);

  it("is On now for the first unfinished pair of games, Up next after, Later beyond", () => {
    assert.deepEqual(slotStatuses(slots, []), ["now", "now", "next", "next", "later", "later"]);
  });

  it("moves on as finals land, a finished game in an open turn showing Final", () => {
    const first = slots[0];
    const statuses = slotStatuses(slots, [r(first.teamA, first.teamB, 21, 3)]);
    assert.deepEqual(statuses, ["final", "now", "next", "next", "later", "later"]);
  });

  it("is all Final once the six are in", () => {
    const all = slots.map((slot) => r(slot.teamA, slot.teamB, 21, 10));
    assert.deepEqual(slotStatuses(slots, all), Array(6).fill("final"));
  });
});

describe("seedTeams", () => {
  it("ranks by Dreambreakers won", () => {
    const seeds = seedTeams(TEAMS, [
      r("t1", "t2", 21, 5),
      r("t3", "t4", 21, 5),
      r("t1", "t3", 21, 5),
      r("t2", "t4", 21, 5),
      r("t1", "t4", 21, 5),
      r("t2", "t3", 21, 5),
    ]);
    assert.deepEqual(seeds.map((seed) => seed.teamId), ["t1", "t2", "t3", "t4"]);
    assert.deepEqual(seeds.map((seed) => seed.decidedBy), [null, "wins", "wins", "wins"]);
    assert.deepEqual(seeds.map((seed) => seed.wins), [3, 2, 1, 0]);
  });

  it("breaks a two-Team tie on wins head-to-head, even against a better point difference", () => {
    // t1 and t2 both win 2. t2 beat t1, but t1 crushed the others.
    const seeds = seedTeams(TEAMS, [
      r("t1", "t2", 20, 21),
      r("t3", "t4", 21, 5),
      r("t1", "t3", 21, 0),
      r("t2", "t4", 19, 21),
      r("t1", "t4", 21, 0),
      r("t2", "t3", 21, 19),
    ]);
    assert.deepEqual(seeds.slice(0, 2).map((seed) => seed.teamId), ["t2", "t1"]);
    assert.equal(seeds[1].decidedBy, "headToHead");
  });

  it("breaks a three-way tie on wins by point difference, then a pair left level head-to-head", () => {
    // t4 loses all three. t1 beats t2, t2 beats t3, t3 beats t1: each wins 2.
    const seeds = seedTeams(TEAMS, [
      r("t1", "t2", 21, 10), // t1 +11
      r("t2", "t3", 21, 10), // t2 +11
      r("t3", "t1", 21, 15), // t3 +6, t1 -6
      r("t1", "t4", 21, 20), // t1 +1
      r("t2", "t4", 21, 17), // t2 +4
      r("t3", "t4", 21, 19), // t3 +2
    ]);
    // Point difference: t1 = 11 - 6 + 1 = 6, t2 = -11 + 11 + 4 = 4, t3 = -11 + 6 + 2 = -3.
    assert.deepEqual(seeds.map((seed) => seed.teamId), ["t1", "t2", "t3", "t4"]);
    assert.deepEqual(seeds.map((seed) => seed.decidedBy), [null, "pointDiff", "pointDiff", "wins"]);
  });

  it("decides on total points when wins, head-to-head and point difference can't", () => {
    // t1: beat t3 21-10 (+11), lost t4 10-21 (-11): 1 win, diff 0, 31 points.
    // t2: beat t4 21-5 (+16), lost t3 5-21 (-16): 1 win, diff 0, 26 points.
    const seeds = seedTeams(TEAMS, [r("t1", "t3", 21, 10), r("t4", "t1", 21, 10), r("t2", "t4", 21, 5), r("t3", "t2", 21, 5)]);
    const t1 = seeds.findIndex((seed) => seed.teamId === "t1");
    const t2 = seeds.findIndex((seed) => seed.teamId === "t2");
    assert.ok(t1 < t2);
    assert.equal(seeds[t2].decidedBy, "points");
  });

  it("asks for the Organizer's call on a full tie once all six are in, and takes it", () => {
    // t1 beats t2 beats t3 beats t1, all 21-10, and all three beat t4: level on every count.
    const all = [
      r("t1", "t2", 21, 10),
      r("t2", "t3", 21, 10),
      r("t3", "t1", 21, 10),
      r("t1", "t4", 21, 10),
      r("t2", "t4", 21, 10),
      r("t3", "t4", 21, 10),
    ];
    const seeds = seedTeams(TEAMS, all);
    assert.deepEqual(seeds.map((seed) => seed.decidedBy), [null, "unresolved", "unresolved", "wins"]);
    assert.deepEqual(seeds.map((seed) => seed.teamId).slice(0, 3), ["t1", "t2", "t3"]);

    const called = seedTeams(TEAMS, all, ["t3", "t1", "t2"]);
    assert.deepEqual(called.map((seed) => seed.teamId), ["t3", "t1", "t2", "t4"]);
    assert.deepEqual(called.map((seed) => seed.decidedBy), [null, "organizer", "organizer", "wins"]);
  });

  it("calls a tie level, not unresolved, while Dreambreakers are still to play", () => {
    const seeds = seedTeams(TEAMS, []);
    assert.deepEqual(seeds.map((seed) => seed.decidedBy), [null, "level", "level", "level"]);
  });
});

describe("rotationOf", () => {
  const p = (id: string, dupr: number | null, rotation: number | null = null) => ({ id, dupr, rotation });

  it("starts by DUPR, highest first, blanks last", () => {
    assert.deepEqual(
      rotationOf([p("a", 3.5), p("b", null), p("c", 4.2), p("d", 3.9)]).map((player) => player.id),
      ["c", "d", "a", "b"],
    );
  });

  it("follows an Organizer's order once one is set", () => {
    assert.deepEqual(
      rotationOf([p("a", 3.5, 2), p("b", null, 1), p("c", 4.2, 3)]).map((player) => player.id),
      ["b", "a", "c"],
    );
  });
});

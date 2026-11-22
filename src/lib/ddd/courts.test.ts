import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { courtBoard, courtTurns, placeGames, placeMatchup, withStatuses, type StoredCourtPlan } from "./courts.ts";
import type { Lineup, LineupGame } from "./lineup.ts";
import type { Matchup, MatchupKey } from "./matchups.ts";

/** A Team's Lineup with every slot named, so a shared player is the same id twice. */
const lineup = (mens: [string, string], womens: [string, string], mixed1: [string, string], mixed2: [string, string]): Lineup => ({
  mens,
  womens,
  mixed1,
  mixed2,
});

/** Six players: no one plays twice in the doubles Games that go together. */
const EVEN_A = lineup(["a1", "a2"], ["a5", "a6"], ["a3", "a5"], ["a4", "a6"]);
const EVEN_B = lineup(["b1", "b2"], ["b5", "b6"], ["b3", "b5"], ["b4", "b6"]);

describe("courtTurns: a Matchup's four Games in Court turns", () => {
  it("puts men's and women's doubles first, then the mixed Games", () => {
    assert.deepEqual(courtTurns(EVEN_A, EVEN_B), [
      ["mens", "womens"],
      ["mixed1", "mixed2"],
    ]);
  });

  it("takes whichever split works when men's and women's doubles share a player", () => {
    // Eight players, each once.
    const a = lineup(["a1", "a2"], ["a5", "a6"], ["a3", "a7"], ["a4", "a8"]);
    // b2 plays men's and women's doubles, and b6 women's doubles and Mixed 2.
    const b = lineup(["b1", "b2"], ["b2", "b6"], ["b3", "b5"], ["b4", "b6"]);
    assert.deepEqual(courtTurns(a, b), [
      ["mens", "mixed2"],
      ["womens", "mixed1"],
    ]);
  });

  it("leaves Games playing alone when a woman plays women's doubles and both mixed", () => {
    // a5 is in women's doubles, Mixed 1 and Mixed 2: those three can never share a Court turn.
    const a = lineup(["a1", "a2"], ["a5", "a6"], ["a3", "a5"], ["a4", "a5"]);
    assert.deepEqual(courtTurns(a, EVEN_B), [["mens", "womens"], ["mixed1"], ["mixed2"]]);
  });

  it("uses the preferred split while a Lineup is missing", () => {
    assert.deepEqual(courtTurns(null, EVEN_B), [
      ["mens", "womens"],
      ["mixed1", "mixed2"],
    ]);
  });
});

describe("placeGames: each Game's court", () => {
  const SPLIT: LineupGame[][] = [
    ["mens", "womens"],
    ["mixed1", "mixed2"],
  ];

  it("puts Seed 1 v 4 and the Playoff for 1st on courts 1-2, the others on courts 3-4", () => {
    const courtsOf = (key: MatchupKey) => placeGames(key, SPLIT, null, 4).map((p) => `${p.game}:${p.turn}:${p.court}`);
    const top = ["mens:0:0", "womens:0:1", "mixed1:1:0", "mixed2:1:1"];
    const bottom = ["mens:0:2", "womens:0:3", "mixed1:1:2", "mixed2:1:3"];
    assert.deepEqual(courtsOf("round2-1v4"), top);
    assert.deepEqual(courtsOf("playoff-1st"), top);
    assert.deepEqual(courtsOf("round2-2v3"), bottom);
    assert.deepEqual(courtsOf("playoff-3rd"), bottom);
  });

  it("plays a Game that is alone on its Matchup's first court", () => {
    const placed = placeGames("round2-2v3", [["mens", "womens"], ["mixed1"], ["mixed2"]], null, 4);
    assert.deepEqual(
      placed.map((p) => [p.game, p.turn, p.court]),
      [
        ["mens", 0, 2],
        ["womens", 0, 3],
        ["mixed1", 1, 2],
        ["mixed2", 2, 2],
      ],
    );
  });

  it("follows an Organizer's swap of the Court turns and a Game moved to another court", () => {
    const placed = placeGames("round2-1v4", SPLIT, { swapped: true, moves: { womens: 3 } }, 4);
    assert.deepEqual(
      placed.map((p) => [p.game, p.turn, p.court]),
      [
        ["mixed1", 0, 0],
        ["mixed2", 0, 1],
        ["mens", 1, 0],
        ["womens", 1, 3],
      ],
    );
  });

  it("wraps onto the courts there are when a DDD has fewer than four", () => {
    assert.deepEqual(
      placeGames("round2-2v3", SPLIT, null, 2).map((p) => p.court),
      [0, 1, 0, 1],
    );
  });
});

describe("courtBoard: what each court has on now and up next", () => {
  const PLACED = placeGames("round2-1v4", [["mens", "womens"], ["mixed1", "mixed2"]], null, 4);

  it("shows the first Court turn on now and the second up next", () => {
    const board = courtBoard(4, withStatuses(PLACED, []));
    assert.deepEqual(
      board.map((court) => [court.now?.game ?? null, court.next?.game ?? null]),
      [
        ["mens", "mixed1"],
        ["womens", "mixed2"],
        [null, null],
        [null, null],
      ],
    );
  });

  it("moves on to the second Court turn once the first is final", () => {
    const board = courtBoard(4, withStatuses(PLACED, ["mens", "womens"]));
    assert.deepEqual(
      board.slice(0, 2).map((court) => [court.now?.game ?? null, court.next?.game ?? null]),
      [
        ["mixed1", null],
        ["mixed2", null],
      ],
    );
  });

  it("keeps a Court turn on now until both its Games are final", () => {
    const statuses = withStatuses(PLACED, ["mens"]);
    assert.deepEqual(
      statuses.map((p) => [p.game, p.status]),
      [
        ["mens", "final"],
        ["womens", "now"],
        ["mixed1", "next"],
        ["mixed2", "next"],
      ],
    );
  });
});

describe("placeMatchup: a Matchup on the courts", () => {
  const matchup = (scored: LineupGame[]): Matchup => ({
    key: "round2-2v3",
    a: "t2",
    b: "t3",
    games: (["mens", "womens", "mixed1", "mixed2"] as const).map((game) => ({
      game,
      spread: { lower: "b", points: 5.5 },
      score: scored.includes(game) ? [11, 4] : null,
      result: null,
    })),
    outcome: null,
  });

  it("takes the Organizer's plan for the pairing whichever way round it is stored", () => {
    const plans: StoredCourtPlan[] = [{ teamA: "t3", teamB: "t2", swapped: true, moves: {} }];
    const placed = placeMatchup(matchup([]), [EVEN_A, EVEN_B], plans, 4);
    assert.deepEqual(
      placed.map((p) => [p.game, p.court, p.status]),
      [
        ["mixed1", 2, "now"],
        ["mixed2", 3, "now"],
        ["mens", 2, "next"],
        ["womens", 3, "next"],
      ],
    );
  });

  it("reads the finals off the scores", () => {
    const placed = placeMatchup(matchup(["mens", "womens"]), [EVEN_A, EVEN_B], [], 4);
    assert.deepEqual(
      placed.map((p) => p.status),
      ["final", "final", "now", "now"],
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { seedTeams, type DreambreakerResult } from "./dreambreakers.ts";
import { LINEUP_GAMES, type LineupGame } from "./lineup.ts";
import {
  checkGameScore,
  decideMatchup,
  doublesMatchups,
  finalPlaces,
  shotTotals,
  spreadResult,
  type GameFinal,
  type MatchupCall,
} from "./matchups.ts";
import type { Side, SpreadRow } from "./spreads.ts";

/** A final Game: the score, and which side is the lower-rated Pair against what Spread. */
const final = (score: [number, number], lower: Side, spread: number) => ({ score, result: spreadResult(score, lower, spread) });

/** 2-2 with side a's margins +2.5, +1.5, -0.5, -1.5: +2 overall. */
const twoAllOnMargin = [
  final([8, 11], "a", 5.5),
  final([6, 11], "a", 4.5),
  final([11, 4], "b", 3.5),
  final([11, 7], "b", 5.5),
];

/** 2-2 with side a's margins +2.5, +1.5, -3.5, -0.5: level at 0. Raw points 27 to 40. */
const twoAllLevel = [
  final([8, 11], "a", 5.5),
  final([6, 11], "a", 4.5),
  final([2, 11], "a", 5.5),
  final([11, 7], "b", 6.5),
];

describe("decideMatchup: the Team with more Spread winners", () => {
  it("is undecided until all four Games are final", () => {
    assert.equal(decideMatchup(twoAllOnMargin.slice(0, 3), null), null);
  });

  it("goes to the side with 3 Spread winners", () => {
    const games = [...twoAllOnMargin.slice(0, 3), final([11, 9], "b", 9.5)];
    assert.deepEqual(decideMatchup(games, null), {
      winner: "a",
      rule: "spreadWins",
      wins: [3, 1],
      margin: 2.5 + 1.5 - 0.5 + 0.5,
      points: [36, 35],
      reason: null,
    });
  });

  it("decides a 2-2 by total Spread margin", () => {
    const outcome = decideMatchup(twoAllOnMargin, null)!;
    assert.equal(outcome.winner, "a");
    assert.equal(outcome.rule, "margin");
    assert.equal(outcome.margin, 2);
  });

  it("drops a 2-2 level on margin (+2.5 +1.5 -3.5 -0.5 = 0) to raw points", () => {
    const outcome = decideMatchup(twoAllLevel, null)!;
    assert.equal(outcome.margin, 0);
    assert.deepEqual(outcome.points, [27, 40]);
    assert.equal(outcome.winner, "b");
    assert.equal(outcome.rule, "points");
  });

  it("leaves a 2-2 level on margin and points to an Organizer", () => {
    const games = [final([11, 8], "b", 5.5), final([11, 6], "b", 4.5), final([8, 11], "a", 5.5), final([6, 11], "a", 4.5)];
    assert.deepEqual(decideMatchup(games, null), {
      winner: null,
      rule: "unresolved",
      wins: [2, 2],
      margin: 0,
      points: [36, 36],
      reason: null,
    });
  });

  it("lets an Organizer's call override any 2-2, with the reason", () => {
    const outcome = decideMatchup(twoAllOnMargin, { winner: "b", reason: "Shots decide it, the group says" })!;
    assert.equal(outcome.winner, "b");
    assert.equal(outcome.rule, "organizer");
    assert.equal(outcome.reason, "Shots decide it, the group says");
  });

  it("ignores a call on a Matchup that isn't 2-2", () => {
    const games = [...twoAllOnMargin.slice(0, 3), final([11, 9], "b", 9.5)];
    assert.equal(decideMatchup(games, { winner: "b", reason: "x" })!.rule, "spreadWins");
  });
});

describe("checkGameScore: side-out to 11, win by 2", () => {
  it("takes 11 to anything up to 9, and a 2-point win past 11", () => {
    for (const [a, b] of [
      [11, 0],
      [9, 11],
      [12, 10],
      [13, 11],
      [11, 13],
      [20, 18],
    ]) {
      assert.equal(checkGameScore(a, b), null, `${a}-${b}`);
    }
  });

  it("refuses 11-10: not won by 2", () => {
    assert.match(checkGameScore(11, 10)!, /win by 2/i);
  });

  it("refuses a Game that would have ended sooner, and one short of 11", () => {
    assert.match(checkGameScore(14, 10)!, /13-11|2-point lead/);
    assert.match(checkGameScore(10, 8)!, /11/);
  });

  it("refuses what isn't a whole, positive score", () => {
    assert.notEqual(checkGameScore(11.5, 3), null);
    assert.notEqual(checkGameScore(11, -1), null);
    assert.notEqual(checkGameScore(Number.NaN, 3), null);
  });
});

describe("spreadResult: one Game against its Spread", () => {
  it("11-6 against 5.5: the lower-rated Pair lost the Game but is the Spread winner, 1 shot to the other Team", () => {
    // Side b is the lower-rated Pair and scored 6.
    assert.deepEqual(spreadResult([11, 6], "b", 5.5), { spreadWinner: "b", margin: -0.5, shots: 1, shotsOn: "a" });
  });

  it("11-3 against 5.5: a gap of 2.5 is 3 shots on the lower-rated Pair's Team", () => {
    assert.deepEqual(spreadResult([11, 3], "b", 5.5), { spreadWinner: "a", margin: 2.5, shots: 3, shotsOn: "b" });
  });

  it("13-11 measures the lower-rated Pair's points, not the 11", () => {
    // Lower-rated Pair (a) won 13-11 against 7.5: it beat the Spread by 5.5, so 6 shots on b.
    assert.deepEqual(spreadResult([13, 11], "a", 7.5), { spreadWinner: "a", margin: 5.5, shots: 6, shotsOn: "b" });
    // Lower-rated Pair (b) lost 11-13 against 9.5: 11 still beats 9.5, so 2 shots on a.
    assert.deepEqual(spreadResult([13, 11], "b", 9.5), { spreadWinner: "b", margin: -1.5, shots: 2, shotsOn: "a" });
  });

  it("puts at least one shot on someone's count", () => {
    assert.equal(spreadResult([11, 5], "b", 5.5).shots, 1);
  });
});

// ---- Round 2 and the Playoff ---------------------------------------------------

const TEAMS = ["t1", "t2", "t3", "t4"];

/** Seeds t3, t1, t4, t2: t3 wins all three, t1 two, t4 one. Round 2 is t3 v t2 and t1 v t4. */
const ROUND_1: DreambreakerResult[] = [
  { teamA: "t1", teamB: "t3", scoreA: 15, scoreB: 21 },
  { teamA: "t2", teamB: "t3", scoreA: 10, scoreB: 21 },
  { teamA: "t3", teamB: "t4", scoreA: 21, scoreB: 12 },
  { teamA: "t1", teamB: "t2", scoreA: 21, scoreB: 9 },
  { teamA: "t1", teamB: "t4", scoreA: 21, scoreB: 17 },
  { teamA: "t2", teamB: "t4", scoreA: 18, scoreB: 21 },
];
const SEEDS = seedTeams(TEAMS, ROUND_1);

/** Rows are stored with the Team earlier in the roster as team A, as the database stores them. */
const inOrder = (x: string, y: string): [string, string] => (TEAMS.indexOf(x) < TEAMS.indexOf(y) ? [x, y] : [y, x]);

/** `winner` takes all four Games: its Pair is the lower-rated one, scoring 11 against 5.5, so 6 shots each on `loser`. */
function sweep(winner: string, loser: string): { spreads: SpreadRow[]; games: GameFinal[] } {
  const [teamA, teamB] = inOrder(winner, loser);
  const lower: Side = teamA === winner ? "a" : "b";
  return {
    spreads: LINEUP_GAMES.map((game) => ({ teamA, teamB, game, lower, points: 5.5, sig: "" })),
    games: LINEUP_GAMES.map((game) => ({
      teamA,
      teamB,
      game,
      scoreA: teamA === winner ? 11 : 5,
      scoreB: teamA === winner ? 5 : 11,
    })),
  };
}

function merge(...parts: { spreads: SpreadRow[]; games: GameFinal[] }[]) {
  return { spreads: parts.flatMap((part) => part.spreads), games: parts.flatMap((part) => part.games) };
}

describe("doublesMatchups: Round 2 and the Playoff", () => {
  it("waits for the Seeding to be final", () => {
    const seeds = seedTeams(TEAMS, ROUND_1.slice(0, 5));
    assert.deepEqual(doublesMatchups(seeds, { spreads: [], games: [], calls: [] }), []);
  });

  it("plays Seed 1 v 4 and Seed 2 v 3, read from the higher seed's side", () => {
    const spreads: SpreadRow[] = [{ teamA: "t2", teamB: "t3", game: "mens", lower: "a", points: 5.5, sig: "" }];
    const games: GameFinal[] = [
      { teamA: "t2", teamB: "t3", game: "mens", scoreA: 6, scoreB: 11 },
      // Scored, but no Spread yet: no Spread winner and no shots.
      { teamA: "t2", teamB: "t3", game: "womens", scoreA: 11, scoreB: 2 },
    ];
    const [top, bottom, ...rest] = doublesMatchups(SEEDS, { spreads, games, calls: [] });
    assert.equal(rest.length, 0, "no Playoff before Round 2 is decided");
    assert.deepEqual([top.key, top.a, top.b], ["round2-1v4", "t3", "t2"]);
    assert.deepEqual([bottom.key, bottom.a, bottom.b], ["round2-2v3", "t1", "t4"]);

    const mens = top.games.find((each) => each.game === "mens")!;
    assert.deepEqual(mens.spread, { lower: "b", points: 5.5 });
    assert.deepEqual(mens.score, [11, 6]);
    assert.deepEqual(mens.result, { spreadWinner: "b", margin: -0.5, shots: 1, shotsOn: "a" });

    const womens = top.games.find((each) => each.game === "womens")!;
    assert.deepEqual([womens.spread, womens.score, womens.result], [null, [2, 11], null]);
    assert.equal(top.outcome, null);
    assert.deepEqual(shotTotals(TEAMS, [top, bottom]), { t1: 0, t2: 0, t3: 1, t4: 0 });
  });

  it("takes an Organizer's call on a 2-2 by Team", () => {
    const [teamA, teamB] = inOrder("t1", "t4");
    const spreads = LINEUP_GAMES.map((game): SpreadRow => ({ teamA, teamB, game, lower: "a", points: 5.5, sig: "" }));
    // t1 (team A, the lower-rated Pair every time) beats the Spread in two Games by 0.5 and misses it in two by 0.5.
    const scores: Record<LineupGame, number> = { mens: 6, womens: 6, mixed1: 5, mixed2: 5 };
    const games = LINEUP_GAMES.map((game): GameFinal => ({ teamA, teamB, game, scoreA: scores[game], scoreB: 11 }));
    const calls: MatchupCall[] = [{ teamA, teamB, winner: "t4", reason: "Coin toss at the court" }];
    const bottom = doublesMatchups(SEEDS, { spreads, games, calls })[1];
    assert.deepEqual(bottom.outcome, {
      winner: "b",
      rule: "organizer",
      wins: [2, 2],
      margin: 0,
      points: [22, 44],
      reason: "Coin toss at the court",
    });
  });

  it("sets up the Playoff from Round 2, then the Final places and every Team's shots", () => {
    const round2 = merge(sweep("t3", "t2"), sweep("t1", "t4"));
    const before = doublesMatchups(SEEDS, { ...round2, calls: [] });
    const [first, third] = before.slice(2);
    assert.deepEqual([first.key, first.a, first.b], ["playoff-1st", "t3", "t1"]);
    assert.deepEqual([third.key, third.a, third.b], ["playoff-3rd", "t2", "t4"]);
    assert.equal(finalPlaces(before), null);

    const all = merge(round2, sweep("t1", "t3"), sweep("t2", "t4"));
    const after = doublesMatchups(SEEDS, { ...all, calls: [] });
    assert.deepEqual(finalPlaces(after), ["t1", "t3", "t2", "t4"]);
    assert.deepEqual(shotTotals(TEAMS, after), { t1: 0, t2: 24, t3: 24, t4: 48 });
  });
});

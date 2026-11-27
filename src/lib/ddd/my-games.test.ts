import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Lineup, LineupGame } from "./lineup.ts";
import { spreadResult, type Matchup, type MatchupGame } from "./matchups.ts";
import { myGames, type TeamLineup } from "./my-games.ts";

const players = (prefix: string) => Array.from({ length: 6 }, (_, i) => ({ id: `${prefix}${i + 1}`, name: `${prefix.toUpperCase()}${i + 1}` }));

// a5 plays women's doubles and Mixed 1; b-side's lower-rated Pair is the Underdog in every Game.
const LINEUP_A: Lineup = { mens: ["a1", "a2"], womens: ["a5", "a6"], mixed1: ["a3", "a5"], mixed2: ["a4", "a6"] };
const LINEUP_B: Lineup = { mens: ["b1", "b2"], womens: ["b5", "b6"], mixed1: ["b3", "b5"], mixed2: ["b4", "b6"] };
const TEAMS: TeamLineup[] = [
  { id: "A", name: "Team A", players: players("a"), lineup: LINEUP_A },
  { id: "B", name: "Team B", players: players("b"), lineup: LINEUP_B },
];

const game = (g: LineupGame, score: [number, number] | null = null): MatchupGame => ({
  game: g,
  spread: { lower: "b", points: 5.5 },
  score,
  result: score ? spreadResult(score, "b", 5.5) : null,
});

// Men's 11-6 is final: B's Pair scored 6 against 5.5, so B beat the forecast.
const MATCHUP: Matchup = {
  key: "round2-1v4",
  a: "A",
  b: "B",
  games: [game("mens", [11, 6]), game("womens"), game("mixed1"), game("mixed2")],
  outcome: null,
};

describe("myGames: one player's doubles Games", () => {
  it("lists a5's two Games, on now first, with partner, opponents and the forecast from their side", () => {
    const games = myGames("a5", TEAMS, [MATCHUP], [], 4);
    assert.deepEqual(
      games.map((g) => [g.game, g.status, g.court, g.partners, g.opponents, g.opponentTeam, g.forecast]),
      [
        ["womens", "now", 1, ["A6"], ["B5", "B6"], "Team B", { lower: false, points: 5.5 }],
        ["mixed1", "next", 0, ["A3"], ["B3", "B5"], "Team B", { lower: false, points: 5.5 }],
      ],
    );
  });

  it("gives the Underdog's side lower: true, and a final from their side, finals last", () => {
    const games = myGames("b1", TEAMS, [MATCHUP], [], 4);
    assert.equal(games.length, 1);
    assert.deepEqual(
      { status: games[0].status, forecast: games[0].forecast, score: games[0].score, beat: games[0].beat },
      { status: "final", forecast: { lower: true, points: 5.5 }, score: [6, 11], beat: true },
    );
    assert.equal(myGames("a1", TEAMS, [MATCHUP], [], 4)[0].beat, false);
  });

  it("is empty for a player in no Matchup yet, or whose Team has no Lineup", () => {
    assert.deepEqual(myGames("nobody", TEAMS, [MATCHUP], [], 4), []);
    const noLineup = [TEAMS[0], { ...TEAMS[1], lineup: null }];
    assert.deepEqual(myGames("b1", noLineup, [MATCHUP], [], 4), []);
  });
});

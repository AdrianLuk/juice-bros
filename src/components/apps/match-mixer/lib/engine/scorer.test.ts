import assert from "node:assert/strict";
import test from "node:test";

import { parseRoster } from "./roster.ts";
import {
  BYE_IMBALANCE_WEIGHT,
  OPPONENT_REPEAT_WEIGHT,
  PARTNER_REPEAT_WEIGHT,
  emptyTally,
  recordRound,
  scoreRounds,
  scoreSchedule,
  tallyRounds,
} from "./scorer.ts";
import type { Config, Round, Schedule, Team } from "./types.ts";

function config(n: number, courts = Math.floor(n / 4)): Config {
  return {
    roster: parseRoster(
      Array.from({ length: n }, (_, i) => `Player ${i + 1}`).join("\n"),
    ),
    courts,
    seed: 1,
  };
}

/** Each argument is one Game: two Teams facing each other. */
function round(...games: [Team, Team][]): Round {
  return {
    games: games.map((teams, court) => ({ court, teams })),
    byes: [],
  };
}

function schedule(...rounds: Round[]): Schedule {
  return { source: "generated", rounds };
}

test("a balanced pair of rounds scores zero", () => {
  const built = schedule(
    round([[0, 1], [2, 3]], [[4, 5], [6, 7]]),
    round([[0, 2], [1, 3]], [[4, 6], [5, 7]]),
  );
  assert.equal(scoreSchedule(built, config(8)).cost, 0);
});

test("a repeated partnership costs the partner weight", () => {
  const built = schedule(
    round([[0, 1], [2, 3]], [[4, 5], [6, 7]]),
    round([[0, 1], [4, 6]], [[2, 5], [3, 7]]),
  );
  const score = scoreSchedule(built, config(8));

  assert.equal(score.repeatedPartnerPairs, 1);
  assert.equal(score.maxPartnerCount, 2);
  assert.equal(score.partnerMatrix[0][1], 2);
  assert.equal(score.cost, PARTNER_REPEAT_WEIGHT);
});

test("facing the same person twice is free", () => {
  // Four players over three rounds is a whole whist tournament: everyone
  // partners everyone once and faces everyone exactly twice.
  const built = schedule(
    round([[0, 1], [2, 3]]),
    round([[0, 2], [1, 3]]),
    round([[0, 3], [1, 2]]),
  );
  const score = scoreSchedule(built, config(4));

  assert.equal(score.maxOpponentCount, 2);
  assert.equal(score.cost, 0);
});

test("facing the same person a third time costs the opponent weight", () => {
  // The first four rounds of the published n=8 table in
  // briefs/juice-bros-round-robin-brief.md. Partners are all distinct, so the
  // only thing the Scorer can catch is 0-1, 2-3, 4-5 and 6-7 meeting a third
  // time — which is exactly the error that table has, and why ADR 0002 says
  // no Table is trusted without this function.
  const built = schedule(
    round([[0, 1], [2, 3]], [[4, 5], [6, 7]]),
    round([[0, 2], [1, 3]], [[4, 6], [5, 7]]),
    round([[0, 3], [1, 2]], [[4, 7], [5, 6]]),
    round([[0, 4], [1, 5]], [[2, 6], [3, 7]]),
  );
  const score = scoreSchedule(built, config(8));

  assert.equal(score.repeatedPartnerPairs, 0);
  assert.equal(score.byeSpread, 0);
  assert.equal(score.maxOpponentCount, 3);
  assert.equal(score.cost, 4 * OPPONENT_REPEAT_WEIGHT);
});

test("an uneven bye spread costs the bye weight per game of difference", () => {
  // Players 4 and 5 sit out both rounds while 6 and 7 play both.
  const built: Schedule = {
    source: "generated",
    rounds: [
      { games: [{ court: 0, teams: [[0, 1], [6, 7]] }], byes: [2, 3, 4, 5] },
      { games: [{ court: 0, teams: [[2, 3], [6, 7]] }], byes: [0, 1, 4, 5] },
    ],
  };
  const score = scoreSchedule(built, config(8, 1));

  assert.deepEqual(score.gamesPlayed, [1, 1, 1, 1, 0, 0, 2, 2]);
  assert.deepEqual(score.byes, [1, 1, 1, 1, 2, 2, 0, 0]);
  assert.equal(score.byeSpread, 2);
  // 6 and 7 partner twice, and face each of 0-3 once, so only the repeat lands.
  assert.equal(score.cost, PARTNER_REPEAT_WEIGHT + 2 * BYE_IMBALANCE_WEIGHT);
});

test("an empty schedule is scoreless rather than a crash", () => {
  const score = scoreSchedule(schedule(), config(8));
  assert.equal(score.cost, 0);
  assert.equal(score.byeSpread, 0);
  assert.deepEqual(score.gamesPlayed, new Array(8).fill(0));
});

test("the matrices are symmetric and their diagonals are inert", () => {
  const built = schedule(round([[0, 1], [2, 3]], [[4, 5], [6, 7]]));
  const { partnerMatrix, opponentMatrix } = scoreSchedule(built, config(8));

  for (let i = 0; i < 8; i++) {
    assert.equal(partnerMatrix[i][i], 0, `partner diagonal ${i}`);
    assert.equal(opponentMatrix[i][i], 0, `opponent diagonal ${i}`);
    for (let j = 0; j < 8; j++) {
      assert.equal(partnerMatrix[i][j], partnerMatrix[j][i]);
      assert.equal(opponentMatrix[i][j], opponentMatrix[j][i]);
    }
  }
});

test("scoreRounds and scoreSchedule read the same schedule the same way", () => {
  // The generator scores bare Rounds mid-search and the UI scores the finished
  // Schedule; a disagreement between the two would mean the search optimised
  // for something other than what gets reported.
  const built = schedule(
    round([[0, 1], [2, 3]], [[4, 5], [6, 7]]),
    round([[0, 1], [4, 6]], [[2, 5], [3, 7]]),
  );
  assert.deepEqual(scoreRounds(built.rounds, 8), scoreSchedule(built, config(8)));
});

test("byes that go round exactly have to land dead level to count as even", () => {
  // Eight players, one court, four sitting out: two rounds is exactly one bye
  // each, so a spread of anything is a real failure and not arithmetic.
  const level: Schedule = {
    source: "generated",
    rounds: [
      { games: [{ court: 0, teams: [[0, 1], [2, 3]] }], byes: [4, 5, 6, 7] },
      { games: [{ court: 0, teams: [[4, 5], [6, 7]] }], byes: [0, 1, 2, 3] },
    ],
  };
  const levelScore = scoreSchedule(level, config(8, 1));
  assert.equal(levelScore.byeSpread, 0);
  assert.equal(levelScore.byesRotateEvenly, true);

  const lopsided: Schedule = {
    source: "generated",
    rounds: [
      { games: [{ court: 0, teams: [[0, 1], [2, 3]] }], byes: [4, 5, 6, 7] },
      { games: [{ court: 0, teams: [[0, 2], [1, 3]] }], byes: [4, 5, 6, 7] },
    ],
  };
  const lopsidedScore = scoreSchedule(lopsided, config(8, 1));
  assert.equal(lopsidedScore.byeSpread, 2);
  assert.equal(lopsidedScore.byesRotateEvenly, false);
});

test("a bye count that cannot divide the roster still rotates evenly", () => {
  // Five players, one court: three rounds is three byes among five, so
  // somebody has to sit twice. That is arithmetic, not an imbalance, and the
  // summary line is entitled to say the byes rotate evenly.
  const built: Schedule = {
    source: "generated",
    rounds: [
      { games: [{ court: 0, teams: [[0, 1], [2, 3]] }], byes: [4] },
      { games: [{ court: 0, teams: [[0, 2], [1, 4]] }], byes: [3] },
      { games: [{ court: 0, teams: [[0, 4], [1, 3]] }], byes: [2] },
    ],
  };
  const score = scoreSchedule(built, config(5, 1));

  assert.deepEqual(score.byes, [0, 0, 1, 1, 1]);
  assert.equal(score.byeSpread, 1);
  assert.equal(score.byesRotateEvenly, true);
  // It still costs, because the generator should prefer a schedule without it
  // where one exists.
  assert.equal(score.cost, BYE_IMBALANCE_WEIGHT);
});

test("recordRound adds to a tally exactly as tallying from scratch would", () => {
  const first = round([[0, 1], [2, 3]], [[4, 5], [6, 7]]);
  const second = round([[0, 2], [1, 3]], [[4, 6], [5, 7]]);

  const incremental = emptyTally(8);
  recordRound(incremental, first);
  recordRound(incremental, second);

  assert.deepEqual(incremental, tallyRounds([first, second], 8));
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  BEST_OF_OPTIONS,
  buildConfig,
  DEFAULT_OPTIONS,
  describeConfig,
  POINTS_OPTIONS,
  sideSwitchScore,
  WIN_BY_OPTIONS,
  type MatchOptions,
} from "./formats.ts";
import { gamesToWin, reduceMatch } from "./reduce.ts";
import type { MatchEvent, PlayerPair, TeamId } from "./types.ts";

const players: Record<TeamId, PlayerPair> = {
  A: ["Amy", "Alex"],
  B: ["Ben", "Bea"],
};

test("the toggles offer three point targets, three game counts, two margins", () => {
  assert.deepEqual([...POINTS_OPTIONS], [11, 15, 21]);
  assert.deepEqual([...BEST_OF_OPTIONS], [1, 3, 5]);
  assert.deepEqual([...WIN_BY_OPTIONS], [1, 2]);
});

test("defaults are doubles side-out, one game to 15", () => {
  assert.deepEqual(DEFAULT_OPTIONS, {
    doubles: true,
    scoring: "sideout",
    pointsToWin: 15,
    bestOf: 1,
    winBy: 1,
    freezeRule: true,
  });
});

test("sides switch at the halfway mark of whatever the game is to", () => {
  assert.equal(sideSwitchScore(11), 6);
  assert.equal(sideSwitchScore(15), 8);
  assert.equal(sideSwitchScore(21), 11);
});

test("buildConfig carries the toggles through and derives the rest", () => {
  const config = buildConfig(
    { doubles: false, scoring: "rally", pointsToWin: 21, bestOf: 5 },
    players
  );
  assert.equal(config.doubles, false);
  assert.equal(config.scoring, "rally");
  assert.equal(config.pointsToWin, 21);
  assert.equal(config.bestOf, 5);
  assert.equal(config.switchAtScore, 11, "derived from the point target");
  assert.equal(config.winBy, 1, "rally scoring wins by 1");
  // Rules the ref doesn't pick at the table.
  assert.equal(config.timeoutsPerGame, 2);
  assert.equal(config.timeoutSeconds, 60);
  assert.deepEqual(config.players, players);
});

test("the win margin is the ref's call under rally scoring only", () => {
  const rallyDefault = buildConfig(
    { doubles: true, scoring: "rally", pointsToWin: 11, bestOf: 1 },
    players
  );
  assert.equal(rallyDefault.winBy, 1, "rally defaults to closing out flat");

  const rallyDeuce = buildConfig(
    { doubles: true, scoring: "rally", pointsToWin: 11, bestOf: 1, winBy: 2 },
    players
  );
  assert.equal(rallyDeuce.winBy, 2, "the USAP margin is one toggle away");

  for (const winBy of WIN_BY_OPTIONS) {
    const sideout = buildConfig(
      { doubles: true, scoring: "sideout", pointsToWin: 11, bestOf: 1, winBy },
      players
    );
    assert.equal(
      sideout.winBy,
      2,
      "side-out is always two, whatever the toggle was left on"
    );
  }
});

test("freezeRule only takes effect under rally scoring", () => {
  const rallyOff = buildConfig(
    { doubles: true, scoring: "rally", pointsToWin: 11, bestOf: 1, freezeRule: false },
    players
  );
  assert.equal(rallyOff.freezeRule, false, "the ref can still turn it off");

  const sideoutOn = buildConfig(
    { doubles: true, scoring: "sideout", pointsToWin: 11, bestOf: 1, freezeRule: true },
    players
  );
  assert.equal(
    sideoutOn.freezeRule,
    false,
    "side-out scoring ignores the toggle even if it was left on"
  );

  const omitted = buildConfig(
    { doubles: true, scoring: "rally", pointsToWin: 11, bestOf: 1 },
    players
  );
  assert.equal(omitted.freezeRule, true, "defaults on when not specified");
});

test("describeConfig states the rules a match will actually run under", () => {
  assert.equal(
    describeConfig(buildConfig(DEFAULT_OPTIONS, players)),
    "Doubles · side-out scoring · one game to 15 · win by 2 · switch at 8"
  );
  assert.equal(
    describeConfig(
      buildConfig(
        { doubles: true, scoring: "sideout", pointsToWin: 11, bestOf: 3 },
        players
      )
    ),
    "Doubles · side-out scoring · best of 3 to 11 · win by 2 · switch at 6 in the decider",
    "multi-game matches note that the switch only applies to the decider"
  );
  assert.equal(
    describeConfig(
      buildConfig(
        { doubles: false, scoring: "rally", pointsToWin: 21, bestOf: 1, freezeRule: false },
        players
      )
    ),
    "Singles · rally scoring · one game to 21 · win by 1 · switch at 11"
  );
  assert.equal(
    describeConfig(
      buildConfig(
        { doubles: false, scoring: "rally", pointsToWin: 21, bestOf: 1 },
        players
      )
    ),
    "Singles · rally scoring (freeze — win on serve only) · one game to 21 · win by 1 · switch at 11"
  );
  assert.equal(
    describeConfig(
      buildConfig(
        {
          doubles: true,
          scoring: "rally",
          pointsToWin: 21,
          bestOf: 1,
          winBy: 2,
          freezeRule: false,
        },
        players
      )
    ),
    "Doubles · rally scoring · one game to 21 · win by 2 · switch at 11",
    "the USAP 2026 sanctioned rally format"
  );
});

/** Give every rally to A, confirming each game as it lands, until A takes it. */
function playOutMatch(options: MatchOptions) {
  const config = buildConfig(options, players);
  const events: MatchEvent[] = [
    { type: "PREMATCH", at: 0, winner: "A", server: "A" },
  ];

  for (let i = 0; i < 1_000; i++) {
    const state = reduceMatch(config, events);
    if (state.matchComplete) break;
    events.push(
      state.current.complete
        ? { type: "GAME_CONFIRMED", at: 1_000 + i }
        : { type: "RALLY_WON", at: 1_000 + i, team: "A" }
    );
  }

  return { config, state: reduceMatch(config, events) };
}

test("every toggle combination plays through to a completed match", () => {
  for (const doubles of [true, false]) {
    for (const scoring of ["sideout", "rally"] as const) {
      for (const pointsToWin of POINTS_OPTIONS) {
        for (const bestOf of BEST_OF_OPTIONS) {
          for (const winBy of WIN_BY_OPTIONS) {
            const label = `${doubles ? "doubles" : "singles"}/${scoring}/${pointsToWin}/bo${bestOf}/by${winBy}`;
            const { config, state } = playOutMatch({
              doubles,
              scoring,
              pointsToWin,
              bestOf,
              winBy,
            });

            assert.equal(state.matchComplete, true, `${label} never finished`);
            assert.equal(
              state.gamesWon.A,
              gamesToWin(config),
              `${label} ended on the wrong game count`
            );
            assert.equal(state.gamesWon.B, 0, `${label} gave B a game`);
            for (const game of state.games) {
              assert.equal(
                game.scores.A,
                pointsToWin,
                `${label} finished a game on the wrong score`
              );
            }
          }
        }
      }
    }
  }
});

test("a singles game never allocates a second server", () => {
  const { state } = playOutMatch({
    doubles: false,
    scoring: "sideout",
    pointsToWin: 11,
    bestOf: 1,
  });
  for (const game of state.games) {
    assert.equal(game.serverNumber, 1);
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  BEST_OF_OPTIONS,
  buildConfig,
  DEFAULT_OPTIONS,
  describeConfig,
  POINTS_OPTIONS,
  sideSwitchScore,
  type MatchOptions,
} from "./formats.ts";
import { gamesToWin, reduceMatch } from "./reduce.ts";
import type { MatchEvent, PlayerPair, TeamId } from "./types.ts";

const players: Record<TeamId, PlayerPair> = {
  A: ["Amy", "Alex"],
  B: ["Ben", "Bea"],
};

test("the toggles offer three point targets and three game counts", () => {
  assert.deepEqual([...POINTS_OPTIONS], [11, 15, 21]);
  assert.deepEqual([...BEST_OF_OPTIONS], [1, 3, 5]);
});

test("defaults are tournament doubles: best of 3 to 11, side-out", () => {
  assert.deepEqual(DEFAULT_OPTIONS, {
    doubles: true,
    scoring: "sideout",
    pointsToWin: 11,
    bestOf: 3,
    freezeRule: false,
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
  // Rules the ref doesn't pick at the table.
  assert.equal(config.winBy, 2);
  assert.equal(config.timeoutsPerGame, 2);
  assert.equal(config.timeoutSeconds, 60);
  assert.deepEqual(config.players, players);
});

test("freezeRule only takes effect under rally scoring", () => {
  const rallyOn = buildConfig(
    { doubles: true, scoring: "rally", pointsToWin: 11, bestOf: 1, freezeRule: true },
    players
  );
  assert.equal(rallyOn.freezeRule, true);

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
  assert.equal(omitted.freezeRule, false, "defaults off when not specified");
});

test("describeConfig states the rules a match will actually run under", () => {
  assert.equal(
    describeConfig(buildConfig(DEFAULT_OPTIONS, players)),
    "Doubles · side-out scoring · best of 3 to 11 · win by 2 · switch at 6 in the decider"
  );
  assert.equal(
    describeConfig(
      buildConfig(
        { doubles: true, scoring: "sideout", pointsToWin: 15, bestOf: 1 },
        players
      )
    ),
    "Doubles · side-out scoring · one game to 15 · win by 2 · switch at 8"
  );
  assert.equal(
    describeConfig(
      buildConfig(
        { doubles: false, scoring: "rally", pointsToWin: 21, bestOf: 1 },
        players
      )
    ),
    "Singles · rally scoring · one game to 21 · win by 2 · switch at 11"
  );
  assert.equal(
    describeConfig(
      buildConfig(
        { doubles: false, scoring: "rally", pointsToWin: 21, bestOf: 1, freezeRule: true },
        players
      )
    ),
    "Singles · rally scoring (freeze — win on serve only) · one game to 21 · win by 2 · switch at 11"
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
          const label = `${doubles ? "doubles" : "singles"}/${scoring}/${pointsToWin}/bo${bestOf}`;
          const { config, state } = playOutMatch({
            doubles,
            scoring,
            pointsToWin,
            bestOf,
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

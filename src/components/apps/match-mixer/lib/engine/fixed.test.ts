import assert from "node:assert/strict";
import test from "node:test";

import { circleMeetings } from "./circle.ts";
import { MAX_ROUNDS, maxCourts, naturalLength } from "./config.ts";
import { generateFixedRounds } from "./fixed.ts";
import { formatObjection, pairIndexOf, pairsOf } from "./format.ts";
import { parseRoster } from "./roster.ts";
import { BYE_IMBALANCE_WEIGHT, scoreSchedule } from "./scorer.ts";
import { generateSchedule, UnsupportedConfigError } from "./schedule.ts";
import {
  MAX_ROSTER_SIZE,
  type FixedConfig,
  type Round,
  type Schedule,
} from "./types.ts";

/**
 * Fixed partners: the pairs are the organizer's and never move, every pair
 * faces every other before any rematch, and the Byes are taken by whole
 * Pairings.
 *
 * Most of these sweep every even Roster the tool accepts against every court
 * count it offers, rather than checking one hand-picked board. A round robin
 * is exactly the kind of thing that looks right at n=8 and quietly fails at
 * n=14 with three courts, and the arithmetic is cheap enough that there is no
 * reason to sample it.
 */

function configFor(
  n: number,
  overrides: Partial<FixedConfig> = {},
): FixedConfig {
  const roster = parseRoster(
    Array.from({ length: n }, (_, i) => `Player ${i + 1}`).join("\n"),
  );
  return { roster, courts: maxCourts(n), seed: 1, format: "fixed", ...overrides };
}

/** Every even Roster the tool accepts, paired with every court count it offers. */
function* everyBoard(): Generator<{ n: number; courts: number }> {
  for (let n = 4; n <= MAX_ROSTER_SIZE; n += 2) {
    for (let courts = 1; courts <= maxCourts(n); courts++) {
      yield { n, courts };
    }
  }
}

/** Which Pairing each side of each Game belongs to, as `[a, b]` per Game. */
function meetingsIn(round: Round): [number, number][] {
  return round.games.map((game) => [
    pairIndexOf(game.sides[0][0]),
    pairIndexOf(game.sides[1][0]),
  ]);
}

const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

test("the circle method has every team meet every other exactly once", () => {
  for (let t = 2; t <= 16; t++) {
    const meetings = circleMeetings(t);
    assert.equal(meetings.length, (t * (t - 1)) / 2, `t=${t} meeting count`);

    const seen = new Set(meetings.map(([a, b]) => key(a, b)));
    assert.equal(seen.size, meetings.length, `t=${t} repeated a meeting`);
    for (const [a, b] of meetings) {
      assert.notEqual(a, b, `t=${t} paired a team with itself`);
      assert.ok(a < t && b < t, `t=${t} invented a team`);
    }
  }
});

test("every pair is identical in every round it plays", () => {
  // The whole of what "fixed" means. A side that is not one of the Roster's
  // own consecutive pairs is not this Format at all.
  for (const { n, courts } of everyBoard()) {
    const pairs = new Set(pairsOf(n).map(([a, b]) => `${a}/${b}`));
    const schedule = generateSchedule(configFor(n, { courts, rounds: 12 }));

    for (const [index, round] of schedule.rounds.entries()) {
      for (const game of round.games) {
        for (const side of game.sides) {
          assert.ok(
            pairs.has(`${side[0]}/${side[1]}`),
            `n=${n} courts=${courts} round ${index + 1}: ${side} is not a pair`,
          );
        }
      }
    }
  }
});

test("every team faces every other once before any rematch", () => {
  for (const { n, courts } of everyBoard()) {
    const teams = pairsOf(n).length;
    const possible = (teams * (teams - 1)) / 2;
    // Exactly as long as it takes to spend the rotation, so the last round is
    // the one where a premature rematch would have nowhere left to hide.
    //
    // Some rotations are longer than the tool will draw: ten pairs on one
    // court is 45 rounds and `MAX_ROUNDS` is 40. Those still have to be free
    // of premature rematches; they just cannot be asked to finish, so the
    // coverage assertion below only applies where the whole rotation fits.
    const wanted = Math.ceil(possible / courts);
    const rounds = Math.min(wanted, MAX_ROUNDS);
    const schedule = generateSchedule(configFor(n, { courts, rounds }));

    const met = new Set<string>();
    for (const [index, round] of schedule.rounds.entries()) {
      for (const [a, b] of meetingsIn(round)) {
        // A rematch is only a failure while something is still unplayed. The
        // last round of a rotation that does not divide by the court count has
        // fewer fresh matchups left than it has courts, and starting the next
        // rotation on the spare court is the right answer rather than leaving
        // it idle — there is nothing left that is not a rematch.
        assert.ok(
          !met.has(key(a, b)) || met.size === possible,
          `n=${n} courts=${courts}: pairs ${a} and ${b} met twice by round ${index + 1}, with ${possible - met.size} matchups still unplayed`,
        );
        met.add(key(a, b));
      }
    }
    assert.equal(
      met.size,
      wanted === rounds ? possible : rounds * courts,
      `n=${n} courts=${courts} coverage`,
    );
  }
});

test("a round fills every court it was given", () => {
  // An idle court beside four sitting players is a worse board than a tight
  // one, and the greedy only earns its place if it never produces one.
  for (const { n, courts } of everyBoard()) {
    for (const seed of [1, 7, 12345]) {
      const schedule = generateSchedule(
        configFor(n, { courts, rounds: 12, seed }),
      );
      for (const [index, round] of schedule.rounds.entries()) {
        assert.equal(
          round.games.length,
          courts,
          `n=${n} courts=${courts} seed=${seed} round ${index + 1}`,
        );
        assert.deepEqual(
          round.games.map((game) => game.court),
          Array.from({ length: courts }, (_, i) => i),
          `n=${n} courts=${courts} round ${index + 1} court numbering`,
        );
      }
    }
  }
});

test("a bye is taken by a whole pairing, and both of its members sit", () => {
  for (const { n, courts } of everyBoard()) {
    const teams = pairsOf(n);
    const schedule = generateSchedule(configFor(n, { courts, rounds: 9 }));

    for (const [index, round] of schedule.rounds.entries()) {
      const sitting = new Set(round.byes);
      for (const [a, b] of teams) {
        assert.equal(
          sitting.has(a),
          sitting.has(b),
          `n=${n} courts=${courts} round ${index + 1}: split pair ${a}/${b}`,
        );
      }
      // And the seats and the byes between them still account for everybody.
      const seats = round.games.flatMap((game) => [
        ...game.sides[0],
        ...game.sides[1],
      ]);
      assert.deepEqual(
        [...seats, ...round.byes].sort((a, b) => a - b),
        Array.from({ length: n }, (_, i) => i),
        `n=${n} courts=${courts} round ${index + 1} seats everyone once`,
      );
    }
  }
});

test("the team byes rotate: nobody sits appreciably more than anybody else", () => {
  for (const { n, courts } of everyBoard()) {
    const schedule = generateSchedule(configFor(n, { courts, rounds: 9 }));
    const score = scoreSchedule(schedule, configFor(n, { courts, rounds: 9 }));

    assert.ok(
      score.byeSpread <= 1,
      `n=${n} courts=${courts} bye spread was ${score.byeSpread}`,
    );
    assert.equal(
      score.byesRotateEvenly,
      true,
      `n=${n} courts=${courts} byes did not rotate evenly`,
    );
  }
});

test("a board inside the rotation is charged nothing for its partnerships", () => {
  // The point of the Scorer knowing the Format. Every one of these boards has
  // every pair partnering every round they play, which a rotating reading
  // would price in the thousands; here the only thing that can cost anything
  // is the Bye imbalance a rotation that does not divide by the court count
  // has no way to avoid, and which rotating is charged for on the same terms.
  for (const { n, courts } of everyBoard()) {
    const config = configFor(n, {
      courts,
      rounds: naturalLength(n, courts, "fixed"),
    });
    const score = scoreSchedule(generateSchedule(config), config);

    assert.equal(score.repeatedMeetings, 0, `n=${n} courts=${courts} rematches`);
    assert.ok(score.maxMeetingCount <= 1, `n=${n} courts=${courts} meetings`);
    assert.equal(
      score.cost,
      score.byeSpread * BYE_IMBALANCE_WEIGHT,
      `n=${n} courts=${courts}: charged for something other than byes`,
    );
    assert.ok(score.byeSpread <= 1, `n=${n} courts=${courts} bye spread`);
  }
});

test("past the rotation the rematches are reported, not hidden", () => {
  // Twelve names are six pairs holding fifteen matchups; three courts spend
  // three a round, so round six is the first that cannot avoid a rematch.
  const config = configFor(12, { courts: 3, rounds: 8 });
  const score = scoreSchedule(generateSchedule(config), config);

  assert.ok(score.repeatedMeetings > 0, "a spent rotation has to say so");
  assert.ok(score.cost > 0);
  assert.equal(score.meetingsPlayed, score.meetingsPossible);
});

test("the same config and seed always give the same board", () => {
  const config = configFor(14, { courts: 3, rounds: 7, seed: 99 });
  assert.deepEqual(generateSchedule(config), generateSchedule(config));
});

test("a new seed moves the matchups without moving the pairs", () => {
  // A redraw has exactly one thing to vary here: who meets whom first. The
  // pairs are the organizer's and must come through untouched.
  const base = { courts: 3, rounds: 5 };
  const one = generateSchedule(configFor(12, { ...base, seed: 1 }));
  const two = generateSchedule(configFor(12, { ...base, seed: 2 }));

  assert.notDeepEqual(one.rounds, two.rounds, "a redraw has to redraw");
  const pairs = new Set(pairsOf(12).map(([a, b]) => `${a}/${b}`));
  for (const round of two.rounds) {
    for (const game of round.games) {
      for (const side of game.sides) assert.ok(pairs.has(`${side[0]}/${side[1]}`));
    }
  }
});

test("an odd roster is refused, and the message names who is left over", () => {
  const roster = parseRoster(
    ["Ben Johns", "Anna Leigh Waters", "JW Johnson", "Anna Bright", "Jorja Johnson"].join(
      "\n",
    ),
  );

  const objection = formatObjection(roster, "fixed");
  assert.ok(objection, "an odd roster cannot play this format");
  assert.match(objection, /Jorja Johnson/, "the message has to name them");

  // And the engine refuses it too, rather than trusting the screen to have
  // asked: no board is drawn with somebody quietly dropped off the end.
  assert.throws(
    () => generateSchedule({ roster, courts: 1, seed: 1, format: "fixed" }),
    UnsupportedConfigError,
  );
});

test("an odd roster is fine in rotating, which is the format that can seat it", () => {
  const roster = parseRoster(
    ["Ben Johns", "Anna Leigh Waters", "JW Johnson", "Anna Bright", "Jorja Johnson"].join(
      "\n",
    ),
  );
  assert.equal(formatObjection(roster, "rotating"), null);
  assert.ok(generateSchedule({ roster, courts: 1, seed: 1 }).rounds.length > 0);
});

test("no fixed-partner config is ever served from a Table", () => {
  // Every stored Table is a whist tournament, and ADR 0002's guarantee about
  // its prefixes is a claim about rotating doubles that says nothing at all
  // about this Format. n=8, 12 and 16 at their full court count are exactly
  // the configs that would otherwise find one.
  for (const n of [8, 12, 16]) {
    const schedule: Schedule = generateSchedule(
      configFor(n, { courts: n / 4, rounds: n - 1 }),
    );
    assert.equal(schedule.source, "generated", `n=${n} reached findTable`);
  }
});

test("the smallest board this draws is two pairs on one court", () => {
  const config = configFor(4, { courts: 1, rounds: 1 });
  const schedule = generateSchedule(config);

  assert.equal(schedule.rounds.length, 1);
  assert.deepEqual(schedule.rounds[0].byes, []);
  assert.equal(scoreSchedule(schedule, config).cost, 0);
});

test("generateFixedRounds is deterministic on its own, without a Config", () => {
  const spec = { n: 10, courts: 2, rounds: 6, seed: 4242 };
  assert.deepEqual(generateFixedRounds(spec), generateFixedRounds(spec));
});

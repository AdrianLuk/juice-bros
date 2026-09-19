import assert from "node:assert/strict";
import test from "node:test";

import { MAX_ROUNDS, maxCourts, naturalLength } from "./config.ts";
import { formatObjection } from "./format.ts";
import { parseRoster } from "./roster.ts";
import { BYE_IMBALANCE_WEIGHT, scoreSchedule } from "./scorer.ts";
import { generateSchedule } from "./schedule.ts";
import { generateSinglesRounds } from "./singles.ts";
import {
  MAX_ROSTER_SIZE,
  MIN_ROSTER_SIZE,
  type Round,
  type Schedule,
  type SinglesConfig,
} from "./types.ts";

/**
 * Singles: a side is one Player, up to `floor(n / 2)` courts, and nobody plays
 * the same person twice until everybody has.
 *
 * Most of these sweep every Roster the tool accepts against every court count
 * it offers, rather than checking one hand-picked board — the same reasoning
 * `fixed.test.ts` gives. A round robin looks right at n=8 and quietly fails at
 * n=13 with four courts, and the arithmetic is cheap enough that there is no
 * reason to sample it. Unlike fixed partners this sweep includes the odd
 * Rosters, because an odd Roster is an ordinary singles night rather than a
 * list with a name left over.
 */
function configFor(
  n: number,
  overrides: Partial<SinglesConfig> = {},
): SinglesConfig {
  const roster = parseRoster(
    Array.from({ length: n }, (_, i) => `Player ${i + 1}`).join("\n"),
  );
  return {
    roster,
    courts: maxCourts(n, "singles"),
    seed: 1,
    format: "singles",
    ...overrides,
  };
}

/** Every Roster the tool accepts, paired with every court count it offers. */
function* everyBoard(): Generator<{ n: number; courts: number }> {
  for (let n = MIN_ROSTER_SIZE; n <= MAX_ROSTER_SIZE; n++) {
    for (let courts = 1; courts <= maxCourts(n, "singles"); courts++) {
      yield { n, courts };
    }
  }
}

/** Who met whom in this Round, as `[a, b]` per Game. */
function meetingsIn(round: Round): [number, number][] {
  return round.games.map((game) => [game.sides[0][0], game.sides[1][0]]);
}

const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

test("the court ceiling for singles is floor(n / 2)", () => {
  for (let n = MIN_ROSTER_SIZE; n <= MAX_ROSTER_SIZE; n++) {
    assert.equal(maxCourts(n, "singles"), Math.floor(n / 2), `n=${n}`);
    // And the doubles ceiling has not moved underneath it.
    assert.equal(maxCourts(n), Math.floor(n / 4), `n=${n} doubles`);
  }
});

test("every side is one player, and every game is two of them", () => {
  // The whole of what "singles" means, and the thing widening `Side` bought.
  for (const { n, courts } of everyBoard()) {
    const schedule = generateSchedule(configFor(n, { courts, rounds: 9 }));

    for (const [index, round] of schedule.rounds.entries()) {
      for (const game of round.games) {
        assert.equal(
          game.sides.length,
          2,
          `n=${n} courts=${courts} round ${index + 1}: not two sides`,
        );
        for (const side of game.sides) {
          assert.equal(
            side.length,
            1,
            `n=${n} courts=${courts} round ${index + 1}: side of ${side.length}`,
          );
        }
      }
    }
  }
});

test("everybody plays everybody exactly once, and nobody sits out", () => {
  // The headline claim, on the boards where the maths allows it: an even
  // Roster with a court for every pair of players runs the full circle in
  // `n - 1` rounds with nobody off.
  for (let n = 4; n <= MAX_ROSTER_SIZE; n += 2) {
    const courts = n / 2;
    const config = configFor(n, { courts, rounds: n - 1 });
    const schedule = generateSchedule(config);

    const met = new Map<string, number>();
    for (const round of schedule.rounds) {
      assert.deepEqual(round.byes, [], `n=${n} somebody sat out`);
      assert.equal(round.games.length, courts, `n=${n} court count`);
      for (const [a, b] of meetingsIn(round)) {
        met.set(key(a, b), (met.get(key(a, b)) ?? 0) + 1);
      }
    }

    assert.equal(met.size, (n * (n - 1)) / 2, `n=${n} coverage`);
    for (const [pair, times] of met) {
      assert.equal(times, 1, `n=${n}: ${pair} played ${times} times`);
    }

    // And the Scorer agrees, which is the only thing allowed to say so.
    const score = scoreSchedule(schedule, config);
    assert.equal(score.repeatedMeetings, 0, `n=${n} rematches`);
    assert.equal(score.meetingsPlayed, score.meetingsPossible, `n=${n} played`);
    assert.equal(score.cost, 0, `n=${n} cost`);
  }
});

test("the natural length of a full singles board is n - 1 rounds", () => {
  for (let n = 4; n <= MAX_ROSTER_SIZE; n += 2) {
    assert.equal(naturalLength(n, n / 2, "singles"), n - 1, `n=${n}`);
  }
});

test("nobody plays the same person twice before everybody has", () => {
  for (const { n, courts } of everyBoard()) {
    const possible = (n * (n - 1)) / 2;
    // Exactly as long as it takes to spend the rotation, so the last round is
    // the one where a premature rematch would have nowhere left to hide. Some
    // rotations are longer than the tool will draw — 32 names on one court is
    // 496 rounds against a `MAX_ROUNDS` of 40 — so those are checked for
    // premature rematches without being asked to finish.
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
        // it idle.
        assert.ok(
          !met.has(key(a, b)) || met.size === possible,
          `n=${n} courts=${courts}: ${a} and ${b} met twice by round ${index + 1}, with ${possible - met.size} matchups still unplayed`,
        );
        met.add(key(a, b));
      }
    }
    if (wanted === rounds) {
      assert.equal(met.size, possible, `n=${n} courts=${courts} coverage`);
    }
  }
});

test("a round fills every court it was given, and seats everybody once", () => {
  for (const { n, courts } of everyBoard()) {
    for (const seed of [1, 7, 12345]) {
      const schedule = generateSchedule(
        configFor(n, { courts, rounds: 9, seed }),
      );
      for (const [index, round] of schedule.rounds.entries()) {
        const where = `n=${n} courts=${courts} seed=${seed} round ${index + 1}`;
        assert.equal(round.games.length, courts, `${where} court count`);
        assert.deepEqual(
          round.games.map((game) => game.court),
          Array.from({ length: courts }, (_, i) => i),
          `${where} court numbering`,
        );

        const seats = round.games.flatMap((game) => [
          ...game.sides[0],
          ...game.sides[1],
        ]);
        assert.deepEqual(
          [...seats, ...round.byes].sort((a, b) => a - b),
          Array.from({ length: n }, (_, i) => i),
          `${where} seats everyone exactly once`,
        );
        assert.equal(round.byes.length, n - courts * 2, `${where} bye count`);
      }
    }
  }
});

test("byes rotate evenly on an odd roster, or with courts to spare", () => {
  for (const { n, courts } of everyBoard()) {
    if (n === courts * 2) continue; // Nobody sits; covered above.
    const config = configFor(n, { courts, rounds: 9 });
    const score = scoreSchedule(generateSchedule(config), config);

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

test("a singles board is charged nothing for its partnerships, having none", () => {
  // The point of the Scorer knowing the Format. Every side on these boards is
  // one player, so the partner matrix is empty and the only thing that can
  // cost anything is the bye imbalance a rotation that does not divide by the
  // court count has no way to avoid.
  for (const { n, courts } of everyBoard()) {
    const config = configFor(n, {
      courts,
      rounds: Math.min(naturalLength(n, courts, "singles"), MAX_ROUNDS),
    });
    const score = scoreSchedule(generateSchedule(config), config);

    assert.equal(score.repeatedMeetings, 0, `n=${n} courts=${courts} rematches`);
    assert.ok(score.maxMeetingCount <= 1, `n=${n} courts=${courts} meetings`);
    assert.equal(
      score.cost,
      score.byeSpread * BYE_IMBALANCE_WEIGHT,
      `n=${n} courts=${courts}: charged for something other than byes`,
    );
  }
});

test("the partner matrix of a singles board is entirely empty", () => {
  // Not an incidental zero: `recordRound` has to decline to bump it for a side
  // of one, and a reader of a singles board must not be able to take a partner
  // count off it and mean anything by it.
  const config = configFor(13, { courts: 5, rounds: 12 });
  const score = scoreSchedule(generateSchedule(config), config);

  for (const row of score.partnerMatrix) {
    assert.deepEqual(row, new Array<number>(13).fill(0));
  }
});

test("coverage counts meetings out of n(n - 1) / 2", () => {
  const config = configFor(10, { courts: 5, rounds: 3 });
  const score = scoreSchedule(generateSchedule(config), config);

  assert.equal(score.meetingsPossible, 45);
  // Three rounds of five courts is fifteen meetings, all of them fresh.
  assert.equal(score.meetingsPlayed, 15);
});

test("past the rotation the rematches are reported, not hidden", () => {
  // Six names hold fifteen matchups; three courts spend three a round, so
  // round six is the first that cannot avoid a rematch.
  const config = configFor(6, { courts: 3, rounds: 8 });
  const score = scoreSchedule(generateSchedule(config), config);

  assert.ok(score.repeatedMeetings > 0, "a spent rotation has to say so");
  assert.ok(score.cost > 0);
  assert.equal(score.meetingsPlayed, score.meetingsPossible);
});

test("an odd roster is fine, and its byes are players rather than pairs", () => {
  const config = configFor(7, { courts: 3, rounds: 7 });
  const schedule = generateSchedule(config);

  assert.equal(formatObjection(config.roster, "singles"), null);
  for (const round of schedule.rounds) {
    assert.equal(round.byes.length, 1, "one name off, not two");
  }
  assert.equal(scoreSchedule(schedule, config).repeatedMeetings, 0);
});

test("the same config and seed always give the same board", () => {
  const config = configFor(14, { courts: 5, rounds: 7, seed: 99 });
  assert.deepEqual(generateSchedule(config), generateSchedule(config));
});

test("a new seed draws a different board", () => {
  const base = { courts: 5, rounds: 5 };
  const one = generateSchedule(configFor(12, { ...base, seed: 1 }));
  const two = generateSchedule(configFor(12, { ...base, seed: 2 }));
  assert.notDeepEqual(one.rounds, two.rounds, "a redraw has to redraw");
});

test("no singles config is ever served from a Table", () => {
  // Every stored Table is a whist tournament, and ADR 0002's guarantee about
  // its prefixes is a claim about rotating doubles that says nothing at all
  // about this Format. n=8, 12 and 16 are the Roster sizes with a Table.
  for (const n of [8, 12, 16]) {
    const schedule: Schedule = generateSchedule(
      configFor(n, { courts: n / 4, rounds: n - 1 }),
    );
    assert.equal(schedule.source, "generated", `n=${n} reached findTable`);
  }
});

test("the smallest singles board is four names on two courts", () => {
  // The roster floor does not move for this Format: two people do not need a
  // tool to work out that they are playing each other.
  const config = configFor(4, { rounds: 3 });
  const schedule = generateSchedule(config);

  assert.equal(config.courts, 2);
  assert.equal(schedule.rounds.length, 3);
  assert.deepEqual(schedule.rounds[0].byes, []);
  assert.equal(scoreSchedule(schedule, config).cost, 0);
});

test("generateSinglesRounds is deterministic on its own, without a Config", () => {
  const spec = { n: 11, courts: 4, rounds: 6, seed: 4242 };
  assert.deepEqual(generateSinglesRounds(spec), generateSinglesRounds(spec));
});

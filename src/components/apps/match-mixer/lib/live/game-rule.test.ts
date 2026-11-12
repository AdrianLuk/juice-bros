import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_GAME_RULE, scoreProblem, type GameRule } from "./game-rule.ts";

const accepts = (rule: GameRule, a: number, b: number) =>
  assert.equal(scoreProblem(rule, [a, b]), null, `${describe(rule)} should accept ${a} to ${b}`);
const refuses = (rule: GameRule, a: number, b: number) =>
  assert.notEqual(scoreProblem(rule, [a, b]), null, `${describe(rule)} should refuse ${a} to ${b}`);
const describe = (rule: GameRule) => `to ${rule.to}, win by ${rule.winBy}`;

test("the default Game Rule is to 11, win by 2", () => {
  assert.deepEqual(DEFAULT_GAME_RULE, { to: 11, winBy: 2 });
});

for (const to of [11, 15, 21] as const) {
  test(`to ${to}, win by 2: a clean win and every overtime score`, () => {
    const rule: GameRule = { to, winBy: 2 };
    accepts(rule, to, 0);
    accepts(rule, to, to - 2);
    accepts(rule, to - 2, to);
    accepts(rule, to + 1, to - 1);
    accepts(rule, to + 2, to);
    accepts(rule, to + 20, to + 18);
  });

  test(`to ${to}, win by 2: refuses a game that isn't over, or went on past its end`, () => {
    const rule: GameRule = { to, winBy: 2 };
    refuses(rule, to, to - 1); // not over yet
    refuses(rule, to - 1, to - 3); // nobody reached the target
    refuses(rule, to + 1, to - 2); // it ended at `to` to `to - 2`
    refuses(rule, to + 3, to); // past the target, a 2-point lead ends it
    refuses(rule, to, to);
  });

  test(`to ${to}, win by 1: the first to ${to} wins, and nothing goes past it`, () => {
    const rule: GameRule = { to, winBy: 1 };
    accepts(rule, to, to - 1);
    accepts(rule, 0, to);
    refuses(rule, to + 1, to);
    refuses(rule, to + 1, to - 1);
    refuses(rule, to - 1, 0);
  });
}

test("win-by-2 overtime: 13 to 11 playing to 11", () => {
  accepts({ to: 11, winBy: 2 }, 13, 11);
  accepts({ to: 11, winBy: 2 }, 11, 13);
});

test("timed accepts any two whole numbers from 0 to 99 that aren't a tie", () => {
  for (const winBy of [1, 2] as const) {
    const rule: GameRule = { to: "timed", winBy };
    accepts(rule, 0, 1);
    accepts(rule, 7, 6);
    accepts(rule, 99, 0);
    refuses(rule, 5, 5);
    refuses(rule, 100, 3);
  }
});

test("no rule accepts a tie, a negative, a fraction or a number past 99", () => {
  for (const rule of [
    { to: 11, winBy: 2 },
    { to: 21, winBy: 1 },
    { to: "timed", winBy: 2 },
  ] as const) {
    refuses(rule, 0, 0);
    refuses(rule, -1, 11);
    refuses(rule, 11.5, 3);
    refuses(rule, 11, Number.NaN);
  }
  refuses({ to: 21, winBy: 2 }, 101, 99);
});

test("a refusal says why, in words", () => {
  assert.match(scoreProblem({ to: 11, winBy: 2 }, [9, 9]) ?? "", /tie/i);
  assert.match(scoreProblem({ to: 11, winBy: 2 }, [11, 10]) ?? "", /win by 2/i);
  assert.match(scoreProblem({ to: 15, winBy: 2 }, [12, 3]) ?? "", /15/);
});

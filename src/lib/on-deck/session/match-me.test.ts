import assert from "node:assert/strict";
import test from "node:test";

import {
  SELECTION_WINDOW,
  SKILL_PAIR_COST,
  VARIETY_WEIGHT,
  bestReplacement,
  selectFoursome,
  skillPenalty,
  varietyPenalty,
  type CompletedGame,
  type SelectionInput,
} from "./match-me.ts";
import type { SkillLevel } from "./types.ts";

/**
 * Named skill fixtures — a token is its own skill unless overridden. The
 * default "intermediate" keeps most fixtures about Wait Time and Variety
 * without every id carrying a level.
 */
const SKILLS: Record<string, SkillLevel> = {
  newbieN: "newbie",
  begB: "beginner",
  intI: "intermediate",
  advA: "advanced",
};

function skillOf(id: string): SkillLevel {
  return SKILLS[id] ?? "intermediate";
}

function select(
  queue: string[],
  overrides: Partial<SelectionInput> = {},
): string[] | null {
  return selectFoursome({
    queue,
    skillOf,
    completedGames: [],
    seed: "seed-1",
    ...overrides,
  });
}

/** `n` plain intermediate tokens, `q1`..`qn`, in wait order. */
function queueOf(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `q${i + 1}`);
}

// --- the anchor ---------------------------------------------------------

test("the longest-waiting Player anchors every Foursome", () => {
  const four = select(queueOf(12));
  assert.equal(four?.[0], "q1");
  assert.equal(four?.length, 4);
});

test("the anchor is kept even when they fit no one — a lone advanced among newbies", () => {
  const skills: Record<string, SkillLevel> = {
    lonely: "advanced",
    a: "newbie",
    b: "newbie",
    c: "newbie",
    d: "newbie",
    e: "newbie",
  };
  const four = select(["lonely", "a", "b", "c", "d", "e"], {
    skillOf: (id) => skills[id] ?? "intermediate",
  });
  assert.ok(four?.includes("lonely"));
  assert.equal(four?.[0], "lonely");
  assert.equal(four?.length, 4);
});

test("the anchor is kept even having already shared a Court with everyone waiting", () => {
  const waiting = ["anchor", "a", "b", "c", "d", "e"];
  const completedGames: CompletedGame[] = [
    { players: ["anchor", "a", "b", "c"] },
    { players: ["anchor", "d", "e", "a"] },
  ];
  const four = select(waiting, { completedGames });
  assert.equal(four?.[0], "anchor");
});

test("fewer than four waiting yields no Foursome", () => {
  assert.equal(select(["q1", "q2", "q3"]), null);
  assert.equal(select([]), null);
});

test("exactly four waiting is the only possible Foursome", () => {
  assert.deepEqual(select(["q1", "q2", "q3", "q4"]), [
    "q1",
    "q2",
    "q3",
    "q4",
  ]);
});

// --- the window --------------------------------------------------------

test("only the next SELECTION_WINDOW Players past the anchor are eligible", () => {
  // A perfect-fit trio sits just outside the window; three worse-fitting
  // Players sit inside it. The window players are chosen regardless.
  const inWindow = queueOf(1 + SELECTION_WINDOW); // q1 (anchor) + a full window
  const outside = ["z1", "z2", "z3"];
  const queue = [...inWindow, ...outside];

  const four = select(queue);
  for (const id of outside) {
    assert.ok(!four?.includes(id), `${id} is past the window, not eligible`);
  }
});

test("the anchor leads, then the chosen three in Queue (wait) order", () => {
  const queue = ["q1", "q9", "q3", "q7", "q5", "q2", "q8", "q4"];
  const four = select(queue)!;

  assert.equal(four[0], "q1");
  const positions = four.slice(1).map((id) => queue.indexOf(id));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

// --- skill fit --------------------------------------------------------

test("skillPenalty is the per-Player gap cost, summed (each pair counted twice)", () => {
  // three intermediate + one advanced: three int↔adv pairs, gap 1, counted
  // from both sides => 6 * SKILL_PAIR_COST[1].
  const penalty = skillPenalty(["intI", "intI", "intI", "advA"], skillOf);
  assert.equal(penalty, 6 * SKILL_PAIR_COST[1]);

  // all the same level: no penalty.
  assert.equal(skillPenalty(["intI", "intI", "intI", "intI"], skillOf), 0);

  // newbie(0), advanced(3), intermediate(2), intermediate(2) — every pair
  // counted from both sides:
  const wide = skillPenalty(["newbieN", "advA", "intI", "intI"], skillOf);
  const expected =
    2 * SKILL_PAIR_COST[3] + // newbie <-> advanced
    4 * SKILL_PAIR_COST[2] + // newbie <-> each intermediate
    4 * SKILL_PAIR_COST[1]; // advanced <-> each intermediate
  assert.equal(wide, expected);
});

test("a same-level Foursome is preferred over a mixed one", () => {
  const skills: Record<string, SkillLevel> = {
    q1: "intermediate",
    q2: "intermediate",
    q3: "advanced",
    q4: "intermediate",
    q5: "advanced",
    q6: "intermediate",
  };
  const four = select(["q1", "q2", "q3", "q4", "q5", "q6"], {
    skillOf: (id) => skills[id] ?? "intermediate",
  });
  assert.deepEqual(four, ["q1", "q2", "q4", "q6"]);
});

test("the spread widens to +/-1 before +/-2 — beginners fill in before advanced", () => {
  const skills: Record<string, SkillLevel> = {
    q1: "intermediate",
    q2: "advanced", // +2 from the beginners below
    q3: "beginner", // +1
    q4: "beginner", // +1
    q5: "beginner", // +1
    q6: "advanced", // +2
  };
  const four = select(["q1", "q2", "q3", "q4", "q5", "q6"], {
    skillOf: (id) => skills[id] ?? "intermediate",
  });
  assert.deepEqual(four, ["q1", "q3", "q4", "q5"]);
});

test("the Court is still filled when every fit is poor", () => {
  const skills: Record<string, SkillLevel> = {
    q1: "advanced",
    q2: "newbie",
    q3: "newbie",
    q4: "newbie",
    q5: "newbie",
  };
  const four = select(["q1", "q2", "q3", "q4", "q5"], {
    skillOf: (id) => skills[id] ?? "intermediate",
  });
  assert.equal(four?.length, 4);
  assert.ok(four?.includes("q1"));
});

// --- variety --------------------------------------------------------

test("varietyPenalty is zero with no history", () => {
  assert.equal(varietyPenalty(["a", "b", "c", "d"], []), 0);
});

test("a more recent shared Court is penalised more than an older one", () => {
  const games: CompletedGame[] = [
    { players: ["a", "b", "x", "y"] }, // oldest: a+b together
    { players: ["p", "q", "r", "s"] },
    { players: ["c", "d", "m", "n"] }, // most recent: c+d together
  ];
  const oldPair = varietyPenalty(["a", "b", "z1", "z2"], games);
  const recentPair = varietyPenalty(["c", "d", "z1", "z2"], games);
  assert.ok(recentPair > oldPair, "recent repeat costs more");
  assert.equal(recentPair, 1 / 1); // shared in the last game
  assert.equal(oldPair, 1 / 3); // shared three games back
});

test("Match Me avoids a recent courtmate when an equal-skill alternative exists", () => {
  const games: CompletedGame[] = [{ players: ["q1", "q2", "q3", "q4"] }];
  // All intermediate, so skill is a wash; q5, q6, q7 are untainted.
  const four = select(["q1", "q5", "q6", "q7", "q2", "q3", "q4"], {
    completedGames: games,
  });
  assert.deepEqual(four, ["q1", "q5", "q6", "q7"]);
});

test("Variety degrades gracefully when the queue is too small to avoid everyone", () => {
  const games: CompletedGame[] = [
    { players: ["q1", "q2", "q3", "q4"] },
    { players: ["q1", "q2", "q3", "q4"] },
  ];
  // Only q1..q4 are waiting — the repeat is unavoidable, seat them anyway.
  const four = select(["q1", "q2", "q3", "q4"], { completedGames: games });
  assert.deepEqual(four, ["q1", "q2", "q3", "q4"]);
});

test("one repeat is tolerated rather than widening the skill spread to +/-2", () => {
  const skills: Record<string, SkillLevel> = {
    q1: "intermediate",
    q2: "intermediate", // shared a Court with q1 last game
    q3: "intermediate",
    q4: "intermediate",
    q5: "advanced", // a fresh face, but +2 from the anchor
    q6: "advanced",
  };
  const games: CompletedGame[] = [{ players: ["q1", "q2", "x", "y"] }];
  const four = select(["q1", "q2", "q3", "q4", "q5", "q6"], {
    skillOf: (id) => skills[id] ?? "intermediate",
    completedGames: games,
  });
  // Re-pairing q1 with q2 (cost VARIETY_WEIGHT) beats reaching for an
  // advanced Player (cost 6 in skill terms).
  assert.deepEqual(four, ["q1", "q2", "q3", "q4"]);
  assert.ok(VARIETY_WEIGHT < 6);
});

// --- determinism ---------------------------------------------------------

test("identical input yields the identical Foursome, every call", () => {
  const queue = queueOf(14);
  const a = select(queue);
  const b = select(queue);
  assert.deepEqual(a, b);
});

test("a fit tie is settled by Wait Time — the trio further up the Queue wins", () => {
  // p1 (advanced) anchors. {p2,p4,p5} (three intermediates) and {p2,p3,p6}
  // (two advanced + one) cost the same in skill terms. {p2,p3,p6} reaches
  // less far down the Queue (indices 0,1,4 vs 0,2,3), so it takes the Court.
  const skills: Record<string, SkillLevel> = {
    p1: "advanced",
    p2: "intermediate",
    p3: "advanced",
    p4: "intermediate",
    p5: "intermediate",
    p6: "advanced",
  };
  const four = select(["p1", "p2", "p3", "p4", "p5", "p6"], {
    skillOf: (id) => skills[id] ?? "intermediate",
  });
  assert.deepEqual(four, ["p1", "p2", "p3", "p6"]);
});

test("all else equal, the front three of the window play, whatever the seed", () => {
  for (const seed of ["alpha", "beta", "gamma"]) {
    assert.deepEqual(select(queueOf(9), { seed }), ["q1", "q2", "q3", "q4"]);
  }
});

test("the seed is threaded through and never trips replay — same seed, same Foursome", () => {
  const queue = queueOf(14);
  const runs = ["s1", "s1", "s1"].map((s) => select(queue, { seed: s }));
  assert.deepEqual(runs[0], runs[1]);
  assert.deepEqual(runs[1], runs[2]);
});

test("no seed collision across a spread of seeds leaves the anchor out", () => {
  for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
    const four = select(queueOf(11), { seed });
    assert.equal(four?.[0], "q1");
    assert.equal(new Set(four).size, 4);
  }
});

// --- bestReplacement (no-show swap, #246) -------------------------------

test("bestReplacement pulls the waiting Player who fits the three still on the Court", () => {
  const skills: Record<string, SkillLevel> = {
    a1: "advanced",
    a2: "advanced",
    a3: "advanced",
    nA: "newbie",
    nB: "advanced",
  };
  const pick = bestReplacement({
    courtmates: ["a1", "a2", "a3"],
    waiting: ["nA", "nB"],
    skillOf: (id) => skills[id] ?? "intermediate",
    completedGames: [],
  });
  assert.equal(pick, "nB", "the advanced waiter beats the newbie for an advanced court");
});

test("bestReplacement falls to the longest-waiting on a fit tie", () => {
  const pick = bestReplacement({
    courtmates: ["q1", "q2", "q3"],
    waiting: ["q4", "q5", "q6"],
    skillOf: () => "intermediate",
    completedGames: [],
  });
  assert.equal(pick, "q4");
});

test("bestReplacement returns null when nobody is waiting", () => {
  assert.equal(
    bestReplacement({
      courtmates: ["q1", "q2", "q3"],
      waiting: [],
      skillOf: () => "intermediate",
      completedGames: [],
    }),
    null,
  );
});

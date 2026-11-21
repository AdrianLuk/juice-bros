/**
 * Round 1 (issue #715): the six singles Dreambreakers, their final scores,
 * the Rotation on each court and the Seeding they produce. Pure and
 * relative-import-only, for `node --test`; the database checks the score
 * again and stores only finals.
 *
 * Glossary: dink-dine-drink/CONTEXT.md ("Dreambreaker", "Rotation", "Seeding").
 */

export const DREAMBREAKER_TO = 21;

/** What stops a final saving, or null for a valid one: 21 to anything from 0 to 20. */
export function checkDreambreakerScore(a: number, b: number): string | null {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return "Scores are whole numbers.";
  if (a === b) return "A Dreambreaker can't end level.";
  if (Math.max(a, b) !== DREAMBREAKER_TO) return "The winner has 21. Enter the final score.";
  return null;
}

/** One of the six Dreambreakers: when it plays (1 to 3) and on which of the first two courts (0 or 1). */
export type DreambreakerSlot = { teamA: string; teamB: string; turn: 1 | 2 | 3; court: 0 | 1 };

const PAIRINGS: [number, number][][] = [
  [
    [0, 1],
    [2, 3],
  ],
  [
    [0, 2],
    [1, 3],
  ],
  [
    [0, 3],
    [1, 2],
  ],
];

/** The six Dreambreakers for 4 Teams in roster order, two at a time. None for any other count. */
export function dreambreakerSlots(teamIds: readonly string[]): DreambreakerSlot[] {
  if (teamIds.length !== 4) return [];
  return PAIRINGS.flatMap((pairs, turn) =>
    pairs.map(([a, b], court) => ({
      teamA: teamIds[a],
      teamB: teamIds[b],
      turn: (turn + 1) as 1 | 2 | 3,
      court: court as 0 | 1,
    })),
  );
}

/** A final score between two Teams. Orientation is free: `scoreA` is `teamA`'s points. */
export type DreambreakerResult = { teamA: string; teamB: string; scoreA: number; scoreB: number };

/** The final between two Teams as [a's points, b's points], or null before it is in. */
export function finalBetween(results: readonly DreambreakerResult[], a: string, b: string): [number, number] | null {
  for (const result of results) {
    if (result.teamA === a && result.teamB === b) return [result.scoreA, result.scoreB];
    if (result.teamA === b && result.teamB === a) return [result.scoreB, result.scoreA];
  }
  return null;
}

/** How a Dreambreaker shows: Final, On now, Up next, or Later. */
export type SlotStatus = "final" | "now" | "next" | "later";

/** The earliest pair of Dreambreakers with one still to finish is On now; the pair after it is Up next. */
export function slotStatuses(slots: readonly DreambreakerSlot[], results: readonly DreambreakerResult[]): SlotStatus[] {
  const done = slots.map((slot) => finalBetween(results, slot.teamA, slot.teamB) !== null);
  const open = Math.min(...slots.filter((_, index) => !done[index]).map((slot) => slot.turn));
  return slots.map((slot, index) => {
    if (done[index]) return "final";
    if (slot.turn === open) return "now";
    return slot.turn === open + 1 ? "next" : "later";
  });
}

// ---- Seeding -----------------------------------------------------------------

/**
 * What put a Team below the one above it. "level" is a tie on every count
 * while Dreambreakers are still to play; "unresolved" is the same tie once
 * all six are in, waiting on an Organizer's call.
 */
export type SeedRule = "wins" | "headToHead" | "pointDiff" | "points" | "organizer" | "unresolved" | "level";

export type Seed = {
  teamId: string;
  /** 1 to 4. */
  position: number;
  wins: number;
  pointDiff: number;
  points: number;
  played: number;
  /** What separated this Team from the one above it; null for the top seed. */
  decidedBy: SeedRule | null;
};

type Stat = Omit<Seed, "position" | "decidedBy"> & { index: number };

type Placed = { stat: Stat; decidedBy: SeedRule | null };

const KEYS: { rule: SeedRule; key: (stat: Stat) => number }[] = [
  { rule: "wins", key: (stat) => stat.wins },
  { rule: "pointDiff", key: (stat) => stat.pointDiff },
  { rule: "points", key: (stat) => stat.points },
];

/**
 * Ranks the Teams on the finals in so far. Most Dreambreakers won first. A
 * tie is broken in order by: the head-to-head Dreambreaker when exactly two
 * Teams are tied and have played; point difference; total points; then the
 * Organizer's call (`organizerOrder`, Team ids best first). Any group a rule
 * splits starts again from head-to-head, so two Teams a three-way tie leaves
 * level are settled by the game between them. `teamIds` is roster order,
 * which also orders a tie nobody has called yet.
 */
export function seedTeams(
  teamIds: readonly string[],
  results: readonly DreambreakerResult[],
  organizerOrder: readonly string[] = [],
): Seed[] {
  const finals = results.filter((result) => checkDreambreakerScore(result.scoreA, result.scoreB) === null);
  const stats: Stat[] = teamIds.map((teamId, index) => {
    const stat: Stat = { teamId, index, wins: 0, pointDiff: 0, points: 0, played: 0 };
    for (const result of finals) {
      const mine = result.teamA === teamId ? result.scoreA : result.teamB === teamId ? result.scoreB : null;
      if (mine === null) continue;
      const theirs = result.teamA === teamId ? result.scoreB : result.scoreA;
      stat.played += 1;
      stat.points += mine;
      stat.pointDiff += mine - theirs;
      if (mine > theirs) stat.wins += 1;
    }
    return stat;
  });
  const complete = finals.length >= (teamIds.length * (teamIds.length - 1)) / 2;

  function byOrganizer(group: Stat[]): Placed[] {
    const rank = (stat: Stat) => {
      const called = organizerOrder.indexOf(stat.teamId);
      return called >= 0 ? called : 1000 + stat.index;
    };
    const called = group.every((stat) => organizerOrder.includes(stat.teamId));
    const tie: SeedRule = called ? "organizer" : complete ? "unresolved" : "level";
    return [...group].sort((a, b) => rank(a) - rank(b)).map((stat, i) => ({ stat, decidedBy: i === 0 ? null : tie }));
  }

  function headToHead(group: Stat[]): Placed[] | null {
    if (group.length !== 2) return null;
    const [a, b] = group;
    const final = finalBetween(finals, a.teamId, b.teamId);
    if (!final) return null;
    const [winner, loser] = final[0] > final[1] ? [a, b] : [b, a];
    return [
      { stat: winner, decidedBy: null },
      { stat: loser, decidedBy: "headToHead" },
    ];
  }

  /** Orders a tied group from rule `from` on. The first Team's decidedBy is left for the caller. */
  function resolve(group: Stat[], from: number): Placed[] {
    if (group.length === 1) return [{ stat: group[0], decidedBy: null }];
    if (from > 0) {
      const settled = headToHead(group);
      if (settled) return settled;
    }
    for (let step = Math.max(from - 1, 0); step < KEYS.length; step++) {
      const { rule, key } = KEYS[step];
      const values = [...new Set(group.map(key))].sort((a, b) => b - a);
      if (values.length === 1) continue;
      return values.flatMap((value, bucket) =>
        resolve(
          group.filter((stat) => key(stat) === value),
          1,
        ).map((placed, i) => (bucket > 0 && i === 0 ? { ...placed, decidedBy: rule } : placed)),
      );
    }
    return byOrganizer(group);
  }

  return resolve(stats, 0).map(({ stat, decidedBy }, index) => ({
    teamId: stat.teamId,
    position: index + 1,
    wins: stat.wins,
    pointDiff: stat.pointDiff,
    points: stat.points,
    played: stat.played,
    decidedBy: index === 0 ? null : decidedBy,
  }));
}

const RULE_LABELS: Record<SeedRule, string> = {
  wins: "More Dreambreakers won",
  headToHead: "Won head-to-head",
  pointDiff: "Point difference",
  points: "Total points",
  organizer: "Organizer's call",
  unresolved: "Tied on every count: an Organizer picks",
  level: "Level so far",
};

/** How the standings say what decided a place. */
export function seedRuleLabel(rule: SeedRule): string {
  return RULE_LABELS[rule];
}

// ---- Rotation ----------------------------------------------------------------

export const POINTS_PER_CHANGE = 3;

/**
 * A Team's Rotation: the order an Organizer set, or by DUPR, highest first,
 * blank DUPRs last. Players added after an Organizer's order go on the end.
 */
export function rotationOf<P extends { dupr: number | null; rotation: number | null }>(players: readonly P[]): P[] {
  const rank = (player: P) => player.rotation ?? Number.POSITIVE_INFINITY;
  return [...players].sort(
    (a, b) => rank(a) - rank(b) || (b.dupr ?? Number.NEGATIVE_INFINITY) - (a.dupr ?? Number.NEGATIVE_INFINITY),
  );
}

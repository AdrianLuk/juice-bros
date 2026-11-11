/**
 * How the Chart presents a Leaderboard (direction contract,
 * .impeccable/surfaces/src-app-tools-mic-drop.md). Pure, so `npm test` covers
 * it without a database: the counting itself lives in the database read.
 */

/** How far a row moved since the Leaderboard this phone last showed. */
export type Movement = { kind: "same" } | { kind: "up" | "down"; by: number } | { kind: "new" };

/** The order a phone last showed, and each row's mark from the last change. */
export type ChartState = {
  order: string[];
  marks: Record<string, Movement>;
};

/**
 * The marks for a new read, given what this phone showed before. The first
 * read marks nothing as moved, and a read in the same order keeps the marks
 * from the last change, so a mark stays up until the chart moves again.
 */
export function nextChart(previous: ChartState | null, order: string[]): ChartState {
  if (previous && sameOrder(previous.order, order)) return previous;

  const before = new Map((previous?.order ?? order).map((id, index) => [id, index]));
  const marks: Record<string, Movement> = {};
  order.forEach((id, index) => {
    const was = before.get(id);
    if (was === undefined) marks[id] = { kind: "new" };
    else if (was > index) marks[id] = { kind: "up", by: was - index };
    else if (was < index) marks[id] = { kind: "down", by: index - was };
    else marks[id] = { kind: "same" };
  });
  return { order, marks };
}

/**
 * Each Contestant's rank on the chart: tied Contestants share one, and the
 * next rank skips past them (9, 7, 7, 4 ranks 1, 2, 2, 4). A Contestant with
 * no Votes has no rank yet, so a fresh Poll doesn't read as an all-way tie.
 */
export function chartRanks(entries: { id: string; votes: number }[]): Record<string, number | null> {
  const ranks: Record<string, number | null> = {};
  for (const entry of entries) {
    ranks[entry.id] =
      entry.votes === 0 ? null : 1 + entries.filter((other) => other.votes > entry.votes).length;
  }
  return ranks;
}

/** A bar's length, 0 to 1: its share of the leader's Votes. */
export function barShare(votes: number, leaderVotes: number): number {
  return leaderVotes === 0 ? 0 : votes / leaderVotes;
}

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

import type { Roster } from "./types.ts";

/**
 * Turning pasted text into a Roster.
 *
 * Order is entry order and means nothing, but identity does: a Player keeps
 * its `id` across an edit so that a future Lock can point at an entry rather
 * than a position the next paste might shift. Ids are reused by name — the
 * cheapest rule that survives inserting, deleting and reordering lines, which
 * is what editing a pasted list actually looks like.
 */

const ID_PREFIX = "p";

function nextIdFrom(previous: Roster): number {
  let highest = 0;
  for (const player of previous) {
    const match = /^p(\d+)$/.exec(player.id);
    if (match) highest = Math.max(highest, Number(match[1]) + 1);
  }
  return highest;
}

export function parseRoster(text: string, previous: Roster = []): Roster {
  const names = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Each previous entry can be claimed once, so two players called Mike keep
  // their two distinct ids rather than collapsing into one.
  const unclaimed = new Map<string, string[]>();
  for (const player of previous) {
    const ids = unclaimed.get(player.name);
    if (ids) ids.push(player.id);
    else unclaimed.set(player.name, [player.id]);
  }

  let nextId = nextIdFrom(previous);
  return names.map((name) => {
    const reusable = unclaimed.get(name);
    const id = reusable?.shift() ?? `${ID_PREFIX}${nextId++}`;
    return { id, name };
  });
}

/** Names entered more than once — a notice for the organizer, never a block. */
export function duplicateNames(roster: Roster): string[] {
  const counts = new Map<string, number>();
  for (const player of roster) {
    counts.set(player.name, (counts.get(player.name) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name);
}

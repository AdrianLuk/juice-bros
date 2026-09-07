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

/** The lowest id number not already taken, so a new entry never reuses one. */
function nextIdAfter(previous: Roster): number {
  let next = 0;
  for (const player of previous) {
    const match = /^p(\d+)$/.exec(player.id);
    if (match) next = Math.max(next, Number(match[1]) + 1);
  }
  return next;
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

  let nextId = nextIdAfter(previous);
  return names.map((name) => {
    const reusable = unclaimed.get(name);
    const id = reusable?.shift() ?? `${ID_PREFIX}${nextId++}`;
    return { id, name };
  });
}

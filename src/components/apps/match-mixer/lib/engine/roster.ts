import { splitMarker } from "./mixed.ts";
import type { Roster } from "./types.ts";

/**
 * Turning pasted text into a Roster.
 *
 * Order is entry order and means nothing, but identity does: a Player keeps
 * its `id` across an edit so that a future Lock can point at an entry rather
 * than a position the next paste might shift. Ids are reused by name — the
 * cheapest rule that survives inserting, deleting and reordering lines, which
 * is what editing a pasted list actually looks like.
 *
 * A line may end in a marker (`Sam M`), which mixed doubles reads and nothing
 * else does. It is taken off the name rather than left on it, so that a marked
 * line and a bare one describe the same Player under a different constraint:
 * ids are reused by name, and changing somebody's marker must not turn them
 * into somebody else.
 *
 * `marked` is why that is a parameter and not just the regex. A club roster
 * that tells two Sarahs apart by last initial types exactly what a marker
 * looks like, so reading one off every line unconditionally would quietly
 * delete the initial — and only for the two letters, leaving `Mike T` intact
 * beside a `Sarah M` that had become a second `Sarah`. The duplicate notice
 * would then fire on names the organizer had already disambiguated. So the
 * marker is read only when the organizer has asked for mixed doubles, and the
 * default is the reading every Roster has always had.
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

export function parseRoster(
  text: string,
  previous: Roster = [],
  marked = false,
): Roster {
  const entries = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => (marked ? splitMarker(line) : { name: line }));

  // Each previous entry can be claimed once, so two players called Mike keep
  // their two distinct ids rather than collapsing into one.
  const unclaimed = new Map<string, string[]>();
  for (const player of previous) {
    const ids = unclaimed.get(player.name);
    if (ids) ids.push(player.id);
    else unclaimed.set(player.name, [player.id]);
  }

  let nextId = nextIdAfter(previous);
  return entries.map(({ name, marker }) => {
    const reusable = unclaimed.get(name);
    const id = reusable?.shift() ?? `${ID_PREFIX}${nextId++}`;
    // The key is left off a bare line rather than set to `undefined`, so an
    // unmarked Roster is the same value it has always been.
    return marker ? { id, name, marker } : { id, name };
  });
}

/**
 * Names carried by more than one Player, first appearance first.
 *
 * Never a reason to refuse a Roster: two Mikes schedule perfectly well, and
 * the engine has ids to tell them apart. It is the printout that can't, which
 * is why this exists only to hand the UI a quiet inline notice.
 *
 * The marker is no part of the question. Two Sams, one marked `M` and one
 * marked `F`, are still two Sams — this notice is about what the printed board
 * can tell apart, and the board prints no markers.
 *
 * Matching is exact, so "mike" and "Mike" are two different players — whether
 * they are the same person is the organizer's call and not a guess to make on
 * their behalf.
 */
export function duplicateNames(roster: Roster): string[] {
  const counts = new Map<string, number>();
  for (const player of roster) {
    counts.set(player.name, (counts.get(player.name) ?? 0) + 1);
  }
  // Walked in Roster order and de-duplicated on the way, so the answer reads
  // in the order the names were typed rather than the order they repeated.
  const seen = new Set<string>();
  const repeated: string[] = [];
  for (const player of roster) {
    if (seen.has(player.name)) continue;
    seen.add(player.name);
    if ((counts.get(player.name) ?? 0) > 1) repeated.push(player.name);
  }
  return repeated;
}

import { rosterLine, splitMarker } from "./mixed.ts";
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

/**
 * A line beginning this is a Pool header and never a Player (ADR 0005). `---`
 * rather than a blank line, because `parseRoster` already drops blank lines —
 * a list pasted out of a group chat routinely carries stray ones, and a
 * blank-line divider would silently split every Roster that already exists,
 * in saved Configs and in Share Links, into Pools nobody asked for. `---`
 * read as a Player before this existed too, which is a change of meaning, but
 * a visible one on a name nobody has.
 */
const POOL_HEADER_PREFIX = "---";

/** Labels land on a rail label and on paper, so they are kept short. */
const MAX_POOL_LABEL_LENGTH = 24;

function isPoolHeaderLine(line: string): boolean {
  return line.startsWith(POOL_HEADER_PREFIX);
}

/** The label on a header line, trimmed and capped, or `null` for a bare one. */
function poolHeaderLabel(line: string): string | null {
  const label = line.slice(POOL_HEADER_PREFIX.length).trim();
  return label.length > 0 ? label.slice(0, MAX_POOL_LABEL_LENGTH) : null;
}

/**
 * One `---` line in the Roster: where it sits, and what it is called.
 *
 * `start` is a position in the parsed Roster — the index of the first Player
 * below this header — not a line number, because blank lines and other
 * headers do not count toward it and `parsePoolHeaders` has to agree with
 * `parseRoster` about where a Player begins without seeing the same text
 * twice.
 */
export interface PoolHeader {
  /** Trimmed and capped at `MAX_POOL_LABEL_LENGTH`; `null` for a bare `---`. */
  readonly label: string | null;
  readonly start: number;
}

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
  // Headers are read before Markers, and before anything else on the line: a
  // line starting `---` is never a Player and never carries a Marker, so
  // `--- F` under mixed doubles is a Pool called "F" and not a lone `F`.
  const entries = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !isPoolHeaderLine(line))
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

/**
 * Every Pool header in the Roster, in the order they were typed.
 *
 * Reads the same text `parseRoster` does and has to agree with it about where
 * a Player begins: a blank line is dropped by both, a header line is a
 * Player to neither. `start` is that shared position, which is what lets
 * `declaredPools` (in `pools.ts`) turn this list into ranges over the Roster
 * `parseRoster` returned, without either function having to know about the
 * other's output.
 *
 * An empty list is the ordinary Roster this app has always read: no `---`
 * line, no declared Pool, and the Pool count decides the split as it always
 * has (ADR 0005).
 */
export function parsePoolHeaders(text: string): PoolHeader[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const headers: PoolHeader[] = [];
  let position = 0;
  for (const line of lines) {
    if (isPoolHeaderLine(line)) {
      headers.push({ label: poolHeaderLabel(line), start: position });
    } else {
      position += 1;
    }
  }
  return headers;
}

/**
 * A Roster and its headers, back as the text that would parse into them —
 * the inverse of `parseRoster` and `parsePoolHeaders` together.
 *
 * This is what "Keep this split" writes into the roster box, and what a saved
 * visit or a Share Link reconstructs the box from: both keep the Roster and
 * its headers as structured values rather than raw text, so this is the one
 * place either turns back into the lines an organizer would type. Player
 * lines round-trip through `rosterLine`, which is also what carries a Marker.
 */
export function rosterText(
  roster: Roster,
  headers: readonly PoolHeader[],
): string {
  const lines: string[] = [];
  let next = 0;
  for (let i = 0; i <= roster.length; i++) {
    while (next < headers.length && headers[next].start === i) {
      const header = headers[next];
      lines.push(
        header.label ? `${POOL_HEADER_PREFIX} ${header.label}` : POOL_HEADER_PREFIX,
      );
      next += 1;
    }
    if (i < roster.length) lines.push(rosterLine(roster[i]));
  }
  return lines.join("\n");
}

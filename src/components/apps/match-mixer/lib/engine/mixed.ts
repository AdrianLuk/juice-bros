import {
  MARKERS,
  type Format,
  type Marker,
  type Player,
  type Roster,
} from "./types.ts";

/**
 * Mixed doubles: the marker on the Roster line, and the arithmetic that
 * decides whether a marked Roster can be seated at all.
 *
 * This is the one constraint a rotation cannot launder on its own. A lopsided
 * skill pairing is transient — over eight rounds everybody partners everybody,
 * so it comes out in the wash — but a mixed-doubles night is either mixed or
 * it is not, and no amount of rotating turns two `M`s on one side into one of
 * each. So it is a hard constraint inside the generator's seating rather than
 * a weight the search is free to trade away, and this module is where the rest
 * of the app asks what it costs.
 *
 * The marker rides on the roster line and never in a form field of its own:
 * `Sam M`, `Anna Leigh Waters F`. A single trailing token is what keeps the
 * parse honest — there is no range to guess at, and no question of whether a
 * name ends in one. It is also what lets the marker travel: the Share Link
 * carries the line rather than the name, so a marked board opens marked.
 *
 * Like everything under `lib/engine`, this imports no React and uses no `@/`
 * alias — it has to resolve under plain `node --test`.
 */

/**
 * A line, split into the name and the marker it ends with.
 *
 * Case is not the organizer's problem: `sam m` marks the same as `Sam M`, and
 * the answer comes back in the letter the rest of the app prints. A line that
 * is *only* a marker is a name — somebody called M is a person, and a line
 * with nothing before the token has no name to attach it to.
 */
const MARKED_LINE = /^(.*\S)\s+([MFmf])$/;

export function splitMarker(line: string): {
  name: string;
  marker?: Marker;
} {
  const match = MARKED_LINE.exec(line);
  if (!match) return { name: line };
  return { name: match[1], marker: match[2].toUpperCase() as Marker };
}

/**
 * A Player back as the line that was typed, which is the form that survives
 * being handed round: the Share Link encodes these rather than bare names, so
 * the marker cannot be parsed off one end of the journey and dropped at the
 * other. A reader would have no way to tell — an unmixed board looks exactly
 * like the mixed one that was shared.
 *
 * The same string is what goes back into the roster box after a reload, and
 * what the stale-board key is taken over.
 */
export function rosterLine(player: Pick<Player, "name" | "marker">): string {
  return player.marker ? `${player.name} ${player.marker}` : player.name;
}

/** How the Roster divides, and how much of it has not said. */
export interface MarkerCounts {
  readonly M: number;
  readonly F: number;
  /** Lines with no marker on the end. Any at all and the toggle refuses. */
  readonly unmarked: number;
}

export function countMarkers(roster: Roster): MarkerCounts {
  let m = 0;
  let f = 0;
  let unmarked = 0;
  for (const player of roster) {
    if (player.marker === "M") m += 1;
    else if (player.marker === "F") f += 1;
    else unmarked += 1;
  }
  return { M: m, F: f, unmarked };
}

/**
 * Whether the constraint actually applies. Mixed doubles is a qualifier on
 * rotating partners and means nothing in any other Format — fixed partners
 * takes its pairs off the list two lines at a time, and there is nothing left
 * for a marker to decide. Normalized here rather than trusted to the screen,
 * so a Config assembled anywhere else cannot carry a constraint that applies
 * to nothing.
 */
export function resolveMixed(
  format: Format,
  mixed: boolean | undefined,
): boolean {
  return format === "rotating" && mixed === true;
}

/**
 * The Roster as one marker per position, or `null` if any line is bare. The
 * generator and the Scorer both work in indices, so this is the shape the
 * constraint reaches them in.
 */
export function markersOf(roster: Roster): readonly Marker[] | null {
  const markers: Marker[] = [];
  for (const player of roster) {
    if (!player.marker) return null;
    markers.push(player.marker);
  }
  return markers;
}

/**
 * How many partnerships a mixed night has to spend: `M × F` rather than
 * `n(n − 1) / 2`, because a same-marker pair is not a partnership this board
 * can ever draw.
 *
 * Two things read the supply and both would be wrong left alone — the
 * consequence line's "there are enough partnerships to go round", and the
 * Scorer's `pairingsPossible` — so it is worked out once, here.
 *
 * `undefined` when the constraint does not apply, which is the shape
 * `naturalLength` and the Scorer both take to mean "the whole triangle".
 *
 * A Roster part-way through being marked comes back `undefined` too, rather
 * than the `0` its counts would multiply out to while the first line still has
 * no `F` on it. `naturalLength` reads `partnerships ?? triangle`, and `0` is
 * not absent — it is a supply of nothing, which floors the rotation at one
 * Round. The organizer would watch the Rounds dial drop to 1 and climb back on
 * its own as the last marker landed, showing a number nobody chose. Nothing
 * can be drawn in that window anyway: the refusal is already on screen.
 */
export function partnershipSupply(
  roster: Roster,
  mixed: boolean,
): number | undefined {
  if (!mixed) return undefined;
  const counts = countMarkers(roster);
  if (counts.unmarked > 0) return undefined;
  return counts.M * counts.F;
}

/** The most courts this Roster's markers can fill as mixed doubles. */
export function maxMixedCourts(counts: MarkerCounts): number {
  return Math.floor(Math.min(counts.M, counts.F) / 2);
}

/**
 * How many courts to offer before the organizer has said, or `undefined` to
 * leave that to the Roster size as usual.
 *
 * This is a default and deliberately not a ceiling. How many courts there are
 * is a fact about the evening rather than a number to optimize — they are
 * booked, and clamping the field to what the markers allow would quietly take
 * one away and call it a fix. So the field still accepts the three courts the
 * organizer actually has, and answers with the arithmetic for why this list
 * cannot fill them.
 *
 * What it does fix is the opening state. Ten `M` and six `F` would otherwise
 * offer `floor(n / 4)` = four courts, which the constraint refuses, so ticking
 * the box on a perfectly drawable Roster would grey the button out before
 * anybody had chosen anything.
 *
 * `undefined` while a line is still unmarked, for the reason
 * `partnershipSupply` gives, and when no court count works at all — below two
 * of a side the answer is the refusal, not a silent zero.
 */
export function mixedCourtDefault(
  roster: Roster,
  mixed: boolean,
): number | undefined {
  if (!mixed) return undefined;
  const counts = countMarkers(roster);
  if (counts.unmarked > 0) return undefined;
  return maxMixedCourts(counts) || undefined;
}

function lines(count: number): string {
  return `${count} ${count === 1 ? "line" : "lines"}`;
}

function courtsWord(count: number): string {
  return `${count} ${count === 1 ? "court" : "courts"}`;
}

/**
 * Why this Roster cannot be drawn as mixed doubles, in words, or `null` when
 * it can. Asked by the screen before the button is pressed and again at
 * `generateSchedule`, for the same reason `formatObjection` is: a Config
 * assembled anywhere else must not be able to produce a board with somebody
 * dropped off it.
 *
 * Two refusals, and both have arithmetic in them rather than a shrug.
 *
 * Half a marked roster is the first. It produces teams that may or may not be
 * mixed, which is precisely the quiet lopsidedness a hard constraint exists to
 * prevent, so the message says how many lines are short rather than leaving
 * the organizer to find them.
 *
 * The counts not reaching round the courts is the second. For `c` courts a
 * Round seats `2c` of each, so ten `M` and four `F` cannot fill three courts:
 * six `M` sit out every single Round and the Bye rotation is broken before the
 * search starts. The message names the shortfall and both ways out — fewer
 * courts, or more of the short side — because either is a fix the organizer
 * can make standing at the net.
 */
export function mixedObjection(
  roster: Roster,
  courts: number,
  mixed: boolean,
): string | null {
  if (!mixed) return null;

  const counts = countMarkers(roster);
  if (counts.unmarked > 0) {
    return `Mixed doubles reads an M or an F off the end of each line, and ${lines(counts.unmarked)} ${counts.unmarked === 1 ? "is" : "are"} missing one. Add a marker to ${counts.unmarked === 1 ? "it" : "them"}, or turn mixed doubles off.`;
  }

  const needed = courts * 2;
  // At most one side can be short: both would mean the Roster holds fewer
  // than `4c` names, and the court count is already clamped to `n / 4`.
  const short = counts.M < needed ? "M" : counts.F < needed ? "F" : null;
  if (!short) return null;

  const have = counts[short];
  const ceiling = maxMixedCourts(counts);
  const seats = `${courtsWord(courts)} of mixed doubles seats ${needed} M and ${needed} F every round, and the list has ${have} ${short}.`;
  const more = `add ${needed - have} more ${short}`;

  // Below two of a side there is no court count that works, so offering to
  // drop to none would be a way out that is not one.
  return ceiling < 1
    ? `${seats} ${more[0].toUpperCase()}${more.slice(1)}.`
    : `${seats} Drop to ${courtsWord(ceiling)}, or ${more}.`;
}

/** "6 M, 6 F" — the readback that says the markers were read as typed. */
export function describeMarkers(counts: MarkerCounts): string {
  return MARKERS.map((marker) => `${counts[marker]} ${marker}`).join(", ");
}

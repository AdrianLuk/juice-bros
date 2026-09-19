import {
  DEFAULT_FORMAT,
  type Format,
  type PlayerIndex,
  type Roster,
  type Team,
} from "./types.ts";

/**
 * What a Format is, said once: its name, the Pairings it makes out of a
 * Roster, and why a particular Roster cannot be drawn in it.
 *
 * A Format is a generator and not a cost term (ADR 0003), so the arithmetic
 * that decides whether a Config is drawable at all differs between them and
 * has to live somewhere both the engine and the screen can ask. The screen
 * asks before drawing, so it can refuse with a message instead of a board; the
 * engine asks again at the entry point, so a Config assembled anywhere else
 * still cannot produce a Schedule with somebody missing from it.
 *
 * Like everything under `lib/engine`, this imports no React and uses no `@/`
 * alias — it has to resolve under plain `node --test`.
 */

/** Absent reads as rotating: a Config written before Formats existed. */
export function resolveFormat(format: Format | undefined): Format {
  return format ?? DEFAULT_FORMAT;
}

/**
 * The Formats in the order the row offers them, rotating first because it is
 * the default and the one most nights are, singles last because it is the one
 * that is not doubles at all.
 */
export const FORMATS: readonly Format[] = ["rotating", "fixed", "singles"];

/** Title case, for the control that selects it. */
export const FORMAT_LABELS: Record<Format, string> = {
  rotating: "Rotating partners",
  fixed: "Fixed partners",
  singles: "Singles",
};

/** What the row's options say underneath their own names. */
export const FORMAT_NOTES: Record<Format, string> = {
  rotating: "Nobody partners the same person twice.",
  fixed: "Two names to a pair, down the list. Pairs stay together all night.",
  singles: "One against one, two to a court. Nobody plays the same person twice.",
};

/** True where a side is one Player rather than two. */
export function isSingles(format: Format): boolean {
  return format === "singles";
}

/** How many Players a court seats in this Format: four, or two in singles. */
export function seatsPerCourt(format: Format): number {
  return isSingles(format) ? 2 : 4;
}

/** Lower case, for the middle of a sentence and for the board's particulars. */
export function formatName(format: Format): string {
  return FORMAT_LABELS[format].toLowerCase();
}

/**
 * The Pairings a Roster of this size makes in fixed partners: consecutive
 * lines, two at a time, in the order they were typed.
 *
 * This is the one place in Match Mixer where Roster order means something.
 * Everywhere else it is entry order and carries nothing — not a seeding, not a
 * ranking — but a night of fixed partners is a night where people turn up
 * already partnered, and pasting the pair together is how the organizer says
 * so. There is no other way for them to: a marker on the line is RR-4.3's
 * mechanism and does not exist yet, and drawing the pairs by Seed would make
 * the one thing this Format is for unsayable.
 *
 * An odd Roster leaves a trailing name with nobody to partner. That is not a
 * Pairing and it is not a Bye either, so it is refused rather than dropped —
 * see `formatObjection`.
 */
export function pairsOf(n: number): Team[] {
  const teams: Team[] = [];
  for (let i = 0; i + 1 < n; i += 2) teams.push([i, i + 1]);
  return teams;
}

/**
 * Which Pairing a Player belongs to: the inverse of `pairsOf`, and written
 * beside it so the two cannot drift. The Scorer needs it to count meetings
 * between Pairings and the grid needs it to mark a rematch, and a board where
 * those two disagreed would ring a Game the summary line called clean.
 */
export function pairIndexOf(player: PlayerIndex): number {
  return Math.floor(player / 2);
}

/**
 * Why this Roster cannot be drawn in this Format, in words, or `null` when it
 * can. Roster size itself is not this function's question — 4 to 32 is
 * `isSupportedRosterSize`, and it holds in every Format.
 *
 * Only fixed partners has an objection. Rotating seats an odd Roster by giving
 * somebody a Bye, and singles seats one the same way — an odd list there is
 * the ordinary case rather than a list with a name left over, because a side
 * is one Player and the leftover has a Bye to take.
 *
 * The message names who is left over, because "needs an even number" leaves
 * the organizer counting a list they have already counted. It is a refusal
 * with the fix in it.
 */
export function formatObjection(
  roster: Roster,
  format: Format,
): string | null {
  if (format !== "fixed" || roster.length % 2 === 0) return null;

  const spare = roster[roster.length - 1]?.name ?? "the last name";
  return `Fixed partners pairs the list up two lines at a time, so it needs an even number of names. ${spare} is on the end with nobody to partner. Add one more name, or take ${spare} off the list.`;
}

/**
 * Placing each opening Matchup's Court pair by tapping a Venue's map (#698).
 *
 * Nothing here is stored: the map reads the Home court text the setup form
 * already holds, and a tap writes Home court text back. So a pasted brief, a
 * typed Home court and a tap all land in the same place, and a Team Event
 * saves exactly as it did before Venues.
 *
 * Relative imports only, so `node --test` loads it.
 */
import { touchingCourts, type CourtGrid, type GridCourt } from "../court-grid/grid.ts";

/** One Matchup's two Home courts as the form holds them, red then blue. */
export interface HomeCourts {
  readonly red: string;
  readonly blue: string;
}

/** A Matchup's courts as read off the Venue: `null` where the text names no court on it. */
export interface PlacedPair {
  readonly red: number | null;
  readonly blue: number | null;
}

/** The court a Home court names on this Venue, or `null`. */
export function courtOnVenue(grid: CourtGrid, homeCourt: string): number | null {
  const text = homeCourt.trim();
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return grid.courts.some((court) => court.number === number) ? number : null;
}

/** A Home court the Organizer filled in that this Venue has no court for. */
export function offVenue(grid: CourtGrid, homeCourt: string): boolean {
  return homeCourt.trim() !== "" && courtOnVenue(grid, homeCourt) === null;
}

export function placedPairs(grid: CourtGrid, matchups: readonly HomeCourts[]): PlacedPair[] {
  return matchups.map(({ red, blue }) => ({ red: courtOnVenue(grid, red), blue: courtOnVenue(grid, blue) }));
}

function courtNumbered(grid: CourtGrid, number: number): GridCourt | undefined {
  return grid.courts.find((court) => court.number === number);
}

/** Two courts that share an edge on the Venue's grid: "adjacent" in Team Tally's glossary. */
export function courtsTouch(grid: CourtGrid, a: number, b: number): boolean {
  const here = courtNumbered(grid, a);
  return here !== undefined && touchingCourts(grid, here.row, here.col).some((court) => court.number === b);
}

/** The Matchup that holds this court, as red or blue, or `null`. First one wins if two claim it. */
export function ownerOf(
  pairs: readonly PlacedPair[],
  court: number,
): { index: number; side: "red" | "blue" } | null {
  for (const [index, pair] of pairs.entries()) {
    if (pair.red === court) return { index, side: "red" };
    if (pair.blue === court) return { index, side: "blue" };
  }
  return null;
}

/** Waiting on its blue court: the red one is placed, the blue one is not. */
export function awaitingBlue(pair: PlacedPair | undefined): pair is PlacedPair & { red: number } {
  return pair !== undefined && pair.red !== null && pair.blue === null;
}

/** The Matchup to start on: the first without both courts, else the first. */
export function firstOpen(pairs: readonly PlacedPair[]): number {
  const open = pairs.findIndex((pair) => pair.red === null || pair.blue === null);
  return open === -1 ? 0 : open;
}

/** The next Matchup without both courts after `index`, wrapping round; `index` when every one has them. */
function nextOpen(pairs: readonly PlacedPair[], index: number): number {
  for (let step = 1; step < pairs.length; step++) {
    const candidate = (index + step) % pairs.length;
    const pair = pairs[candidate];
    if (pair.red === null || pair.blue === null) return candidate;
  }
  return index;
}

/** What a tap does: Home courts to write (only the ones it changes) and the Matchup now active. */
export interface TapResult {
  readonly writes: readonly { index: number; side: "red" | "blue"; homeCourt: string }[];
  readonly active: number;
}

/**
 * The Organizer taps `court` while placing Matchup `active`:
 *
 * - a court another Matchup holds jumps to that Matchup;
 * - a court this Matchup holds clears its pair and starts it again from that court;
 * - with the red court placed and the blue one not, a court touching the red
 *   one becomes blue and the next Matchup without courts becomes active; the
 *   red court itself is taken back; any other court becomes red instead;
 * - otherwise the court becomes red and blue is cleared, waiting for the second tap.
 */
export function tapCourt(
  grid: CourtGrid,
  pairs: readonly PlacedPair[],
  active: number,
  court: number,
): TapResult {
  const owner = ownerOf(pairs, court);
  if (owner && owner.index !== active) return { writes: [], active: owner.index };

  const pair = pairs[active];
  if (!pair) return { writes: [], active };
  const red = (homeCourt: string) => ({ index: active, side: "red" as const, homeCourt });
  const blue = (homeCourt: string) => ({ index: active, side: "blue" as const, homeCourt });

  if (awaitingBlue(pair)) {
    if (court === pair.red) return { writes: [red("")], active };
    if (courtsTouch(grid, pair.red, court)) {
      const placed = pairs.map((each, index) => (index === active ? { red: pair.red, blue: court } : each));
      return { writes: [blue(String(court))], active: nextOpen(placed, active) };
    }
  }
  return { writes: [red(String(court)), blue("")], active };
}

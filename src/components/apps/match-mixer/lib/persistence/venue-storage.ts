import { readGrid, type CourtGrid } from "../../../../../lib/court-grid/grid.ts";

/**
 * Venues (#697): facilities an organizer has drawn on the court grid, kept in
 * this browser by name so next week is a tap rather than a drawing. As many as
 * the organizer plays at. Match Mixer has no account before Go Live, so they
 * live here; following the account once signed in is later work (#691).
 *
 * Relative imports only, so `node --test` loads it. Every read and write is
 * wrapped: a private window or a full disk loses the list, never the screen.
 */

const KEY = "juicebros.matchmixer.venues";
const SCHEMA = 1;
/** Long enough for any facility's name, short enough to fit a chip. */
export const MAX_VENUE_NAME = 40;

export interface Venue {
  readonly name: string;
  readonly grid: CourtGrid;
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** The saved venues, oldest first. Damaged entries are skipped, not fatal. */
export function loadVenues(): Venue[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return [];
    const { venues } = parsed as { venues?: unknown };
    if (!Array.isArray(venues)) return [];
    const read: Venue[] = [];
    for (const entry of venues) {
      if (typeof entry !== "object" || entry === null) continue;
      const { name, grid } = entry as { name?: unknown; grid?: unknown };
      const courts = readGrid(grid);
      if (typeof name !== "string" || !name.trim() || !courts) continue;
      if (read.some((venue) => sameName(venue.name, name))) continue;
      read.push({ name: name.trim().slice(0, MAX_VENUE_NAME), grid: courts });
    }
    return read;
  } catch {
    return [];
  }
}

function write(venues: readonly Venue[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ schema: SCHEMA, venues }));
  } catch {
    // Private mode or a full disk: the drawing stays on screen, unsaved.
  }
}

/**
 * Keeps a venue under its name, replacing one already kept under the same name
 * (ignoring case and spaces at the ends). Returns the list after saving, or
 * `null` when there is nothing to keep: no name, or no courts.
 */
export function saveVenue(name: string, grid: CourtGrid): Venue[] | null {
  const trimmed = name.trim().slice(0, MAX_VENUE_NAME);
  if (!trimmed || grid.courts.length === 0) return null;
  if (typeof window === "undefined") return null;
  const venue: Venue = { name: trimmed, grid };
  const venues = loadVenues();
  const at = venues.findIndex((kept) => sameName(kept.name, trimmed));
  const next = at === -1 ? [...venues, venue] : venues.map((kept, i) => (i === at ? venue : kept));
  write(next);
  return next;
}

/** Forgets one venue. Returns the list that is left. */
export function deleteVenue(name: string): Venue[] {
  if (typeof window === "undefined") return [];
  const next = loadVenues().filter((venue) => !sameName(venue.name, name));
  write(next);
  return next;
}

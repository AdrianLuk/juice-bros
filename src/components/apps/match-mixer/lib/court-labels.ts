/**
 * Court labels (#697): the numbers a facility prints on the courts booked
 * tonight, in court order. A Court in Match Mixer is still a column, counted
 * from zero across the night; a label is only what that column is called.
 * Nothing that draws a board reads one, so no label can move a seat.
 *
 * Relative imports only, so `node --test` loads it.
 */

import { MAX_COURT_NUMBER } from "../../../../lib/court-grid/grid.ts";

/** The highest number a facility prints on a court: the court grid's own limit. */
export const MAX_COURT_LABEL = MAX_COURT_NUMBER;

/**
 * Tonight's Court Labels, by court: the first names court 0. Ascending court
 * number, because that is the order a Venue's booked courts come off the grid.
 * `null` or absent is a board numbered 1 to N.
 */
export type CourtLabels = readonly number[] | null | undefined;

/** What a court is called: its label when the board has them, else 1 to N. */
export function courtLabel(court: number, labels?: CourtLabels): string {
  return String(labels?.[court] ?? court + 1);
}

/**
 * Courts listed the way a reader says them, from court positions:
 * "court 3", "courts 14 and 17", "courts 3, 4 and 9".
 */
export function courtList(courts: readonly number[], labels?: CourtLabels): string {
  const names = courts.map((court) => courtLabel(court, labels));
  if (names.length === 1) return `court ${names[0]}`;
  return `courts ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Whether a list could label `courts` courts: one whole number per court at
 * least, each between 1 and the highest a facility prints, none repeated.
 */
export function isCourtLabels(labels: readonly number[], courts: number): boolean {
  if (labels.length < courts || labels.length === 0) return false;
  const seen = new Set<number>();
  for (const label of labels) {
    if (!Number.isInteger(label) || label < 1 || label > MAX_COURT_LABEL) return false;
    if (seen.has(label)) return false;
    seen.add(label);
  }
  return true;
}

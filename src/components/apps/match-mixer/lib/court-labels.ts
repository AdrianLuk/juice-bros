/**
 * Court labels (#697): the numbers a facility prints on the courts booked
 * tonight, in court order. A Court in Match Mixer is still a column, counted
 * from zero across the night; a label is only what that column is called.
 * Nothing that draws a board reads one, so no label can move a seat.
 *
 * Relative imports only, so `node --test` loads it.
 */

/** The highest number a facility prints on a court. Matches the court grid. */
export const MAX_COURT_LABEL = 999;

/** What a court is called: its label when the board has them, else 1 to N. */
export function courtName(court: number, labels?: readonly number[] | null): string {
  return String(labels?.[court] ?? court + 1);
}

/** The courts as a reader would list them: "court 3", "courts 14 and 17", "courts 3, 4 and 9". */
export function courtList(courts: readonly number[], labels?: readonly number[] | null): string {
  const names = courts.map((court) => courtName(court, labels));
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

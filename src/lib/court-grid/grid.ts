/**
 * The court grid: a facility drawn as squares on graph paper, one court per
 * square, numbered the way the facility numbers them.
 *
 * Facilities differ (a row of four, a 2 x 2, a plus-shaped booking inside a
 * bigger hall, two halls with a walkway), and a grid of squares covers all of
 * them while staying easy to tap on a phone. Two courts **touch** when they
 * share an edge. Match Mixer only reads the numbers; Team Tally pairs touching
 * courts for a Matchup.
 *
 * Shared by more than one app, so it knows nothing about either: no Venue
 * storage, no React, relative imports only so `node --test` loads it.
 */

/** Squares across. Fixed, so a drawing reads the same on every phone. */
export const GRID_COLUMNS = 6;
/** Squares down before anything is drawn; the grid grows past it. */
export const GRID_MIN_ROWS = 7;
/** How far down the grid can grow. Far past any facility's court count. */
export const GRID_MAX_ROWS = 20;
/** The highest court number a facility can print. */
export const MAX_COURT_NUMBER = 999;

export interface GridCourt {
  readonly row: number;
  readonly col: number;
  /** The number painted on the court, as the facility prints it. */
  readonly number: number;
}

export interface CourtGrid {
  readonly courts: readonly GridCourt[];
}

export const EMPTY_GRID: CourtGrid = { courts: [] };

export function courtAt(grid: CourtGrid, row: number, col: number): GridCourt | undefined {
  return grid.courts.find((court) => court.row === row && court.col === col);
}

function inBounds(row: number, col: number): boolean {
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    row < GRID_MAX_ROWS &&
    col >= 0 &&
    col < GRID_COLUMNS
  );
}

/** How many rows to show: the minimum, or one empty row below the lowest court. */
export function gridRows(grid: CourtGrid): number {
  const lowest = grid.courts.reduce((max, court) => Math.max(max, court.row), -1);
  return Math.min(GRID_MAX_ROWS, Math.max(GRID_MIN_ROWS, lowest + 2));
}

/** A court on an empty square, numbered one past the highest so far. */
export function addCourt(grid: CourtGrid, row: number, col: number): CourtGrid {
  if (!inBounds(row, col) || courtAt(grid, row, col)) return grid;
  const highest = grid.courts.reduce((max, court) => Math.max(max, court.number), 0);
  const number = Math.min(MAX_COURT_NUMBER, highest + 1);
  return { courts: [...grid.courts, { row, col, number }] };
}

export function removeCourt(grid: CourtGrid, row: number, col: number): CourtGrid {
  return { courts: grid.courts.filter((court) => court.row !== row || court.col !== col) };
}

/** Changes one court's number, kept between 1 and the highest a facility prints. */
export function setCourtNumber(grid: CourtGrid, row: number, col: number, number: number): CourtGrid {
  if (!Number.isInteger(number)) return grid;
  const clamped = Math.min(MAX_COURT_NUMBER, Math.max(1, number));
  return {
    courts: grid.courts.map((court) =>
      court.row === row && court.col === col ? { ...court, number: clamped } : court,
    ),
  };
}

function readingOrder(a: GridCourt, b: GridCourt): number {
  return a.row - b.row || a.col - b.col;
}

/** Every court numbered 1 to N in reading order: across each row, top to bottom. */
export function renumber(grid: CourtGrid): CourtGrid {
  const ordered = [...grid.courts].sort(readingOrder);
  return { courts: ordered.map((court, index) => ({ ...court, number: index + 1 })) };
}

/** Numbers carried by more than one court, ascending. */
export function duplicateNumbers(grid: CourtGrid): number[] {
  const seen = new Set<number>();
  const repeated = new Set<number>();
  for (const court of grid.courts) {
    if (seen.has(court.number)) repeated.add(court.number);
    seen.add(court.number);
  }
  return [...repeated].sort((a, b) => a - b);
}

function shareAnEdge(a: GridCourt, b: GridCourt): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

/** The courts that share an edge with the one on this square. */
export function touchingCourts(grid: CourtGrid, row: number, col: number): GridCourt[] {
  const here = courtAt(grid, row, col);
  if (!here) return [];
  return grid.courts.filter((court) => shareAnEdge(here, court));
}

/**
 * Every pair of touching courts as `[lower, higher]` court numbers, sorted.
 * Given `booked`, only courts with a booked number count, which is how a
 * plus-shaped booking inside a bigger hall gives only its own pairs.
 */
export function touchingPairs(
  grid: CourtGrid,
  booked?: ReadonlySet<number>,
): [number, number][] {
  const courts = booked ? grid.courts.filter((court) => booked.has(court.number)) : grid.courts;
  const pairs: [number, number][] = [];
  courts.forEach((a, index) => {
    for (const b of courts.slice(index + 1)) {
      if (shareAnEdge(a, b)) {
        pairs.push(a.number < b.number ? [a.number, b.number] : [b.number, a.number]);
      }
    }
  });
  return pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** The numbers of the courts booked tonight, ascending: the order an app lists them in. */
export function bookedNumbers(grid: CourtGrid, booked: ReadonlySet<number>): number[] {
  const numbers = new Set(grid.courts.map((court) => court.number));
  return [...booked].filter((number) => numbers.has(number)).sort((a, b) => a - b);
}

/**
 * A grid read back from storage, or `null` for anything that is not one.
 * Courts off the grid or sharing a square are refused rather than dropped.
 */
export function readGrid(value: unknown): CourtGrid | null {
  if (typeof value !== "object" || value === null) return null;
  const { courts } = value as { courts?: unknown };
  if (!Array.isArray(courts)) return null;
  const read: GridCourt[] = [];
  for (const entry of courts) {
    if (typeof entry !== "object" || entry === null) return null;
    const { row, col, number } = entry as Record<string, unknown>;
    if (typeof row !== "number" || typeof col !== "number" || !inBounds(row, col)) return null;
    if (typeof number !== "number" || !Number.isInteger(number)) return null;
    if (number < 1 || number > MAX_COURT_NUMBER) return null;
    if (read.some((court) => court.row === row && court.col === col)) return null;
    read.push({ row, col, number });
  }
  return { courts: read };
}

function block(row: number, col: number, rows: number, cols: number): CourtGrid {
  const courts: GridCourt[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      courts.push({ row: row + r, col: col + c, number: courts.length + 1 });
    }
  }
  return { courts };
}

export interface GridPreset {
  readonly id: string;
  readonly label: string;
  readonly grid: () => CourtGrid;
}

/** Shapes to start a drawing from. Neutral on purpose: never a real facility. */
export const PRESETS: readonly GridPreset[] = [
  { id: "row-4", label: "Row of 4", grid: () => block(2, 1, 1, 4) },
  { id: "2x2", label: "2 x 2", grid: () => block(2, 2, 2, 2) },
  {
    id: "plus",
    label: "Plus sign",
    grid: () => ({
      courts: [
        { row: 1, col: 2, number: 1 },
        { row: 2, col: 1, number: 2 },
        { row: 2, col: 2, number: 3 },
        { row: 2, col: 3, number: 4 },
        { row: 3, col: 2, number: 5 },
      ],
    }),
  },
  { id: "hall-4x3", label: "Big hall 4 x 3", grid: () => block(1, 1, 3, 4) },
];

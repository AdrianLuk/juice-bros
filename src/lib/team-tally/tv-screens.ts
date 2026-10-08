/**
 * The big-screen layout's choices (issue #625), kept apart from the markup so
 * they can be tested: which complete screens the TV cuts between for the
 * night's stage and how long each holds, how the standings tower splits into
 * two columns, and how Matchup score bugs lay out in two rows.
 *
 * The TV never scrolls and never shrinks type to fit. A stage with more to say
 * than one screen holds cycles to another screen instead (Matchups and the
 * standings are separate screens for exactly that reason).
 *
 * Relative imports only, for `node --test`.
 */

import { flightMatchups, isScored, type TeamEventDoc } from "./event-doc.ts";

export type TvScreenId = "standings" | "matchups" | "handoff" | "flight-scores" | "summary";

export type TvScreen = {
  id: TvScreenId;
  /** What the cycle strip names it. */
  label: string;
  /** How long the TV holds it before cutting to the next. */
  dwellMs: number;
};

const SCREEN = {
  standings: { id: "standings", label: "Standings" },
  matchups: { id: "matchups", label: "Matchups" },
  handoff: { id: "handoff", label: "Flights" },
  scores: { id: "flight-scores", label: "Flight scores" },
  summary: { id: "summary", label: "Results" },
} as const;

const seconds = (n: number) => n * 1_000;

/**
 * The screens to cycle for this night, in order. The opening round shows the
 * standings and then the Matchups. After Seeding the Flight hand-off is the
 * loudest screen: it holds alone until a Flight has a score, so a room can
 * find its new courts, and then it leads a cycle with the Flight scores. A
 * finished night leads with its results.
 */
export function tvScreens(event: Pick<TeamEventDoc, "status" | "matchups">): TvScreen[] {
  const flights = flightMatchups(event);

  if (event.status === "finished" && flights.length > 0) {
    return [
      { ...SCREEN.summary, dwellMs: seconds(18) },
      { ...SCREEN.scores, dwellMs: seconds(8) },
      { ...SCREEN.standings, label: "Opening standings", dwellMs: seconds(8) },
    ];
  }

  if (event.status === "flights" && flights.length > 0) {
    const underway = flights.some((flight) => flight.games.some(isScored));
    if (!underway) return [{ ...SCREEN.handoff, dwellMs: seconds(16) }];
    return [
      { ...SCREEN.handoff, dwellMs: seconds(16) },
      { ...SCREEN.scores, dwellMs: seconds(10) },
      { ...SCREEN.standings, label: "Opening standings", dwellMs: seconds(6) },
    ];
  }

  return [
    { ...SCREEN.standings, dwellMs: seconds(14) },
    { ...SCREEN.matchups, dwellMs: seconds(10) },
  ];
}

/** Three Flights, six Teams, on the left; the rest on the right. */
const LEFT_ROWS = 6;

/**
 * Splits the standings into the big screen's two columns: Flights A to C on
 * the left, D to G on the right. Setup caps a night at 14 Teams (seven
 * Flights), so one screen always holds them.
 */
export function splitStandings<Row extends { position: number }>(rows: readonly Row[]): { left: Row[]; right: Row[] } {
  return { left: rows.slice(0, LEFT_ROWS), right: rows.slice(LEFT_ROWS) };
}

/**
 * Columns for a screen of Matchup score bugs: up to three across, so seven
 * Matchups run 3, 3 and 1 and each bug is wide enough for large type.
 */
export function bugGridColumns(count: number): number {
  if (count <= 3) return Math.max(1, count);
  return count === 4 ? 2 : 3;
}

/**
 * How much larger than the stage's unit a screen of score bugs is set, so the
 * bugs fill the height a 1080 screen gives them instead of floating in it:
 * three rows (seven Matchups) at 1.25, two rows of three at 1.4, and a single
 * row, or two of two, at 1.5. Bounded by width too: three across at 1.5 still
 * leaves a two-line Team name its column. Done Matchups (`final`) carry a
 * FINAL bar on top, so they grow less: 1.25, and three rows of them stay at
 * the unit.
 */
export function bugGridScale(count: number, final = false): number {
  const rows = Math.ceil(count / bugGridColumns(count));
  if (final) return rows >= 3 ? 1 : 1.25;
  if (rows >= 3) return 1.25;
  return bugGridColumns(count) >= 3 && rows === 2 ? 1.4 : 1.5;
}

/** Columns for the Flight hand-off plates, in two rows: 6 are 3 across, 7 are 4 then 3. */
export function handoffGridColumns(count: number): number {
  return Math.min(4, Math.max(1, Math.ceil(count / 2)));
}

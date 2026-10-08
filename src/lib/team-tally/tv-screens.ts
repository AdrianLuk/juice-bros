/**
 * The big-screen layout's choices (issue #625), kept apart from the markup so
 * they can be tested: which complete screens the TV cuts between for the
 * night's stage and how long each holds, how the standings tower splits into
 * two columns, and how Matchup score bugs lay out, at most four to a screen
 * (issue #633).
 *
 * The TV never scrolls and never shrinks type to fit. A stage with more to say
 * than one screen holds cycles to another screen instead (Matchups and the
 * standings are separate screens for exactly that reason).
 *
 * Relative imports only, for `node --test`.
 */

import { flightMatchups, isScored, openingMatchups, type DocMatchup, type TeamEventDoc } from "./event-doc.ts";

export type TvScreenKind = "standings" | "matchups" | "handoff" | "flight-scores" | "summary";

export type TvScreen = {
  /** Unique on the night: the kind, plus "-2" for a second screen of score bugs. What `?screen=` pins. */
  id: string;
  kind: TvScreenKind;
  /** What the cycle strip names it. */
  label: string;
  /** How long the TV holds it before cutting to the next. */
  dwellMs: number;
  /** A screen of score bugs: which of its stage's Matchups it shows, as a slice [from, to). */
  bugs?: [number, number];
};

const SCREEN = {
  standings: { id: "standings", kind: "standings", label: "Standings" },
  handoff: { id: "handoff", kind: "handoff", label: "Flights" },
  summary: { id: "summary", kind: "summary", label: "Results" },
} as const;

const seconds = (n: number) => n * 1_000;

/**
 * A score bug is four rows tall (a captains' and a teammates' row per Team),
 * so a screen holds at most four, two across and two down, at a size a room
 * can read. More than four split evenly across screens: seven run 4 then 3,
 * five run 3 then 2, so no screen is left holding one bug.
 */
const BUGS_PER_SCREEN = 4;

function bugScreens(
  kind: "matchups" | "flight-scores",
  matchups: Pick<DocMatchup, "stage" | "number" | "flightLetter">[],
  dwellMs: number,
): TvScreen[] {
  const base = kind === "matchups" ? "Matchups" : "Flight scores";
  const count = Math.max(1, Math.ceil(matchups.length / BUGS_PER_SCREEN));
  const size = Math.ceil(matchups.length / count);
  const name = (matchup: (typeof matchups)[number]) =>
    matchup.stage === "flight" ? matchup.flightLetter : String(matchup.number);

  return Array.from({ length: count }, (_, index) => {
    const from = index * size;
    const to = Math.min(matchups.length, from + size);
    return {
      id: index === 0 ? kind : `${kind}-${index + 1}`,
      kind,
      label: count === 1 ? base : `${base} ${name(matchups[from])} to ${name(matchups[to - 1])}`,
      dwellMs,
      bugs: [from, to],
    };
  });
}

/**
 * The screens to cycle for this night, in order. The opening round shows the
 * standings and then the Matchups. After Seeding the Flight hand-off is the
 * loudest screen: it holds alone until a Flight has a score, so a room can
 * find its new courts, and then it leads a cycle with the Flight scores. A
 * finished night leads with its results. Matchups and Flight scores take as
 * many screens as their bugs need (`BUGS_PER_SCREEN`).
 */
export function tvScreens(event: Pick<TeamEventDoc, "status" | "matchups">): TvScreen[] {
  const flights = flightMatchups(event);

  if (event.status === "finished" && flights.length > 0) {
    return [
      { ...SCREEN.summary, dwellMs: seconds(18) },
      ...bugScreens("flight-scores", flights, seconds(8)),
      { ...SCREEN.standings, label: "Opening standings", dwellMs: seconds(8) },
    ];
  }

  if (event.status === "flights" && flights.length > 0) {
    const underway = flights.some((flight) => flight.games.some(isScored));
    if (!underway) return [{ ...SCREEN.handoff, dwellMs: seconds(16) }];
    return [
      { ...SCREEN.handoff, dwellMs: seconds(16) },
      ...bugScreens("flight-scores", flights, seconds(10)),
      { ...SCREEN.standings, label: "Opening standings", dwellMs: seconds(6) },
    ];
  }

  return [{ ...SCREEN.standings, dwellMs: seconds(14) }, ...bugScreens("matchups", openingMatchups(event), seconds(10))];
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

/** Columns for a screen of score bugs: two across, so four fill two rows; a lone bug sits centred. */
export function bugGridColumns(count: number): number {
  return count <= 1 ? 1 : 2;
}

/**
 * How much larger than the stage's unit a screen of score bugs is set, so the
 * bugs fill the height a 1080 screen gives them instead of floating in it.
 * Two rows of four-row bugs fill it at 1.5. Done Matchups (`final`) carry a
 * FINAL bar on top, so a screen with any of them is set at 1.3. Fewer bugs
 * don't grow further: the width of a column bounds them, so a long Team name
 * still gets two lines.
 */
export function bugGridScale(final = false): number {
  return final ? 1.3 : 1.5;
}

/** Columns for the Flight hand-off plates, in two rows: 6 are 3 across, 7 are 4 then 3. */
export function handoffGridColumns(count: number): number {
  return Math.min(4, Math.max(1, Math.ceil(count / 2)));
}

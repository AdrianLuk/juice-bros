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
  /**
   * A screen that is one page of several: which of its items it shows, as a
   * slice [from, to). Score bugs and hand-off plates slice their Matchups;
   * the standings slice their rows.
   */
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

/** Flight hand-off plates on one screen: two rows of up to four. */
const PLATES_PER_SCREEN = 8;

/**
 * Standings rows on one screen: two columns of up to four Flights. A bigger
 * night pages its standings across screens, a whole Flight to a row pair.
 */
const STANDINGS_PER_SCREEN = 16;

/** Splits `total` items into even pages of at most `perScreen`, as [from, to) slices. */
function pageSlices(total: number, perScreen: number, unit = 1): [number, number][] {
  const units = Math.ceil(total / unit);
  const count = Math.max(1, Math.ceil(total / perScreen));
  const size = Math.ceil(units / count) * unit;
  return Array.from({ length: count }, (_, index) => {
    const from = index * size;
    return [from, Math.min(total, from + size)] as [number, number];
  }).filter(([from, to]) => to > from || total === 0);
}

const pageId = (base: string, index: number) => (index === 0 ? base : `${base}-${index + 1}`);

function bugScreens(
  kind: "matchups" | "flight-scores",
  matchups: Pick<DocMatchup, "stage" | "number" | "flightLetter">[],
  dwellMs: number,
): TvScreen[] {
  const base = kind === "matchups" ? "Matchups" : "Flight scores";
  const slices = pageSlices(matchups.length, BUGS_PER_SCREEN);
  const name = (matchup: (typeof matchups)[number]) =>
    matchup.stage === "flight" ? matchup.flightLetter : String(matchup.number);

  return slices.map(([from, to], index) => ({
    id: pageId(kind, index),
    kind,
    label: slices.length === 1 ? base : `${base} ${name(matchups[from])} to ${name(matchups[to - 1])}`,
    dwellMs,
    bugs: [from, to],
  }));
}

const letterAt = (index: number) => String.fromCharCode(65 + index);

/** The Flight hand-off, one screen per eight Flights. */
function handoffScreens(flightCount: number, dwellMs: number): TvScreen[] {
  const slices = pageSlices(flightCount, PLATES_PER_SCREEN);
  return slices.map(([from, to], index) => ({
    ...SCREEN.handoff,
    id: pageId(SCREEN.handoff.id, index),
    label: slices.length === 1 ? SCREEN.handoff.label : `Flights ${letterAt(from)} to ${letterAt(to - 1)}`,
    dwellMs,
    ...(slices.length > 1 && { bugs: [from, to] as [number, number] }),
  }));
}

/** Flights on one Results screen: the 14-Team night's seven, champions beside Final places. */
const RESULTS_PER_SCREEN = 7;

/** The Results, one screen per seven Flights. */
function summaryScreens(flightCount: number, dwellMs: number): TvScreen[] {
  const slices = pageSlices(flightCount, RESULTS_PER_SCREEN);
  return slices.map(([from, to], index) => ({
    ...SCREEN.summary,
    id: pageId(SCREEN.summary.id, index),
    label: slices.length === 1 ? SCREEN.summary.label : `Results ${letterAt(from)} to ${letterAt(to - 1)}`,
    dwellMs,
    ...(slices.length > 1 && { bugs: [from, to] as [number, number] }),
  }));
}

/** The standings, one screen per sixteen Teams, never splitting a Flight. */
function standingsScreens(teamCount: number, dwellMs: number, label: string = SCREEN.standings.label): TvScreen[] {
  const slices = pageSlices(teamCount, STANDINGS_PER_SCREEN, 2);
  return slices.map(([from, to], index) => ({
    ...SCREEN.standings,
    id: pageId(SCREEN.standings.id, index),
    label: slices.length === 1 ? label : `${label} ${letterAt(from / 2)} to ${letterAt((to - 1) >> 1)}`,
    dwellMs,
    ...(slices.length > 1 && { bugs: [from, to] as [number, number] }),
  }));
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
  const teamCount = openingMatchups(event).length * 2;

  if (event.status === "finished" && flights.length > 0) {
    return [
      ...summaryScreens(flights.length, seconds(18)),
      ...bugScreens("flight-scores", flights, seconds(8)),
      ...standingsScreens(teamCount, seconds(8), "Opening standings"),
    ];
  }

  if (event.status === "flights" && flights.length > 0) {
    const underway = flights.some((flight) => flight.games.some(isScored));
    const handoff = handoffScreens(flights.length, seconds(16));
    if (!underway) return handoff;
    return [
      ...handoff,
      ...bugScreens("flight-scores", flights, seconds(10)),
      ...standingsScreens(teamCount, seconds(6), "Opening standings"),
    ];
  }

  return [...standingsScreens(teamCount, seconds(14)), ...bugScreens("matchups", openingMatchups(event), seconds(10))];
}

/** Three Flights, six Teams, on the left; the rest on the right. */
const LEFT_ROWS = 6;

/**
 * Splits one standings screen into the big screen's two columns: Flights A
 * to C on the left, D to G on the right at 14 Teams. A screen of 16 (a bigger
 * night's page, `standingsScreens`) runs four Flights a side.
 */
export function splitStandings<Row extends { position: number }>(rows: readonly Row[]): { left: Row[]; right: Row[] } {
  const left = rows.length > 14 ? Math.ceil(rows.length / 4) * 2 : LEFT_ROWS;
  return { left: rows.slice(0, left), right: rows.slice(left) };
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

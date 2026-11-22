/**
 * Courts and Court turns (issue #717): which Games of a Matchup play at the
 * same time, on which court, and what each court has on now and up next.
 * Pure and relative-import-only, so `node --test` loads it.
 *
 * Glossary: dink-dine-drink/CONTEXT.md ("Matchup", "Court turn"). Screens
 * never say "Court turn": a Game shows as On now, Up next or Final.
 */

import { resultBetween, turnStatuses, type SlotStatus } from "./dreambreakers.ts";
import { LINEUP_GAMES, type Lineup, type LineupGame } from "./lineup.ts";
import type { Matchup, MatchupKey } from "./matchups.ts";

/** The three ways to split four Games into two Court turns, in the order they're tried. */
const SPLITS: [LineupGame, LineupGame][][] = [
  [
    ["mens", "womens"],
    ["mixed1", "mixed2"],
  ],
  [
    ["mens", "mixed1"],
    ["womens", "mixed2"],
  ],
  [
    ["mens", "mixed2"],
    ["womens", "mixed1"],
  ],
];

/**
 * A Matchup's Games in Court turns, two at a time, never two that share a
 * player. Men's + women's doubles first when they can, then the mixed
 * Games; otherwise whichever split works. When none does, the first pair
 * that can share a Court turn goes first and the rest play alone. Without
 * both Lineups nobody is known to clash, so the preferred split stands.
 */
export function courtTurns(a: Lineup | null, b: Lineup | null): LineupGame[][] {
  const players = (game: LineupGame) => [a, b].flatMap((lineup) => (lineup ? lineup[game] : [])).filter(Boolean);
  const clash = (x: LineupGame, y: LineupGame) => players(x).some((id) => players(y).includes(id));

  const split = SPLITS.find((turns) => turns.every(([x, y]) => !clash(x, y)));
  if (split) return split.map((turn) => [...turn]);

  const pair = SPLITS.flat().find(([x, y]) => !clash(x, y));
  const alone = LINEUP_GAMES.filter((game) => !pair?.includes(game)).map((game) => [game]);
  return pair ? [[...pair], ...alone] : alone;
}

// ---- Courts -------------------------------------------------------------------

/** An Organizer's changes to a Matchup's plan: its Court turns swapped, Games moved to other courts (by index). */
export type CourtPlan = { swapped: boolean; moves: Partial<Record<LineupGame, number>> };

/** A Game of a Matchup placed: its Court turn (0 first) and its court (index into the DDD's courts). */
export type Placed = { game: LineupGame; turn: number; court: number };

/** A placed Game with its status: On now, Up next, Later or Final. */
export type PlacedGame = Placed & { status: SlotStatus };

/** Seed 1 v 4 and the Playoff for 1st take the first two courts; the other Matchups the next two. */
const FIRST_COURT: Record<MatchupKey, number> = { "round2-1v4": 0, "playoff-1st": 0, "round2-2v3": 2, "playoff-3rd": 2 };

/**
 * Each Game's Court turn and court: a Matchup's two courts in Court turn
 * order, a Game alone on the first. An Organizer's swap plays the Court
 * turns the other way round and a move puts a Game on any court. A DDD with
 * fewer than four courts wraps back to court 1.
 */
export function placeGames(key: MatchupKey, turns: LineupGame[][], plan: CourtPlan | null, courtCount: number): Placed[] {
  const ordered = plan?.swapped ? [...turns].reverse() : turns;
  const count = Math.max(courtCount, 1);
  return ordered.flatMap((games, turn) =>
    games.map((game, i) => ({ game, turn, court: (plan?.moves[game] ?? FIRST_COURT[key] + i) % count })),
  );
}

/**
 * The Court turn with a Game still to finish is On now; the one after it is
 * Up next; finished Games are Final.
 */
export function withStatuses(placed: readonly Placed[], finals: readonly LineupGame[]): PlacedGame[] {
  const statuses = turnStatuses(
    placed.map((p) => p.turn),
    placed.map((p) => finals.includes(p.game)),
  );
  return placed.map((p, index) => ({ ...p, status: statuses[index] }));
}

/** Per court, what is on now and what is up next: the first of each, in the order given. */
export function courtBoard<T extends { court: number; status: SlotStatus }>(
  courtCount: number,
  items: readonly T[],
): { now: T | null; next: T | null }[] {
  return Array.from({ length: courtCount }, (_, court) => ({
    now: items.find((item) => item.court === court && item.status === "now") ?? null,
    next: items.find((item) => item.court === court && item.status === "next") ?? null,
  }));
}

/** An Organizer's court plan as stored, by Team pairing (either way round). */
export type StoredCourtPlan = CourtPlan & { teamA: string; teamB: string };

/**
 * A whole Matchup on the courts: its Court turns from both Lineups, the
 * Organizer's plan for that pairing if any, and each Game On now, Up next,
 * later or Final by the finals in.
 */
export function placeMatchup(
  m: Matchup,
  lineups: [Lineup | null, Lineup | null],
  plans: readonly StoredCourtPlan[],
  courtCount: number,
): PlacedGame[] {
  const plan = resultBetween(plans, m.a, m.b) ?? null;
  const finals = m.games.filter((g) => g.score !== null).map((g) => g.game);
  return withStatuses(placeGames(m.key, courtTurns(...lineups), plan, courtCount), finals);
}

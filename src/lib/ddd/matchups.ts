/**
 * Round 2 and the Playoff (issue #716): Game finals, every Spread winner,
 * Spread margin and shot, the Matchup winner, the Final places and each
 * Team's shot total. Pure and relative-import-only, so `node --test` loads
 * it; the database checks a final again and stores only finals.
 *
 * Glossary: dink-dine-drink/CONTEXT.md ("Game", "Spread winner", "Spread
 * margin", "Shots", "Matchup", "Round 2", "Playoff", "Final places").
 */

import type { Seed } from "./dreambreakers.ts";
import { LINEUP_GAMES, type LineupGame } from "./lineup.ts";
import type { Side, SpreadRow } from "./spreads.ts";

const other = (side: Side): Side => (side === "a" ? "b" : "a");

export const GAME_TO = 11;

/** What stops a Game final saving, or null for a valid one: 11 to 0..9, or a 2-point win past 11. */
export function checkGameScore(a: number, b: number): string | null {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return "Scores are whole numbers.";
  const [high, low] = a > b ? [a, b] : [b, a];
  if (high < GAME_TO) return "The winner has at least 11. Enter the final score.";
  if (high - low < 2) return `Win by 2: ${a}-${b} isn't a final.`;
  if (high > GAME_TO && high - low !== 2) return "Past 11 a Game ends on a 2-point lead, like 13-11.";
  return null;
}

/** One Game measured against its Spread. */
export type GameResult = {
  /** The Pair that won once the Spread is applied. */
  spreadWinner: Side;
  /** Side a's Spread margin, unrounded; side b's is the same negated. */
  margin: number;
  /** The gap to the Spread, rounded up, never below 1. */
  shots: number;
  /** The side whose Team drinks them: the one that lost against the Spread. */
  shotsOn: Side;
};

/**
 * Measures the lower-rated Pair's points against the Spread, always, even in
 * a Game that ran past 11. `score` is [side a's points, side b's points].
 */
export function spreadResult(score: readonly [number, number], lower: Side, spread: number): GameResult {
  const lowerMargin = (lower === "a" ? score[0] : score[1]) - spread;
  const spreadWinner = lowerMargin > 0 ? lower : other(lower);
  return {
    spreadWinner,
    margin: lower === "a" ? lowerMargin : -lowerMargin,
    shots: Math.max(1, Math.ceil(Math.abs(lowerMargin))),
    shotsOn: other(spreadWinner),
  };
}

// ---- The Matchup winner ------------------------------------------------------

/** Spread winners and shots per side, [side a, side b], over the Games with a result so far. */
export function tally(games: readonly { result: GameResult | null }[]): { wins: [number, number]; shots: [number, number] } {
  const wins: [number, number] = [0, 0];
  const shots: [number, number] = [0, 0];
  for (const { result } of games) {
    if (!result) continue;
    wins[result.spreadWinner === "a" ? 0 : 1] += 1;
    shots[result.shotsOn === "a" ? 0 : 1] += result.shots;
  }
  return { wins, shots };
}

/**
 * What decided a Matchup: more Spread winners; on a 2-2, total Spread
 * margin, then raw points, then an Organizer. "unresolved" is a 2-2 level on
 * all of those, waiting on that call.
 */
export type MatchupRule = "spreadWins" | "margin" | "points" | "organizer" | "unresolved";

/** A final Game: [side a, side b] points and what the Spread made of them. */
export type ScoredGame = { score: readonly [number, number]; result: GameResult };

/** An Organizer's call on a 2-2: who won it, and why. */
export type Call = { winner: Side; reason: string };

/** The longest reason a call takes; the database checks it too. */
export const MAX_REASON = 200;

export type MatchupOutcome = {
  /** Null only while a level 2-2 waits on an Organizer. */
  winner: Side | null;
  rule: MatchupRule;
  /** Spread winners, [side a, side b]. */
  wins: [number, number];
  /** Side a's total Spread margin; side b's is the same negated. */
  margin: number;
  /** Raw points over the four Games, [side a, side b]. */
  points: [number, number];
  /** The Organizer's reason, when their call decided it. */
  reason: string | null;
};

/**
 * Who won a Matchup, or null until all four Games are final. An
 * Organizer's call overrides any 2-2 (the tiebreak below Spread margin is
 * provisional, D12) and is ignored on anything else.
 */
export function decideMatchup(games: readonly ScoredGame[], call: Call | null): MatchupOutcome | null {
  if (games.length < 4) return null;
  const { wins } = tally(games);
  const points: [number, number] = [0, 0];
  let margin = 0;
  for (const { score, result } of games) {
    points[0] += score[0];
    points[1] += score[1];
    margin += result.margin;
  }
  const outcome = (winner: Side | null, rule: MatchupRule, reason: string | null = null): MatchupOutcome => ({
    winner,
    rule,
    wins,
    margin,
    points,
    reason,
  });

  if (wins[0] !== wins[1]) return outcome(wins[0] > wins[1] ? "a" : "b", "spreadWins");
  if (call) return outcome(call.winner, "organizer", call.reason);
  // Spreads end in .5, so every margin is a multiple of 0.5 and sums exactly.
  if (margin !== 0) return outcome(margin > 0 ? "a" : "b", "margin");
  if (points[0] !== points[1]) return outcome(points[0] > points[1] ? "a" : "b", "points");
  return outcome(null, "unresolved");
}

// ---- Round 2 and the Playoff --------------------------------------------------

/** A Game final as stored: `teamA` is the Team earlier in the roster, `scoreA` its points. */
export type GameFinal = { teamA: string; teamB: string; game: LineupGame; scoreA: number; scoreB: number };

/** An Organizer's call on a 2-2 Matchup as stored, by Team. */
export type MatchupCall = { teamA: string; teamB: string; winner: string; reason: string };

/** Round 2's two Matchups, then the Playoff's two. */
export type MatchupKey = "round2-1v4" | "round2-2v3" | "playoff-1st" | "playoff-3rd";

/** One Game of a Matchup, read from side a (the Matchup's first Team). */
export type MatchupGame = {
  game: LineupGame;
  /** Null shows "Spread needed": the Game can't be scored until it is set. */
  spread: { lower: Side; points: number } | null;
  score: [number, number] | null;
  /** Null until the Game has both a Spread and a final. */
  result: GameResult | null;
};

export type Matchup = {
  key: MatchupKey;
  /** Team ids: the higher seed first in Round 2, the 1 v 4 side first in the Playoff. */
  a: string;
  b: string;
  games: MatchupGame[];
  outcome: MatchupOutcome | null;
};

const sameTeams = (row: { teamA: string; teamB: string }, a: string, b: string) =>
  (row.teamA === a && row.teamB === b) || (row.teamA === b && row.teamB === a);

/** True once all six Dreambreakers are in and no tie waits on an Organizer. */
export function seedingIsFinal(seeds: readonly Seed[]): boolean {
  return seeds.length === 4 && seeds.every((seed) => seed.played === 3 && seed.decidedBy !== "unresolved");
}

function matchup(
  key: MatchupKey,
  a: string,
  b: string,
  rows: { spreads: readonly SpreadRow[]; games: readonly GameFinal[]; calls: readonly MatchupCall[] },
): Matchup {
  const games = LINEUP_GAMES.map((game): MatchupGame => {
    const row = rows.spreads.find((each) => each.game === game && sameTeams(each, a, b));
    const flip = (rowA: string) => rowA !== a;
    const spread = row ? { lower: flip(row.teamA) ? other(row.lower) : row.lower, points: Number(row.points) } : null;
    const final = rows.games.find((each) => each.game === game && sameTeams(each, a, b));
    const score: [number, number] | null = final
      ? flip(final.teamA)
        ? [final.scoreB, final.scoreA]
        : [final.scoreA, final.scoreB]
      : null;
    return { game, spread, score, result: spread && score ? spreadResult(score, spread.lower, spread.points) : null };
  });
  const scored = games.flatMap((each) => (each.score && each.result ? [{ score: each.score, result: each.result }] : []));
  const called = rows.calls.find((each) => sameTeams(each, a, b) && (each.winner === a || each.winner === b));
  const call: Call | null = called ? { winner: called.winner === a ? "a" : "b", reason: called.reason } : null;
  return { key, a, b, games, outcome: decideMatchup(scored, call) };
}

/** A Matchup's winner and loser by Team, or null while it is undecided. */
function decided(m: Matchup): [string, string] | null {
  const winner = m.outcome?.winner;
  if (!winner) return null;
  return winner === "a" ? [m.a, m.b] : [m.b, m.a];
}

/**
 * Round 2 once the Seeding is final (Seed 1 v 4, Seed 2 v 3), then the
 * Playoff once both are decided: winners for 1st and 2nd, losers for 3rd
 * and 4th. A Team pairing meets at most once, so its stored Games and call
 * belong to whichever Matchup it is.
 *
 * Unlike Team Tally's Flights (its ADR 0001), Round 2 follows the live
 * Seeding: a corrected Dreambreaker re-pairs it, as a corrected Round 2
 * re-pairs the Playoff. Games stored for a pairing no longer playing stay in
 * the table, out of view and out of the shots, and come back if the pairing
 * does.
 */
export function doublesMatchups(
  seeds: readonly Seed[],
  rows: { spreads: readonly SpreadRow[]; games: readonly GameFinal[]; calls: readonly MatchupCall[] },
): Matchup[] {
  if (!seedingIsFinal(seeds)) return [];
  const [s1, s2, s3, s4] = seeds.map((seed) => seed.teamId);
  const round2 = [matchup("round2-1v4", s1, s4, rows), matchup("round2-2v3", s2, s3, rows)];
  const [top, bottom] = round2.map(decided);
  if (!top || !bottom) return round2;
  return [...round2, matchup("playoff-1st", top[0], bottom[0], rows), matchup("playoff-3rd", top[1], bottom[1], rows)];
}

/** First to fourth by Team, once both Playoff Matchups are decided; null before. */
export function finalPlaces(matchups: readonly Matchup[]): string[] | null {
  const first = matchups.find((m) => m.key === "playoff-1st");
  const third = matchups.find((m) => m.key === "playoff-3rd");
  const top = first && decided(first);
  const bottom = third && decided(third);
  return top && bottom ? [...top, ...bottom] : null;
}

/** The round the day is in, for the DDD header on the links. */
export function roundOf(matchups: readonly Matchup[]): string {
  if (matchups.length === 0) return "Round 1";
  if (finalPlaces(matchups)) return "Final places";
  return matchups.some((m) => m.key === "playoff-1st") ? "Playoff" : "Round 2";
}

/** One Game that cost a Team shots, read from that Team's side. */
export type ShotLine = {
  key: MatchupKey;
  game: LineupGame;
  opponent: string;
  /** [the Team's points, the opponent's]. */
  score: [number, number];
  /** `ours` when the Spread was on the Team's own Pair. */
  spread: { ours: boolean; points: number };
  shots: number;
};

/** What a Team's shot total is made of: every Game it lost against the Spread, in order of play. */
export function shotLines(teamId: string, matchups: readonly Matchup[]): ShotLine[] {
  return matchups.flatMap((m) => {
    if (m.a !== teamId && m.b !== teamId) return [];
    const us: Side = m.a === teamId ? "a" : "b";
    const opponent = us === "a" ? m.b : m.a;
    return m.games.flatMap(({ game, spread, score, result }) =>
      result && spread && score && result.shotsOn === us
        ? [
            {
              key: m.key,
              game,
              opponent,
              score: us === "a" ? score : [score[1], score[0]],
              spread: { ours: spread.lower === us, points: spread.points },
              shots: result.shots,
            } satisfies ShotLine,
          ]
        : [],
    );
  });
}

/** Every Team's shots so far, by Team id. */
export function shotTotals(teamIds: readonly string[], matchups: readonly Matchup[]): Record<string, number> {
  const totals = Object.fromEntries(teamIds.map((id) => [id, 0]));
  for (const m of matchups) {
    const { shots } = tally(m.games);
    totals[m.a] += shots[0];
    totals[m.b] += shots[1];
  }
  return totals;
}

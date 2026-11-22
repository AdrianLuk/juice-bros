/**
 * Spreads (issue #714): the 6 Team pairings, each Game's two Pairs, the
 * Spread's validation and the re-check flag. Pure and relative-import-only,
 * so `node --test` loads it.
 */

import { LINEUP_GAMES, readLineup, type Lineup, type LineupGame, type RawLineup } from "./lineup.ts";

type Member = { id: string; name: string; gender: "M" | "F" };
type Team = { id: string; players: Member[] };

export const MIN_SPREAD = 0.5;
export const MAX_SPREAD = 10.5;

/** Which side of a pairing is the lower-rated Pair: the first Team, or the second. */
export type Side = "a" | "b";

/** One saved Spread. `sig` is what the two Pairs were when it was set. */
export type SpreadRow = { teamA: string; teamB: string; game: LineupGame; lower: Side; points: number; sig: string };

/** Every pair of Teams, once, in Team order: 4 Teams make 6. */
export function pairings<T>(teams: T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) out.push([teams[i], teams[j]]);
  return out;
}

/** "Ben Johns & Ben Ortiz"; an empty slot reads "–". */
export function pairName(players: Member[], lineup: Lineup, game: LineupGame): string {
  const name = (id: string | null) => players.find((player) => player.id === id)?.name ?? "–";
  return `${name(lineup[game][0])} & ${name(lineup[game][1])}`;
}

/** The Pair a Team plays in a Game, or the Team's name before its Lineup is in. */
export function pairOf(team: Team & { name: string; lineup: RawLineup | null }, game: LineupGame): string {
  const lineup = readLineup(team.players, team.lineup);
  return lineup ? pairName(team.players, lineup, game) : team.name;
}

/** The two Pairs of a Game by player id: what a Spread was set against. A swap of players changes it. */
export function pairSig(a: Lineup, b: Lineup, game: LineupGame): string {
  const side = (lineup: Lineup) => [...lineup[game]].map((id) => id ?? "").sort().join(",");
  return `${side(a)}|${side(b)}`;
}

/** What the Lineups let a pairing show: both Teams' Lineups, or null while either is missing. */
export function lineupsOf(a: Team, b: Team, raw: Record<string, RawLineup | null | undefined>): [Lineup, Lineup] | null {
  const la = readLineup(a.players, raw[a.id]);
  const lb = readLineup(b.players, raw[b.id]);
  return la && lb ? [la, lb] : null;
}

/** True when a Lineup change since the Spread was set means it needs another look. */
export function needsRecheck(row: SpreadRow, lineups: [Lineup, Lineup]): boolean {
  return row.sig !== pairSig(lineups[0], lineups[1], row.game);
}

/** A points cell: blank, a valid Spread, or a plain message. */
export function readSpreadPoints(text: string): { value: number | null } | { problem: string } {
  const cell = text.trim();
  if (cell === "") return { value: null };
  if (!/^\d+(\.\d+)?$/.test(cell)) return { problem: `"${cell}" is not a number. Spreads look like 5.5.` };
  const value = Number(cell);
  if (value % 1 !== 0.5) return { problem: `${cell} is refused: a Spread always ends in .5, like 5.5.` };
  if (value < MIN_SPREAD || value > MAX_SPREAD) return { problem: `${cell} is refused: Spreads run ${MIN_SPREAD} to ${MAX_SPREAD}.` };
  return { value };
}

export type SpreadEntry = { game: LineupGame; set: { lower: Side; points: number } | null };

/** Reads one pairing's form: per Game, both blank clears it; one without the other is a problem. */
export function readSpreadFields(get: (field: string) => string): { entries: SpreadEntry[] } | { problem: string } {
  const entries: SpreadEntry[] = [];
  for (const game of LINEUP_GAMES) {
    const lower = get(`${game}-lower`).trim();
    const points = readSpreadPoints(get(`${game}-points`));
    if ("problem" in points) return { problem: `${gameWord(game)}: ${points.problem}` };
    if (lower !== "" && lower !== "a" && lower !== "b") return { problem: `${gameWord(game)}: pick one of the two Pairs.` };
    if (lower === "" && points.value === null) entries.push({ game, set: null });
    else if (lower === "") return { problem: `${gameWord(game)}: pick the lower-rated Pair.` };
    else if (points.value === null) return { problem: `${gameWord(game)}: enter the points it is forecast to score.` };
    else entries.push({ game, set: { lower, points: points.value } });
  }
  return { entries };
}

const WORD: Record<LineupGame, string> = { mens: "Men's doubles", womens: "Women's doubles", mixed1: "Mixed 1", mixed2: "Mixed 2" };
const gameWord = (game: LineupGame) => WORD[game];

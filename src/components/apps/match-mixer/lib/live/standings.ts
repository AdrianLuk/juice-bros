/**
 * Standings (spec #685, #688): one table per Pool, computed from the rebuilt
 * Schedule and the scores every time, never stored.
 *
 * Rows are Players in rotating partners, mixed doubles and singles, and
 * Pairings in fixed partners. Ranked by wins, then point differential, then
 * head-to-head. Wins rather than win percentage, so a late arrival who won
 * their only Game doesn't top the table.
 *
 * Head-to-head among rows level on wins and point differential: each row's
 * Games won against another row in that tied group, minus Games lost to one.
 * Rows still level after that share a rank, in Roster order.
 *
 * Relative imports only, for `node --test`.
 */

import { pairIndexOf } from "../engine/format.ts";
import type { Format, PlayerIndex, Roster, Schedule, Side } from "../engine/types.ts";
import { gameKey, type Scores } from "./events.ts";

/** What Standings read off one Pool: its own Roster and Schedule, in its own indices. */
export interface StandingsBoard {
  readonly format: Format;
  readonly roster: Roster;
  readonly schedule: Schedule;
}

export interface StandingsRow {
  /** The Pool's Players this row stands for: one, or a Pairing's two. */
  readonly players: readonly PlayerIndex[];
  readonly name: string;
  readonly played: number;
  readonly wins: number;
  readonly losses: number;
  readonly pointDiff: number;
  /** 1 for the top; rows level on every tiebreak share one. */
  readonly rank: number;
}

/** A scored Game, as the rows it was won and lost by. */
interface Result {
  readonly winners: readonly number[];
  readonly losers: readonly number[];
}

export function standings(board: StandingsBoard, scores: Scores): StandingsRow[] {
  const fixed = board.format === "fixed";
  // A row is a Player, or in fixed partners a Pairing: lines 2k and 2k + 1.
  const rowOf = (player: PlayerIndex) => (fixed ? pairIndexOf(player) : player);
  const rowsOf = (side: Side) => [...new Set(side.map(rowOf))];
  const count = fixed ? Math.floor(board.roster.length / 2) : board.roster.length;

  const tally = Array.from({ length: count }, (_, row) => ({
    row,
    players: fixed ? [row * 2, row * 2 + 1] : [row],
    played: 0,
    wins: 0,
    losses: 0,
    pointDiff: 0,
  }));
  const results: Result[] = [];

  board.schedule.rounds.forEach((round, index) => {
    for (const game of round.games) {
      const score = scores.get(gameKey(index, game.court));
      if (!score) continue;
      const won = score[0] > score[1] ? 0 : 1;
      const margin = Math.abs(score[0] - score[1]);
      const winners = rowsOf(game.sides[won]);
      const losers = rowsOf(game.sides[1 - won]);
      for (const row of winners) {
        tally[row].played++;
        tally[row].wins++;
        tally[row].pointDiff += margin;
      }
      for (const row of losers) {
        tally[row].played++;
        tally[row].losses++;
        tally[row].pointDiff -= margin;
      }
      results.push({ winners, losers });
    }
  });

  const level = (a: (typeof tally)[number], b: (typeof tally)[number]) =>
    a.wins === b.wins && a.pointDiff === b.pointDiff;

  // Stable, so rows level on everything keep Roster order.
  const ordered = [...tally].sort((a, b) => b.wins - a.wins || b.pointDiff - a.pointDiff);

  const headToHead = new Map<number, number>();
  for (let start = 0; start < ordered.length; ) {
    let end = start + 1;
    while (end < ordered.length && level(ordered[start], ordered[end])) end++;
    if (end - start > 1) {
      const group = new Set(ordered.slice(start, end).map((entry) => entry.row));
      for (const { winners, losers } of results) {
        const beatGroup = losers.some((row) => group.has(row));
        const lostToGroup = winners.some((row) => group.has(row));
        for (const row of winners) {
          if (group.has(row) && beatGroup) headToHead.set(row, (headToHead.get(row) ?? 0) + 1);
        }
        for (const row of losers) {
          if (group.has(row) && lostToGroup) headToHead.set(row, (headToHead.get(row) ?? 0) - 1);
        }
      }
      const tied = ordered.slice(start, end);
      tied.sort((a, b) => (headToHead.get(b.row) ?? 0) - (headToHead.get(a.row) ?? 0));
      ordered.splice(start, tied.length, ...tied);
    }
    start = end;
  }

  const h2h = (entry: (typeof tally)[number]) => headToHead.get(entry.row) ?? 0;
  const ranks: number[] = [];
  ordered.forEach((entry, position) => {
    const previous = ordered[position - 1];
    ranks.push(previous && level(previous, entry) && h2h(previous) === h2h(entry) ? ranks[position - 1] : position + 1);
  });

  return ordered.map((entry, position) => ({
    players: entry.players,
    name: entry.players.map((player) => board.roster[player]?.name ?? "").join(" / "),
    played: entry.played,
    wins: entry.wins,
    losses: entry.losses,
    pointDiff: entry.pointDiff,
    rank: ranks[position],
  }));
}

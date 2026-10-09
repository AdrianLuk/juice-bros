/**
 * What a Matchup's score bug shows for one Team (issue #633): two rows, its
 * captains' Game and its teammates' Game, with one Game's score in each Round
 * cell, so no cell can hold a number that isn't a single Game score. The
 * losing score of a Game is marked so the bug can dim it, and TOT is the Team
 * score, every point of the six Games.
 *
 * Relative imports only, for `node --test`.
 */

import { isScored, type DocGame, type GameKind, type Side } from "./event-doc.ts";

export type BugCell = {
  /** This Team's score in the Game, null until both scores are in. */
  points: number | null;
  /** The other Team scored more in this Game. False for a level Game and an unscored one. */
  lost: boolean;
};

type RoundCells = [BugCell, BugCell, BugCell];

export type BugRows = {
  /** Rounds 1 to 3 of the captains' Game. */
  captains: RoundCells;
  /** Rounds 1 to 3 of the teammates' Game. */
  teammates: RoundCells;
  /** The Team score: every point from the Games scored so far. */
  total: number;
};

type BugGame = Pick<DocGame, "round" | "kind" | "redScore" | "blueScore">;

export function bugRows(games: readonly BugGame[], side: Side): BugRows {
  const other: Side = side === "red" ? "blue" : "red";
  const score = (game: BugGame, of: Side) => (of === "red" ? game.redScore : game.blueScore) ?? 0;

  const row = (kind: GameKind) =>
    ([1, 2, 3] as const).map((round): BugCell => {
      const game = games.find((candidate) => candidate.round === round && candidate.kind === kind);
      if (!game || !isScored(game)) return { points: null, lost: false };
      return { points: score(game, side), lost: score(game, side) < score(game, other) };
    }) as RoundCells;

  return {
    captains: row("captains"),
    teammates: row("teammates"),
    total: games.filter(isScored).reduce((sum, game) => sum + score(game, side), 0),
  };
}

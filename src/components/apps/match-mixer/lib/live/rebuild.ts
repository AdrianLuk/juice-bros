/**
 * A Live Mixer, rebuilt (ADR 0001, ADR 0006, #688): the board from
 * its Config, the scores and Game Rule from its events, the Standings from
 * both. Every phone and the server read it the same way; nothing here is
 * stored.
 *
 * Relative imports only, for `node --test` and `npm run test:db`.
 */

import { EMPTY, restore, type DrawnBoard } from "../board-editor.ts";
import { poolName } from "../engine/pools.ts";
import type { Game, PlayerIndex } from "../engine/types.ts";
import { decodeShareLink } from "../persistence/share-link.ts";
import { replay, type GameAt, type MixerEvent, type Replay } from "./events.ts";
import { standings, type StandingsRow } from "./standings.ts";

/** The board a Config draws, or null when this build can't read it. */
export function redraw(config: string): DrawnBoard | null {
  const shared = decodeShareLink(config);
  return shared ? restore(EMPTY, { from: "link", board: shared }).draw : null;
}

/** The Game at this Round and court, and which Pool it's in, or null when there's none. */
export function gameOn(draw: DrawnBoard, { round, court }: GameAt): { pool: number; game: Game } | null {
  for (let pool = 0; pool < draw.pools.length; pool++) {
    const game = draw.pools[pool].schedule.rounds[round]?.games.find((candidate) => candidate.court === court);
    if (game) return { pool, game };
  }
  return null;
}

/** How many Rounds the board has. The count is shared by every Pool (ADR 0004). */
export function roundCount(draw: DrawnBoard): number {
  return Math.max(0, ...draw.pools.map((pool) => pool.schedule.rounds.length));
}

/** Whether a Roster index sits in the Game at this Round and court. */
export function playsIn(draw: DrawnBoard, at: GameAt, player: PlayerIndex): boolean {
  const found = gameOn(draw, at);
  if (!found) return false;
  const { members } = draw.pools[found.pool];
  return found.game.sides.some((side) => side.some((index) => members[index] === player));
}

export function notStarted(round: number): string {
  return `Round ${round + 1} hasn't started yet.`;
}

/** What a link may do with one Game's score. */
export type GameAccess = "scores" | "not-yours" | "not-started";

/**
 * What a Player Link with this Selection may do with one Game (#689): score it
 * when the Selection sits in it and its Round is no later than the Current
 * Round. The board checks this for convenience; the server checks it again.
 */
export function playerAccess(draw: DrawnBoard, currentRound: number, player: PlayerIndex, at: GameAt): GameAccess {
  if (!playsIn(draw, at, player)) return "not-yours";
  return at.round > currentRound ? "not-started" : "scores";
}

export interface PoolStandings {
  /** "Pool A", or null on a one-Pool board. */
  readonly label: string | null;
  readonly rows: readonly StandingsRow[];
}

export interface RebuiltMixer extends Replay {
  readonly draw: DrawnBoard;
  /** One table per Pool. There is no verdict across Pools (ADR 0004). */
  readonly standings: readonly PoolStandings[];
}

export function rebuild(config: string, events: readonly MixerEvent[]): RebuiltMixer | null {
  const draw = redraw(config);
  if (!draw) return null;
  const live = replay(events);
  return {
    ...live,
    draw,
    standings: draw.pools.map((pool) => ({
      label: draw.pools.length > 1 ? poolName(pool.label) : null,
      rows: standings({ format: pool.score.format, roster: pool.roster, schedule: pool.schedule }, live.scores),
    })),
  };
}

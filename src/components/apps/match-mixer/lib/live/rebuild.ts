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
import type { Game } from "../engine/types.ts";
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

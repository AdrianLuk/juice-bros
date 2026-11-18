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
import { decodeShareLink, encodeSharePayload } from "../persistence/share-link.ts";
import { replay, type GameAt, type MixerEvent, type Replay } from "./events.ts";
import { applyRosterChanges } from "./roster-changes.ts";
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

/**
 * Whether a read of a Live Mixer may run the night: through the Organizer
 * Link, or as a superadmin through either link (#690). The board shows the
 * controls by it; the server checks it on every write.
 */
export function runsTheNight(read: { readonly role: "organizer" | "player"; readonly superadmin: boolean }): boolean {
  return read.role === "organizer" || read.superadmin;
}

export interface PoolStandings {
  /** "Pool A", or null on a one-Pool board. */
  readonly label: string | null;
  readonly rows: readonly StandingsRow[];
}

export interface RebuiltMixer extends Replay {
  /**
   * The board with every late arrival and departure in it (#692). Its Roster
   * is the Config's followed by everyone who joined, so a Roster index means
   * the same Player all night.
   */
  readonly draw: DrawnBoard;
  /** One table per Pool. There is no verdict across Pools (ADR 0004). */
  readonly standings: readonly PoolStandings[];
  /** Per Roster index: the Round index they joined, 0 for everyone on the Config. */
  readonly joined: readonly number[];
  /** Per Roster index: whether they are on the board from the first Round not yet locked. */
  readonly playing: readonly boolean[];
}

export function rebuild(config: string, events: readonly MixerEvent[]): RebuiltMixer | null {
  const drawn = redraw(config);
  if (!drawn) return null;
  const live = replay(events);
  const { draw, joined, onBoard } = applyRosterChanges(drawn, live.changes);
  return {
    ...live,
    draw,
    joined,
    playing: joined.map((_, player) => onBoard(player, live.currentRound + 1)),
    standings: draw.pools.map((pool) => ({
      label: draw.pools.length > 1 ? poolName(pool.label) : null,
      rows: standings(
        {
          format: pool.score.format,
          roster: pool.roster,
          schedule: pool.schedule,
          joined: pool.members.map((player) => joined[player]),
        },
        live.scores,
      ),
    })),
  };
}

/**
 * The Config "Run it again" opens (#685): the night's Roster, which is the
 * Config's plus every late arrival who made it onto the board. Players who
 * left early stay, since leaving early says nothing about next week; the
 * organizer edits the names anyway. On a declared board a late arrival goes
 * under their Pool's header; a dealt board is dealt again, so they go last.
 * A night with no arrivals opens on its own Config, unchanged.
 */
export function runItAgainPayload(config: string, events: readonly MixerEvent[]): string | null {
  const board = decodeShareLink(config);
  const live = rebuild(config, events);
  if (!board || !live) return null;
  const { roster, headers = [] } = board.config;

  // After which Config line each arrival goes. An arrival taken off before
  // their first Round sits nowhere on the board, so they don't go anywhere.
  const after = new Map<number, number[]>();
  for (const pool of live.draw.pools) {
    const seen = new Set(pool.schedule.rounds.flatMap((round) => [...round.games.flatMap((game) => game.sides.flat()), ...round.byes]));
    const anchor = headers.length > 0 ? Math.max(...pool.members.filter((player) => player < roster.length)) : roster.length - 1;
    pool.members.forEach((player, position) => {
      if (player >= roster.length && seen.has(position)) after.set(anchor, [...(after.get(anchor) ?? []), player]);
    });
  }
  if (after.size === 0) return config;

  const night = roster.flatMap((player, index) => [player, ...(after.get(index) ?? []).map((late) => live.draw.config.roster[late])]);
  const movedBy = (start: number) => [...after].reduce((sum, [anchor, late]) => sum + (anchor < start ? late.length : 0), 0);
  return encodeSharePayload({
    ...board.config,
    roster: night,
    headers: headers.map((header) => ({ ...header, start: header.start + movedBy(header.start) })),
  });
}

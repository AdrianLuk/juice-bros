/**
 * Late arrivals and early departures (#692): a Live Mixer's board after the
 * Roster has changed, rebuilt from the drawn board plus the player added and
 * player left events. Never stored (ADR 0001): every phone and the server get
 * the same board from the same inputs.
 *
 * Above the engine and per Pool (ADR 0004), the way the pool layer already
 * calls the generator once per Pool. A Pool's Rounds are walked in order, and
 * at each Round where its set of Players on the board differs from the Round
 * before, every Round from there on is drawn again with `continueRounds`,
 * starting from the partner, opponent and Bye counts of the Rounds before it.
 * Rounds before a change never move. A change only ever lands on a Round
 * nobody has started (`RosterChange.from`), so a locked Round never moves.
 *
 * Working off the set rather than the events is what makes an undo exact: a
 * Player added and taken off again before their first Round leaves no change
 * at all, and the board is the one it was.
 *
 * Courts stay where the pool layer put them. A Pool that can now fill fewer
 * drops a Game in those Rounds rather than playing three; one that could fill
 * more does not get another.
 *
 * A Live Mixer runs for up to 12 hours, across deploys, and its locked Rounds
 * must not move under it. So a change to what this module draws (the walk,
 * `seedAt`, the history it hands over) or to the `history` paths in the engine
 * requires bumping `GENERATOR_VERSION` in `persistence/share-link.ts`, on the
 * same rule as `generator.ts` and `circle.ts`: the board then says it may
 * differ from the one that went live.
 *
 * Relative imports only, for `node --test`.
 */

import type { DrawnBoard } from "../board-editor.ts";
import { maxCourts } from "../engine/config.ts";
import { resolveFormat } from "../engine/format.ts";
import { countMarkers, markersOf, maxMixedCourts, resolveMixed, splitMarker } from "../engine/mixed.ts";
import type { Pool } from "../engine/pools.ts";
import { randomFrom } from "../engine/random.ts";
import { continueRounds } from "../engine/schedule.ts";
import { scoreSchedule, tallyRounds } from "../engine/scorer.ts";
import type { Format, Player, PlayerIndex, Round, Side, Tally } from "../engine/types.ts";
import type { RosterChange } from "./events.ts";

export interface LiveRoster {
  /** The board with the changes in it. Its Roster is the Config's, then everyone who joined, in order. */
  readonly draw: DrawnBoard;
  /** Per Roster index: the Round index they first joined, 0 for everyone on the Config. */
  readonly joined: readonly number[];
  /** Per Roster index: whether they are on the board at this Round. */
  readonly onBoard: (player: PlayerIndex, round: number) => boolean;
}

/** How many Roster lines one arrival is: a Pairing in fixed partners, one Player otherwise. */
export function linesPerArrival(format: Format): number {
  return format === "fixed" ? 2 : 1;
}

export function applyRosterChanges(draw: DrawnBoard, changes: readonly RosterChange[]): LiveRoster {
  const format = resolveFormat(draw.config.format);
  const mixed = resolveMixed(format, draw.config.mixed);
  const roster: Player[] = [...draw.config.roster];
  const members = draw.pools.map((pool) => [...pool.members]);
  // Per Roster index, in log order: from which Round they are on or off the board.
  const toggles: [number, boolean][][] = roster.map(() => [[0, true]]);

  for (const change of changes) {
    if (change.kind === "joined") {
      if (change.pool >= members.length || change.lines.length !== linesPerArrival(format)) continue;
      for (const line of change.lines) {
        const { name, marker } = mixed ? splitMarker(line) : { name: line, marker: undefined };
        members[change.pool].push(roster.length);
        toggles.push([[change.from, true]]);
        roster.push(marker ? { id: `late${roster.length}`, name, marker } : { id: `late${roster.length}`, name });
      }
      continue;
    }
    if (change.player >= roster.length) continue;
    // In fixed partners a Pairing comes and goes whole: lines 2k and 2k + 1.
    const who = format === "fixed" ? [change.player - (change.player % 2), change.player - (change.player % 2) + 1] : [change.player];
    for (const player of who) toggles[player].push([change.from, change.kind === "back"]);
  }

  const onBoard = (player: PlayerIndex, round: number) => {
    let on = false;
    for (const [from, present] of toggles[player] ?? []) if (from <= round) on = present;
    return on;
  };

  const pools = draw.pools.map((pool, index) => {
    const everyone = members[index];
    if (everyone.length === pool.members.length && everyone.every((player) => toggles[player].length === 1)) return pool;
    return rebuildPool(pool, index, everyone, roster, onBoard, format, mixed, draw.config.seed);
  });

  return {
    draw: { ...draw, config: { ...draw.config, roster }, pools },
    joined: toggles.map((list) => list[0][0]),
    onBoard,
  };
}

function rebuildPool(
  pool: Pool,
  index: number,
  everyone: readonly PlayerIndex[],
  roster: readonly Player[],
  onBoard: (player: PlayerIndex, round: number) => boolean,
  format: Format,
  mixed: boolean,
  seed: number,
): Pool {
  const own = everyone.map((player) => roster[player]);
  const total = pool.schedule.rounds.length;
  let rounds: Round[] = [...pool.schedule.rounds];
  let previous = "";

  for (let round = 0; round < total; round++) {
    // Pool positions on the board this Round.
    const here = everyone.flatMap((player, position) => (onBoard(player, round) ? [position] : []));
    const key = here.join(",");
    if (round === 0 || key === previous) {
      previous = key;
      continue;
    }
    previous = key;
    rounds = [...rounds.slice(0, round), ...continueFrom(pool, index, rounds, round, here, own, format, mixed, seed)];
  }

  const schedule = { source: "generated" as const, rounds };
  return {
    ...pool,
    members: everyone,
    roster: own,
    schedule,
    score: scoreSchedule(schedule, { roster: own, seed, format, mixed }),
  };
}

/** Rounds `from` onward for these Pool positions, carrying on from the Rounds before. */
function continueFrom(
  pool: Pool,
  index: number,
  rounds: readonly Round[],
  from: number,
  here: readonly number[],
  own: readonly Player[],
  format: Format,
  mixed: boolean,
  seed: number,
): Round[] {
  const players = here.map((position) => own[position]);
  const markers = mixed ? markersOf(players) : null;
  const fills = markers ? maxMixedCourts(countMarkers(players)) : maxCourts(players.length, format);

  // Counted over the whole Pool, then read for the Players on the board. A
  // Round somebody wasn't on the board for counts as a Bye.
  const counted = tallyRounds(rounds.slice(0, from), own.length);
  const pick = (grid: number[][]) => here.map((a) => here.map((b) => grid[a][b]));
  const history: Tally = {
    partnerMatrix: pick(counted.partnerMatrix),
    opponentMatrix: pick(counted.opponentMatrix),
    gamesPlayed: here.map((position) => counted.gamesPlayed[position]),
    byes: here.map((position) => from - counted.gamesPlayed[position]),
  };

  const built = continueRounds({
    format,
    n: here.length,
    courts: Math.min(pool.courts, fills),
    rounds: rounds.length - from,
    seed: seedAt(seed, index, from),
    markers,
    history,
  });
  const relabel = (side: Side): Side => (side.length === 2 ? [here[side[0]], here[side[1]]] : [here[side[0]]]);
  return built.map((round) => ({
    games: round.games.map((game) => ({
      court: game.court + pool.firstCourt,
      sides: [relabel(game.sides[0]), relabel(game.sides[1])] as const,
    })),
    byes: round.byes.map((at) => here[at]),
  }));
}

/** A Seed for one Pool's Rounds from `from` on, so two rebuilds of the same night agree. */
function seedAt(seed: number, pool: number, from: number): number {
  const random = randomFrom((seed ^ Math.imul(pool * 1000 + from + 1, 0x9e3779b1)) >>> 0);
  return 1 + Math.floor(random() * 0x7ffffffe);
}

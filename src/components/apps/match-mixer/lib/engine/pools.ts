import {
  clampCourts,
  clampRounds,
  DEFAULT_ROUND_TARGET,
  maxCourts,
  naturalLength,
  resolveNumbers,
  type ResolvedConfig,
  type ResolvedNumbers,
} from "./config.ts";
import { formatObjection, resolveFormat, seatsPerCourt } from "./format.ts";
import {
  countMarkers,
  maxMixedCourts,
  mixedObjection,
  partnershipSupply,
  resolveMixed,
  type MarkerCounts,
} from "./mixed.ts";
import { randomFrom, shuffle } from "./random.ts";
import { generateSchedule, UnsupportedConfigError } from "./schedule.ts";
import { scoreSchedule } from "./scorer.ts";
import {
  MAX_ROSTER_SIZE,
  MIN_ROSTER_SIZE,
  type Format,
  type PlayerIndex,
  type Roster,
  type Schedule,
  type ScorerResult,
} from "./types.ts";

/**
 * Pools: the one layer that knows a Roster can be more than one round robin
 * (ADR 0004).
 *
 * It sits above `generateSchedule` and nowhere else. It deals the Roster into
 * Pools, gives each its courts for the night, calls `generateSchedule` once
 * per Pool with that Pool's own sub-roster, moves each Game onto the court it
 * is really on, and hands back a list. Nothing below it ever hears the word:
 * the generator, the Tables, the Scorer and the Itinerary each get a roster
 * indexed from zero and a Schedule over it, which is exactly what they got
 * before Pools existed. The grid gets the list and draws one band per entry.
 *
 * Tagging every Game with a pool instead would have put a denominator check in
 * every reader forever — coverage, Bye spread and `pairingsPossible` are all
 * ratios, and a reader that forgot to filter would report a true count against
 * the wrong total. Do not "simplify" this into pool-tagged Games; the ADR says
 * why at length.
 *
 * One Pool is not a deal of one. Nothing here touches the Seed or reorders the
 * Roster when the count is one, which is what lets every Config and Share Link
 * that existed before this module draw a byte-identical board after it, with
 * `GENERATOR_VERSION` left where it was.
 *
 * Like everything under `lib/engine`, this imports no React and uses no `@/`
 * alias — it has to resolve under plain `node --test`.
 */

/**
 * The most names one board takes, however many Pools it is split into. Both
 * reasons for the old single cap of 32 were reasons about one rotation — the
 * grid fitting a sheet and the search staying quick — and a rotation is now a
 * Pool. This is the one limit that is about the board rather than a Pool:
 * two full Pools side by side.
 */
export const MAX_BOARD_SIZE = 64;

/**
 * Everything a draw needs once the Pool count is in it. `generateSchedule`
 * takes a plain `ResolvedConfig` and never sees this field, which is the point:
 * a Pool count reaching the engine would be a Pool count something below this
 * layer had to know how to ignore.
 */
export type BoardConfig = ResolvedConfig & { readonly pools: number };

/** Every Pool needs a court's worth of names, so a Roster holds this many. */
export function maxPools(n: number): number {
  return Math.max(1, Math.floor(n / MIN_ROSTER_SIZE));
}

/**
 * The Pool count this Roster will actually be drawn with. Clamped rather than
 * refused, on the courts field's precedent: a number picker cannot offer an
 * impossible value in the first place, and a Pool count that would leave a
 * Pool with three names snaps back to what the Roster can make. Absent is one.
 */
export function resolvePools(n: number, pools: number | undefined): number {
  if (pools === undefined || !Number.isFinite(pools)) return 1;
  return Math.min(maxPools(n), Math.max(1, Math.floor(pools)));
}

/** How many names this many Pools can hold: 32 each, and 64 on one board. */
export function rosterCeiling(pools: number): number {
  return Math.min(MAX_ROSTER_SIZE * Math.max(1, pools), MAX_BOARD_SIZE);
}

/**
 * Whether a Roster of this size can be drawn at this Pool count. At one Pool it
 * is exactly `isSupportedRosterSize`, which is what it replaces at every edge.
 */
export function isSupportedBoardSize(n: number, pools: number | undefined): boolean {
  return n >= MIN_ROSTER_SIZE && n <= rosterCeiling(resolvePools(n, pools));
}

/** A Pool's letter by position: A, B, C. */
export function poolLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

/** What the board calls a Pool out loud. */
export function poolName(label: string): string {
  return `Pool ${label}`;
}

/** "Pool A", "Pools A and B", "Pools A, B and C". */
export function poolNames(labels: readonly string[]): string {
  if (labels.length === 1) return poolName(labels[0]);
  return `Pools ${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * One Pool's share of the night, worked out without the Seed.
 *
 * The deal is random in who and never in how many: a round-robin deal off the
 * Format's own unit gives every Pool the same counts whatever order the queue
 * was shuffled into. So everything the screen needs before anything is drawn
 * — the courts each Pool gets, how many sit out, how long its rotation runs —
 * can be answered on every keystroke, the same way the one-Pool consequence
 * line always has been.
 */
export interface PoolShape {
  readonly label: string;
  /** Players in this Pool. */
  readonly size: number;
  /** Its `M` and `F`, under mixed doubles, and `null` otherwise. */
  readonly markers: MarkerCounts | null;
  /** The most courts this Pool can fill. Zero only for a mixed Pool short of a side. */
  readonly ceiling: number;
  /** The courts it has for the night. */
  readonly courts: number;
  /** Its first court, zero-based and counted across the whole night. */
  readonly firstCourt: number;
  /** How many Rounds its rotation runs before a repeat is forced. */
  readonly natural: number;
}

export interface PoolPlan {
  readonly shapes: readonly PoolShape[];
  /** The courts on the night, as the organizer set them. */
  readonly courts: number;
  /** How many of them the Pools can fill. The rest stand empty. */
  readonly used: number;
  /** The shortest Pool's natural length, which is what the default Round count is. */
  readonly natural: number;
  /** Which Pools set it, in order. More than one when they tie. */
  readonly shortest: readonly string[];
}

/**
 * How a round-robin deal of `units` into `pools` comes out: `floor(units /
 * pools)` each, and one more for each of the first `units % pools` Pools the
 * deal reaches, starting from `offset`.
 */
function dealtCounts(units: number, pools: number, offset = 0): number[] {
  const counts = new Array<number>(pools).fill(Math.floor(units / pools));
  for (let i = 0; i < units % pools; i++) counts[(offset + i) % pools] += 1;
  return counts;
}

/**
 * Who goes where, as queues of Roster indices in the order they are dealt.
 *
 * The deal deals the Format's own unit (ADR 0004). Players in rotating and
 * singles. Pairings in fixed partners, so a pair is dealt as one and nobody is
 * torn from the partner they arrived with. Under mixed doubles, `M` and `F` as
 * two separate queues, so each Pool's marker counts come out as even as the
 * numbers allow rather than the deal making a Pool that mixed doubles then
 * refuses. The `F` queue picks up where the `M` queue left off, which is what
 * keeps the Pools' sizes even as well as their counts.
 */
interface Queue {
  /** Each unit is one Player, or one Pairing's two. */
  readonly units: readonly (readonly PlayerIndex[])[];
  /** Which Pool the first unit goes to. */
  readonly offset: number;
}

function queues(
  roster: Roster,
  format: Format,
  mixed: boolean,
  pools: number,
): Queue[] {
  const everyone = roster.map((_, index) => index);
  if (format === "fixed") {
    const pairs: PlayerIndex[][] = [];
    for (let i = 0; i + 1 < everyone.length; i += 2) pairs.push([i, i + 1]);
    return [{ units: pairs, offset: 0 }];
  }
  if (mixed) {
    const m = everyone.filter((player) => roster[player].marker === "M");
    const f = everyone.filter((player) => roster[player].marker === "F");
    return [
      { units: m.map((player) => [player]), offset: 0 },
      { units: f.map((player) => [player]), offset: m.length % pools },
    ];
  }
  return [{ units: everyone.map((player) => [player]), offset: 0 }];
}

/**
 * Whether mixed doubles can read this Roster at all. A half-marked list is the
 * whole-Roster refusal's business, and until every line carries a marker there
 * is nothing sensible for the deal to split.
 */
function readsMarkers(roster: Roster, mixed: boolean): boolean {
  return mixed && countMarkers(roster).unmarked === 0;
}

/** Players sitting out each Round in a Pool of this size on this many courts. */
function sitting(size: number, courts: number, format: Format): number {
  return Math.max(0, size - courts * seatsPerCourt(format));
}

/**
 * The Pools' shapes and their courts, or `null` when there are fewer courts
 * than Pools — a Pool with no court is not a Pool, and there is nothing to
 * allocate.
 *
 * Courts are allocated once for the night and never move. Each Pool gets one;
 * then each court left over goes to whichever Pool is sitting the most people
 * out per Round, capped at what that Pool can fill, lowest letter first on a
 * tie. That needs no Seed and gives each Pool one column count all evening. A
 * court no Pool can fill stands empty rather than being dealt a Pool that
 * could not seat it, and the consequence line says which.
 *
 * Rotating a remainder court between Pools was rejected (ADR 0004): a court is
 * where people walk, and a Pool that moves down the gym mid-evening is the
 * confusion this tool exists to prevent.
 */
export function planPools(
  roster: Roster,
  format: Format,
  mixed: boolean,
  pools: number,
  courts: number,
): PoolPlan | null {
  if (courts < pools) return null;

  const marked = readsMarkers(roster, mixed);
  const sizes = new Array<number>(pools).fill(0);
  const markers: MarkerCounts[] | null = marked ? [] : null;
  if (markers) {
    const counts = countMarkers(roster);
    const m = dealtCounts(counts.M, pools);
    const f = dealtCounts(counts.F, pools, counts.M % pools);
    for (let i = 0; i < pools; i++) {
      markers.push({ M: m[i], F: f[i], unmarked: 0 });
      sizes[i] = m[i] + f[i];
    }
  } else {
    // Pairings in fixed partners, dealt whole; players everywhere else.
    const unit = format === "fixed" ? 2 : 1;
    const dealt = dealtCounts(Math.floor(roster.length / unit), pools);
    for (let i = 0; i < pools; i++) sizes[i] = dealt[i] * unit;
  }

  const ceilings = sizes.map((size, i) =>
    markers ? maxMixedCourts(markers[i]) : maxCourts(size, format),
  );
  const allocated = new Array<number>(pools).fill(1);
  for (let spare = courts - pools; spare > 0; spare--) {
    let worst = -1;
    for (let i = 0; i < pools; i++) {
      if (allocated[i] >= ceilings[i]) continue;
      if (
        worst === -1 ||
        sitting(sizes[i], allocated[i], format) >
          sitting(sizes[worst], allocated[worst], format)
      ) {
        worst = i;
      }
    }
    if (worst === -1) break;
    allocated[worst] += 1;
  }

  let first = 0;
  const shapes = sizes.map((size, i): PoolShape => {
    const shape: PoolShape = {
      label: poolLabel(i),
      size,
      markers: markers ? markers[i] : null,
      ceiling: ceilings[i],
      courts: allocated[i],
      firstCourt: first,
      natural: naturalLength(
        size,
        allocated[i],
        format,
        markers ? markers[i].M * markers[i].F : undefined,
      ),
    };
    first += allocated[i];
    return shape;
  });

  const natural = Math.min(...shapes.map((shape) => shape.natural));
  return {
    shapes,
    courts,
    used: first,
    natural,
    shortest: shapes
      .filter((shape) => shape.natural === natural)
      .map((shape) => shape.label),
  };
}

/**
 * How many courts to offer before the organizer has said: as many as the Pools
 * can fill between them. The one-Pool board's own default is `floor(n / 4)`,
 * or what mixed doubles' markers allow, and neither is right here — twelve
 * names in two Pools of six can fill two courts, not three.
 */
export function pooledCourtDefault(
  roster: Roster,
  format: Format,
  mixed: boolean,
  pools: number,
): number {
  const plan = planPools(roster, format, mixed, pools, Number.MAX_SAFE_INTEGER);
  if (!plan) return pools;
  return plan.shapes.reduce(
    (total, shape) => total + Math.max(1, shape.ceiling),
    0,
  );
}

/**
 * The board's numbers, settled: the court count, the Round count and the Pool
 * count, each brought inside what this Roster supports and defaulted where it
 * was left unset.
 *
 * At one Pool this is `resolveNumbers` and nothing else, called with exactly
 * the arguments it always was. Past one, the courts default to what the Pools
 * can fill and the Rounds to the shortest Pool's natural length, capped at the
 * usual evening — which keeps the invariant that the default board never asks
 * for more Rounds than the partnership supply holds, in every Pool at once.
 */
export function resolveBoard(
  roster: Roster,
  courts: number | undefined,
  rounds: number | undefined,
  format: Format,
  mixed: boolean,
  pools: number | undefined,
): ResolvedNumbers & { readonly pools: number } {
  const n = roster.length;
  const count = resolvePools(n, pools);
  const mixing = resolveMixed(format, mixed);
  if (count === 1) {
    return {
      ...resolveNumbers(
        n,
        courts,
        rounds,
        format,
        partnershipSupply(roster, mixing),
      ),
      pools: 1,
    };
  }

  const settled = clampCourts(
    n,
    courts ?? pooledCourtDefault(roster, format, mixing, count),
    format,
  );
  const plan = planPools(roster, format, mixing, count, settled);
  const natural = plan?.natural ?? DEFAULT_ROUND_TARGET;
  return {
    courts: settled,
    rounds: clampRounds(rounds ?? Math.min(natural, DEFAULT_ROUND_TARGET)),
    pools: count,
  };
}

function courtsWord(count: number): string {
  return `${count} ${count === 1 ? "court" : "courts"}`;
}

/**
 * Why this board cannot be drawn, in words, or `null` when it can.
 *
 * At one Pool it is the two refusals the board has always had, asked in the
 * order they have always been asked. Past one, the whole Roster still answers
 * the questions that are about the whole Roster — an odd list in fixed
 * partners, a line with no marker — and then each Pool answers for itself.
 * Any Pool refused refuses the whole board (ADR 0004), and the message names
 * the Pool, because "the list has 1 F" is not true of a list with seven.
 */
export function boardObjection(
  roster: Roster,
  format: Format,
  mixed: boolean,
  pools: number | undefined,
  courts: number,
): string | null {
  const count = resolvePools(roster.length, pools);
  const mixing = resolveMixed(format, mixed);
  const whole = formatObjection(roster, format);
  if (count === 1 || whole) return whole ?? mixedObjection(roster, courts, mixing);

  if (mixing && !readsMarkers(roster, mixing)) {
    return mixedObjection(roster, courts, mixing);
  }

  if (courts < count) {
    return `${count} pools need a court each, and there ${courts === 1 ? "is" : "are"} ${courtsWord(courts)}. Add ${count - courts === 1 ? "a court" : `${count - courts} courts`}, or drop to ${courts === 1 ? "one pool" : `${courts} pools`}.`;
  }

  const plan = planPools(roster, format, mixing, count, courts);
  const short = plan?.shapes.find((shape) => shape.ceiling < 1);
  if (!short?.markers) return null;

  // A mixed Pool with fewer than two of a side. Only the deal's counts can
  // cause it — every other Pool's courts are already capped at what it can
  // fill — and the numbers decide both ways out: enough of the short side for
  // two in every Pool, or few enough Pools that there already are.
  const side = short.markers.M < 2 ? "M" : "F";
  const total = countMarkers(roster)[side];
  const fewer = Math.floor(total / 2);
  const seats = `${poolName(short.label)} gets ${short.markers[side]} ${side} in the deal, and a court of mixed doubles needs 2 of each.`;
  const more = `Add ${count * 2 - total} more ${side}`;
  // Below two of a side there is no Pool count that works, so offering to
  // drop to one would be a way out that is not one.
  if (fewer === 0) return `${seats} ${more}.`;
  const drop = fewer === 1 ? "go back to one pool" : `drop to ${fewer} pools`;
  return `${seats} ${more}, or ${drop}.`;
}

/**
 * One Pool, drawn: a complete round robin of its own on courts of its own.
 *
 * `roster` and `schedule` are indexed from zero like any board, so every
 * reader of them is exactly the reader it was before Pools existed. `members`
 * is the only way back to the Roster the organizer typed.
 */
export interface Pool {
  readonly label: string;
  /** Roster indices, in Roster order: `members[i]` is this Pool's Player `i`. */
  readonly members: readonly PlayerIndex[];
  readonly roster: Roster;
  /** Its first court, zero-based across the night, and how many it has. */
  readonly firstCourt: number;
  readonly courts: number;
  /** Every Game already names its real court. */
  readonly schedule: Schedule;
  readonly score: ScorerResult;
}

/**
 * A Seed for the Pool at this position. Pool A keeps the raw Seed, which is
 * half of what lets one-Pool Configs draw the board they always drew. Every
 * other Pool draws from one derived from it: two Pools of eight on two courts
 * each come off the same n=8 Table, and on one Seed they would be the same
 * grid with different names on it.
 */
function seedFor(seed: number, index: number): number {
  if (index === 0) return seed;
  return derive(seed, index);
}

/** The deal's own stream, apart from every Pool's so that neither moves the other. */
function dealSeed(seed: number): number {
  return derive(seed, 0x5eed);
}

function derive(seed: number, salt: number): number {
  const random = randomFrom((seed ^ Math.imul(salt, 0x9e3779b1)) >>> 0);
  return 1 + Math.floor(random() * 0x7ffffffe);
}

/**
 * Who is in which Pool, as Roster indices in Roster order. Random in who, off
 * the Seed, so a redraw deals again and the same Config and Seed always deal
 * the same Pools; fixed in how many, by `dealtCounts`, so the shapes the
 * screen promised before the draw are the shapes that come out of it.
 */
export function dealPools(
  roster: Roster,
  format: Format,
  mixed: boolean,
  pools: number,
  seed: number,
): PlayerIndex[][] {
  const dealt: PlayerIndex[][] = Array.from({ length: pools }, () => []);
  const random = randomFrom(dealSeed(seed));
  for (const queue of queues(roster, format, readsMarkers(roster, mixed), pools)) {
    const units = shuffle([...queue.units], random);
    units.forEach((unit, position) => {
      dealt[(queue.offset + position) % pools].push(...unit);
    });
  }
  // Roster order within a Pool, so its sub-roster reads the way the list was
  // typed and a fixed-partner pair stays on consecutive lines.
  return dealt.map((members) => members.sort((a, b) => a - b));
}

/**
 * One Pool through the engine, with any refusal the engine raises for it
 * handed back naming the Pool. `boardObjection` already answers for every
 * refusal a Pool can meet today, so this is a guarantee rather than a path
 * anything takes: a Format that later grows an objection of its own still
 * refuses the whole board, and still says which Pool it was about.
 */
function drawOne(config: ResolvedConfig, label: string): Schedule {
  try {
    return generateSchedule(config);
  } catch (error) {
    if (!(error instanceof UnsupportedConfigError)) throw error;
    throw new UnsupportedConfigError(`${poolName(label)}: ${error.message}`);
  }
}

/** The same Schedule, every Game moved along to the court it is really on. */
function onCourts(schedule: Schedule, first: number): Schedule {
  if (first === 0) return schedule;
  return {
    source: schedule.source,
    rounds: schedule.rounds.map((round) => ({
      games: round.games.map((game) => ({ ...game, court: game.court + first })),
      byes: round.byes,
    })),
  };
}

/**
 * The board: one Pool, or several drawn side by side.
 *
 * At one Pool there is no deal at all — not a deal of one. The Roster goes to
 * `generateSchedule` untouched, with the Seed untouched, and what comes back is
 * the board it has always been.
 *
 * Past one, every Pool goes down the same Format routing it would have gone
 * down alone, with its own sub-roster: a Pool of eight on two courts in
 * rotating is an n=8 board and comes off the n=8 Table. Every Pool plays the
 * same Round count, because a Round is a time slot and the room calls "next
 * round" once.
 */
export function drawPools(config: BoardConfig): Pool[] {
  const { roster, seed } = config;
  const format = resolveFormat(config.format);
  const mixed = resolveMixed(format, config.mixed);
  const everyone = roster.map((_, index) => index);

  if (resolvePools(roster.length, config.pools) === 1) {
    // The count comes off before the engine sees the Config, so nothing below
    // this layer is ever handed a field it would have to know to ignore.
    const plain: ResolvedConfig = {
      roster,
      seed,
      courts: config.courts,
      rounds: config.rounds,
      format: config.format,
      mixed: config.mixed,
    };
    const schedule = generateSchedule(plain);
    return [
      {
        label: poolLabel(0),
        members: everyone,
        roster,
        firstCourt: 0,
        courts: schedule.rounds[0]?.games.length ?? 0,
        schedule,
        score: scoreSchedule(schedule, plain),
      },
    ];
  }

  if (!isSupportedBoardSize(roster.length, config.pools)) {
    throw new UnsupportedConfigError(
      `Roster of ${roster.length} is outside ${MIN_ROSTER_SIZE}-${rosterCeiling(config.pools)} players.`,
    );
  }
  // Settled again rather than trusted, for the reason `generateSchedule` gives
  // for its own clamps: this is the entry point, and a Config assembled
  // anywhere else must not be able to ask for a board nobody can sit down to.
  const { courts, rounds, pools } = resolveBoard(
    roster,
    config.courts,
    config.rounds,
    format,
    mixed,
    config.pools,
  );
  const objection = boardObjection(roster, format, mixed, pools, courts);
  if (objection) throw new UnsupportedConfigError(objection);

  // Past the objection there are at least as many courts as Pools.
  const plan = planPools(roster, format, mixed, pools, courts) as PoolPlan;
  const dealt = dealPools(roster, format, mixed, pools, seed);

  return plan.shapes.map((shape, index) => {
    const members = dealt[index];
    const own = {
      roster: members.map((player) => roster[player]),
      courts: shape.courts,
      rounds,
      seed: seedFor(seed, index),
      format,
      mixed,
    };
    const schedule = onCourts(drawOne(own, shape.label), shape.firstCourt);
    return {
      label: shape.label,
      members,
      roster: own.roster,
      firstCourt: shape.firstCourt,
      courts: shape.courts,
      schedule,
      score: scoreSchedule(schedule, own),
    };
  });
}

/**
 * Where a Roster index sits on a pooled board: which Pool, and which of its
 * Players. The one place that maps between the two (ADR 0004), so a Selection
 * can stay a global index and still mean "line 3 of the list I typed" after
 * the Pools are dealt again.
 */
export function locate(
  pools: readonly Pool[],
  player: PlayerIndex,
): { readonly pool: number; readonly index: PlayerIndex } | null {
  for (let pool = 0; pool < pools.length; pool++) {
    const index = pools[pool].members.indexOf(player);
    if (index !== -1) return { pool, index };
  }
  return null;
}

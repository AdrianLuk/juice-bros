import { naturalLength } from "./config.ts";
import { formatName, seatsPerCourt } from "./format.ts";
import {
  MAX_BOARD_SIZE,
  poolName,
  poolNames,
  type PoolPlan,
  type PoolShape,
} from "./pools.ts";
import { MAX_ROSTER_SIZE, MIN_ROSTER_SIZE, type Format } from "./types.ts";

/**
 * The Config-consequence line: what these numbers mean, in plain language,
 * without generating anything.
 *
 * This is the fast half of the screen's two speeds. It runs on every keystroke
 * because it is pure arithmetic over the Config, which is also the limit of
 * what it may claim: how many people, how many courts, how many rounds, how
 * many sit out, and whether there are enough unused partnerships left to go
 * round. Whether a Schedule actually came out balanced is the Scorer's to say,
 * off the Schedule that was actually produced — never this line's.
 */

export interface ConfigShape {
  readonly players: number;
  readonly courts: number;
  readonly rounds: number;
  readonly format: Format;
  /** Whether every team has to come out one `M` and one `F`. */
  readonly mixed?: boolean;
  /**
   * How many partnerships this board has to spend, when it is not the whole
   * `n(n − 1) / 2` triangle. `partnershipSupply` in `mixed.ts` works it out;
   * absent is every board that is not mixed.
   */
  readonly partnerships?: number;
  /** How many Pools the Roster is dealt into. Absent is one. */
  readonly pools?: number;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * The board's own particulars: "fixed partners · 13 players on 3 courts, 8
 * rounds". Short enough to sit in a line that has other work to do, which is
 * how a stale sheet says what it was drawn from.
 *
 * The Format leads, and it is named even when it is the default. A printed
 * fixed-partner sheet and a printed rotating sheet look alike and are not, and
 * paper is the one place where nothing else on the page can say which is
 * which — so naming only the unusual one would leave the common one mute
 * exactly where being mute costs something.
 *
 * Mixed doubles follows it, for the same reason and more sharply. The board
 * prints no markers — on a mixed board every side is one of each by
 * construction, so a letter after all twenty-four names would repeat a fact
 * the guarantee already carries — which leaves this line the only thing on
 * the paper that says the night was mixed at all.
 */
export function describeNumbers({
  players,
  courts,
  rounds,
  format,
  mixed,
  pools = 1,
}: ConfigShape): string {
  const drawn = mixed ? `${formatName(format)}, mixed doubles` : formatName(format);
  // The Pool count sits between the people and the courts because that is the
  // order the split happens in: these names, in this many round robins, on
  // these courts. Absent at one Pool, so every board that existed before Pools
  // carries the particulars it always did.
  const split = pools > 1 ? ` in ${pools} pools` : "";
  return `${drawn} · ${plural(players, "player")}${split} on ${plural(courts, "court")}, ${plural(rounds, "round")}`;
}

/**
 * What each Format runs out of, and when. A table rather than a cascade,
 * because there are three of them now and the third one added to a nested
 * ternary would have put the rotating wording behind two negations.
 *
 * Both halves of every line are statements about the supply the Format has to
 * spend, which is all counting can establish — see the note at the call site.
 */
const SUPPLY: Record<Format, (natural: number, spent: boolean) => string> = {
  rotating: (natural, spent) =>
    spent
      ? `Partners start repeating after round ${natural}`
      : "There are enough partnerships to go round",
  fixed: (natural, spent) =>
    spent
      ? `Pairs start meeting again after round ${natural}`
      : "There are enough matchups to go round",
  singles: (natural, spent) =>
    spent
      ? `People start playing each other again after round ${natural}`
      : "There are enough matchups to go round",
};

export function describeConfig(shape: ConfigShape): string {
  const { players, courts, rounds, format, partnerships } = shape;
  // Two seats to a court in singles, four in both doubles Formats.
  const sitting = Math.max(0, players - courts * seatsPerCourt(format));
  const natural = naturalLength(players, courts, format, partnerships);

  // A Bye belongs to a Pairing in fixed partners — both members of a sitting
  // team sit — so the count that means anything to the organizer is pairs, not
  // people. The seats themselves are the same four to a court in both doubles
  // Formats; it is what fills them that differs. In singles a Bye is a Player
  // again, and the count is the plain one above.
  //
  // Counted off the pairs rather than by halving the players, because this
  // line runs on every keystroke and passes through odd Rosters on the way to
  // even ones. Halving would put "1.5 pairs sit out" on screen in the moment
  // before the next name lands.
  const idle =
    format === "fixed"
      ? Math.max(0, Math.floor(players / 2) - courts * 2)
      : sitting;
  const unit = format === "fixed" ? "pair" : "player";

  const seating =
    idle === 0
      ? "Everybody plays every round"
      : `${plural(idle, unit)} ${idle === 1 ? "sits" : "sit"} out each round, taking turns`;

  // Both halves are statements about the supply the Format has to spend, which
  // is all counting can establish. Past the natural length it is spent and a
  // repeat is forced however good the generator is; within it there is enough
  // to go round, which is not the same as promising a draw that uses it all
  // without collision. Whether one came out is the Scorer's to report.
  //
  // What is in supply differs: rotating spends partnerships, fixed partners
  // spends meetings between pairs because its partnerships are all spent in
  // round one on purpose, and singles spends meetings between people because
  // it has no partnerships at all.
  //
  // How many rotating has differs too, which is why `natural` above takes the
  // supply rather than working it out. Cross-marker pairs only means a mixed
  // night has `M × F` of them rather than the whole triangle, so the round the
  // repeats start at comes sooner — and this line would go on promising there
  // were enough to go round long past the point there were not.
  const supply = SUPPLY[format](natural, rounds > natural);

  return [describeNumbers(shape), seating, supply].join(". ").concat(".");
}

/** "court 3", "courts 3 and 4", "courts 3 to 6": one-based, as the board prints them. */
function courtRange(first: number, count: number): string {
  const from = first + 1;
  const to = first + count;
  if (count === 1) return `court ${from}`;
  if (count === 2) return `courts ${from} and ${to}`;
  return `courts ${from} to ${to}`;
}

function capitalise(text: string): string {
  return `${text[0].toUpperCase()}${text.slice(1)}`;
}

/** Who sits out of one Pool, in the unit its Format sits them out in. */
function poolSeating(shape: PoolShape, format: Format): string {
  const idle =
    format === "fixed"
      ? Math.max(0, Math.floor(shape.size / 2) - shape.courts * 2)
      : Math.max(0, shape.size - shape.courts * seatsPerCourt(format));
  if (idle === 0) return "everybody plays every round";
  const unit = format === "fixed" ? "pair" : "player";
  return `${plural(idle, unit)} ${idle === 1 ? "sits" : "sit"} out each round, taking turns`;
}

/**
 * The supply clause on a pooled board, which is always about the Pool that
 * runs out first. The default Round count is that Pool's natural length, so
 * this is also the line that says which Pool set it.
 */
function pooledSupply(plan: PoolPlan, rounds: number, format: Format): string {
  const every = plan.shortest.length === plan.shapes.length;
  const who = every ? "every pool" : poolNames(plan.shortest);
  const round = plan.natural;
  if (rounds > round) {
    const where = `in ${who} after round ${round}`;
    if (format === "rotating") return `Partners start repeating ${where}`;
    if (format === "fixed") return `Pairs start meeting again ${where}`;
    return `People start playing each other again ${where}`;
  }
  const what = format === "rotating" ? "new partners" : "new matchups";
  if (every) return `Every pool runs out of ${what} after round ${round}`;
  const verb = plan.shortest.length === 1 ? "runs" : "run";
  return `${who} ${verb} out of ${what} first, after round ${round}`;
}

/**
 * The consequence line for a board dealt into Pools: the particulars, then a
 * sentence per Pool saying where it plays and who sits, then any courts
 * nobody is on, then when the first Pool runs out.
 *
 * Still arithmetic and nothing more. It says what each Pool has to spend and
 * how many of its people are waiting at the fence, never whether a draw came
 * out balanced, which each Pool's own summary line reads off its own Scorer.
 */
export function describePooledConfig(shape: ConfigShape, plan: PoolPlan): string {
  const { format, rounds } = shape;
  const pools = plan.shapes.map(
    (pool) =>
      `${poolName(pool.label)}: ${plural(pool.size, "player")} on ${courtRange(pool.firstCourt, pool.courts)}, ${poolSeating(pool, format)}`,
  );

  // More courts than the Pools can fill is not refused, on mixed doubles'
  // precedent that the court count is a fact about the evening. The courts
  // are booked; the line says which of them nobody will be standing on.
  const empty = plan.courts - plan.used;
  const unused =
    empty > 0
      ? `${capitalise(courtRange(plan.used, empty))} ${empty === 1 ? "stands" : "stand"} empty, because no pool has the players to fill ${empty === 1 ? "it" : "them"}`
      : null;

  return [
    describeNumbers(shape),
    ...pools,
    unused,
    pooledSupply(plan, rounds, format),
  ]
    .filter((clause) => clause !== null)
    .join(". ")
    .concat(".");
}

/**
 * The same line for a Roster the tool cannot seat. It exists so that the
 * consequence line never goes away mid-edit: a Roster on its way from nothing
 * to eleven names passes through the sizes where there is no Config to
 * describe, and going quiet exactly there is going quiet when the organizer is
 * least sure what they have.
 */
export function describeUnsupportedRoster(players: number): string {
  if (players < MIN_ROSTER_SIZE) {
    const missing = MIN_ROSTER_SIZE - players;
    return `${plural(players, "player")}. ${missing} more and there is a court's worth.`;
  }
  // Too many for one rotation is not too many for the board: it is a list
  // that wants splitting, and the Pool count is the control that does it. So
  // the line points there rather than at the names to cut.
  if (players <= MAX_BOARD_SIZE) {
    const pools = Math.ceil(players / MAX_ROSTER_SIZE);
    return `${players} names is more than one rotation holds. Split into ${pools} pools or more.`;
  }
  const over = players - MAX_BOARD_SIZE;
  return `${plural(players, "player")}. ${over} more than one board holds, even split into pools.`;
}

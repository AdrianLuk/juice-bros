import { naturalLength } from "./config.ts";
import { formatName, seatsPerCourt } from "./format.ts";
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
}: ConfigShape): string {
  const drawn = mixed ? `${formatName(format)}, mixed doubles` : formatName(format);
  return `${drawn} · ${plural(players, "player")} on ${plural(courts, "court")}, ${plural(rounds, "round")}`;
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
  const over = players - MAX_ROSTER_SIZE;
  return `${plural(players, "player")}. ${over} more than one sheet holds.`;
}

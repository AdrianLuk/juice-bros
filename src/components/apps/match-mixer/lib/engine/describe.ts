import { naturalLength } from "./config.ts";
import { MAX_ROSTER_SIZE, MIN_ROSTER_SIZE } from "./types.ts";

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
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * Just the numbers: "13 players on 3 courts, 8 rounds". Short enough to sit in
 * a line that has other work to do, which is how a stale sheet says what it
 * was drawn from.
 */
export function describeNumbers({
  players,
  courts,
  rounds,
}: ConfigShape): string {
  return `${plural(players, "player")} on ${plural(courts, "court")}, ${plural(rounds, "round")}`;
}

export function describeConfig(shape: ConfigShape): string {
  const { players, courts, rounds } = shape;
  const sitting = Math.max(0, players - courts * 4);
  const natural = naturalLength(players, courts);

  const seating =
    sitting === 0
      ? "Everybody plays every round"
      : `${plural(sitting, "player")} ${sitting === 1 ? "sits" : "sit"} out each round, taking turns`;

  // Both halves are statements about the supply of partnerships, which is all
  // counting can establish. Past the natural length the pairs are spent and a
  // repeat is forced however good the search is; within it there are enough to
  // go round, which is not the same as promising a draw that uses them all
  // without collision. Whether one came out is the Scorer's to report.
  const partners =
    rounds > natural
      ? `Partners start repeating after round ${natural}`
      : "There are enough partnerships to go round";

  return [describeNumbers(shape), seating, partners].join(". ").concat(".");
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

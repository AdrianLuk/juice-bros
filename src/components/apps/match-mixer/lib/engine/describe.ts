import { naturalLength } from "./config.ts";

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
export function describeNumbers({ players, courts, rounds }: ConfigShape): string {
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

  // A statement about the arithmetic, not about the draw: past the natural
  // length there are no unused pairs left, so a repeat is forced however good
  // the search is.
  const partners =
    rounds > natural
      ? `Partners start repeating after round ${natural}`
      : "No partner has to repeat";

  return [describeNumbers(shape), seating, partners].join(". ").concat(".");
}

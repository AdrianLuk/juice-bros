import type { PlayerIndex, Schedule } from "./types.ts";

/**
 * One Player's evening, pulled out of the Schedule.
 *
 * The grid answers "what is the whole night", which is the organizer's
 * question. This answers the other one — "what is *my* night" — and it is a
 * different reading of the same Schedule rather than a second Schedule: a
 * Round-by-Round list of where one Roster index ends up.
 *
 * It works in indices like the rest of the engine and never sees a name, which
 * is what keeps two Players called Mike apart: they are two indices, so they
 * get two itineraries. Resolving an index back to a Player is the UI's job.
 *
 * Nothing here imports anything but engine types — the module has to resolve
 * under plain `node --test`, the same constraint the Scorer holds to.
 */

/** A Round the Player is on a court for. */
export interface PlayedRound {
  readonly kind: "game";
  /** Zero-based, like every other index the engine works in. */
  readonly round: number;
  readonly court: number;
  readonly partner: PlayerIndex;
  readonly opponents: readonly [PlayerIndex, PlayerIndex];
}

/** A Round the Player sits out. */
export interface ByeRound {
  readonly kind: "bye";
  readonly round: number;
}

export type ItineraryEntry = PlayedRound | ByeRound;

/**
 * Every Round of the Schedule, in order, from one Player's side of it.
 *
 * A Round the Player is not in a Game for reads as a Bye whether or not the
 * Round's `byes` list them. The two agree for anything the generator produces;
 * where they could not, an evening with a hole in it is a worse answer than
 * one that says "sitting out", and the Games are the half that decides where
 * somebody actually is.
 */
export function itinerary(
  schedule: Schedule,
  player: PlayerIndex,
): readonly ItineraryEntry[] {
  return schedule.rounds.map((round, index) => {
    for (const game of round.games) {
      for (const side of [0, 1] as const) {
        const team = game.teams[side];
        const seat = team.indexOf(player);
        if (seat === -1) continue;
        const other = game.teams[side === 0 ? 1 : 0];
        return {
          kind: "game",
          round: index,
          court: game.court,
          partner: team[seat === 0 ? 1 : 0],
          opponents: [other[0], other[1]],
        };
      }
    }
    return { kind: "bye", round: index };
  });
}

/**
 * The itinerary in words: the courts, the Rounds played on each, and the Byes
 * named rather than left to be inferred from an absence.
 *
 * It lives here rather than in the component because it is a reading of the
 * Schedule and not a piece of layout — the same reason the summary line's
 * numbers come off the Scorer. Second person because it is read by the person
 * who just tapped their own name, on the way to a court.
 */
export function describeItinerary(
  entries: readonly ItineraryEntry[],
): string {
  const played = entries.filter(
    (entry): entry is PlayedRound => entry.kind === "game",
  );
  const byes = entries.filter((entry) => entry.kind === "bye");

  if (played.length === 0) {
    return byes.length === 0
      ? "There are no rounds on this board."
      : "You're sitting out every round.";
  }

  // Courts in the order the evening meets them, not in numerical order: this
  // is read walking to the next court, so it should run the way the night
  // does.
  const courts: { court: number; rounds: number[] }[] = [];
  for (const entry of played) {
    const seen = courts.find((group) => group.court === entry.court);
    if (seen) seen.rounds.push(entry.round + 1);
    else courts.push({ court: entry.court, rounds: [entry.round + 1] });
  }

  // A sentence per court rather than one run joined by "and": the rounds under
  // each court are already a list ending in "and", so a second "and" between
  // the courts gives "rounds 3, 5 and 6 and Court 3", which has to be read
  // twice. A full stop is the one separator that cannot be misread, and this
  // is a line somebody reads once, walking.
  const where = courts
    .map((group) => `Court ${group.court + 1} in ${rounds(group.rounds)}`)
    .join(". ");

  const rest =
    byes.length === 0
      ? "You never sit out."
      : `Sitting out ${rounds(byes.map((entry) => entry.round + 1))}.`;

  return `You're on ${where}. ${rest}`;
}

/** "round 3", "rounds 1, 3 and 4" — never a bare number to be decoded. */
function rounds(numbers: readonly number[]): string {
  return `${numbers.length === 1 ? "round" : "rounds"} ${list(numbers.map(String))}`;
}

/** "a", "a and b", "a, b and c". No serial comma; this is read, not parsed. */
function list(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

import { clampConfig } from "./config.ts";
import { generateFixedRounds } from "./fixed.ts";
import { formatObjection } from "./format.ts";
import { generateRounds } from "./generator.ts";
import { markersOf, mixedObjection } from "./mixed.ts";
import { seating } from "./random.ts";
import { findTable } from "./tables.ts";
import {
  MAX_ROSTER_SIZE,
  MIN_ROSTER_SIZE,
  type Config,
  type Round,
  type Schedule,
  type Team,
} from "./types.ts";

/**
 * The engine's generation entry point, and the only place that decides which
 * generator a Config goes to.
 *
 * A Format is a generator and not a cost term (ADR 0003), so this routes on it
 * first. Fixed partners goes to its own circle construction and is finished
 * with; everything below applies to rotating doubles alone.
 *
 * For rotating it is Table lookup first, then the randomized greedy generator
 * for everything else, behind one signature (ADR 0002). Three things send a
 * rotating Config to the generator: fewer courts than `n / 4`, a Roster size
 * with no stored Table, and more Rounds than a Table holds. Only the last of
 * those has a Table to start from, and when it does, the generator continues
 * from that prefix rather than rebuilding it.
 *
 * No Format but rotating ever reaches `findTable`, which is the load-bearing
 * half of that routing: every stored Table is a whist tournament, and ADR
 * 0002's guarantee about its prefixes is a claim about rotating doubles that
 * says nothing at all about any other Format.
 *
 * Mixed doubles is the one thing here that is not a Format. It is a hard
 * constraint on rotating's seating, so it does not get a generator of its own
 * — it goes to the same search with the markers handed to it. What it does
 * share with the other Formats is that it never reaches `findTable`: a Table
 * is a construction over bare positions and cannot know which of them is an
 * `M`.
 */

/**
 * Thrown when no Schedule can be produced for a Config. Three things reach it:
 * a Roster outside 4 to 32; a Roster the selected Format cannot seat — an odd
 * list in fixed partners, where the last name has nobody to partner; and a
 * Roster the mixed-doubles constraint cannot seat, either because a line is
 * missing its marker or because one side is too short to fill the courts.
 *
 * Courts and Round count are not among them; they are clamped into range
 * rather than refused, because a number picker cannot offer an impossible
 * value in the first place, whereas a pasted list of names can be any length
 * at all and any parity at all.
 */
export class UnsupportedConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedConfigError";
  }
}

/**
 * A Table drawn with this Seed. The Seed decides which Roster position takes
 * each of the Table's seats and nothing else, so every guarantee ADR 0002
 * makes about the Table survives: relabeling the players in a whist tournament
 * permutes the partner and opponent counts along with them and leaves the
 * shape alone.
 *
 * Without this, the three Roster sizes with a stored Table would be the three
 * sizes where asking for a fresh draw returns the same sheet.
 */
function tablePrefix(
  n: number,
  courts: number,
  limit: number,
  seed: number,
): Round[] {
  const table = findTable(n, courts);
  if (!table) return [];

  const seat = seating(n, seed);
  const relabel = (team: Team): Team => [seat[team[0]], seat[team[1]]];

  // Truncation is the normal case, not a compromise: any leading run of a
  // whist tournament is still balanced (ADR 0002).
  return table.rounds.slice(0, limit).map((games) => ({
    games: games.map((teams, court) => ({
      court,
      teams: [relabel(teams[0]), relabel(teams[1])] as const,
    })),
    // A Table seats everyone every Round, by construction.
    byes: [],
  }));
}

export function generateSchedule(config: Config): Schedule {
  const n = config.roster.length;

  if (n < MIN_ROSTER_SIZE || n > MAX_ROSTER_SIZE) {
    throw new UnsupportedConfigError(
      `Roster of ${n} is outside ${MIN_ROSTER_SIZE}-${MAX_ROSTER_SIZE} players.`,
    );
  }

  // Run the same clamps the fields run, so a Config assembled anywhere else
  // still cannot ask for a Schedule the Roster could not sit down to.
  const { courts, rounds, format, mixed } = clampConfig(config);

  // Checked again here rather than trusted to the screen, for the same reason
  // Roster size is: this is the entry point, and a Config assembled anywhere
  // else must not be able to produce a board with somebody dropped off it.
  //
  // Mixed doubles has two of its own: a Roster only half marked, and one whose
  // counts cannot fill the chosen courts with `2c` of each. The second is why
  // this one takes the clamped court count rather than the Config's — the
  // arithmetic is about the courts that will actually be seated.
  const objection =
    formatObjection(config.roster, format) ??
    mixedObjection(config.roster, courts, mixed);
  if (objection) throw new UnsupportedConfigError(objection);

  // Past the objection every line carries a marker, so this is never null.
  const markers = mixed ? markersOf(config.roster) : null;
  if (markers) {
    // Never a Table either: every stored Table is a whist tournament over
    // bare positions and knows nothing about which seat holds which marker,
    // so its Rounds would seat two `M` on a side as readily as one of each.
    return {
      source: "generated",
      rounds: generateRounds({
        n,
        courts,
        rounds,
        seed: config.seed,
        markers,
      }),
    };
  }

  if (format === "fixed") {
    // Never a Table, whatever the Roster size: see the note above.
    return {
      source: "generated",
      rounds: generateFixedRounds({ n, courts, rounds, seed: config.seed }),
    };
  }

  const prefix = tablePrefix(n, courts, rounds, config.seed);
  if (prefix.length >= rounds) return { source: "table", rounds: prefix };

  return {
    // Part Table is still part generated, and the label exists so that nothing
    // downstream mistakes a Table for a guarantee of balance.
    source: "generated",
    rounds: generateRounds({ n, courts, rounds, seed: config.seed, prefix }),
  };
}

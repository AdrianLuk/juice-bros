import { clampConfig } from "./config.ts";
import { generateRounds } from "./generator.ts";
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
 * The engine's generation entry point: Table lookup first, then the randomized
 * greedy generator for everything else, behind one signature (ADR 0002).
 *
 * Three things send a Config to the generator: fewer courts than `n / 4`, a
 * Roster size with no stored Table, and more Rounds than a Table holds. Only
 * the last of those has a Table to start from, and when it does, the generator
 * continues from that prefix rather than rebuilding it.
 */

/**
 * Thrown when no Schedule can be produced for a Config. Only Roster size can
 * reach this now: courts and Round count are clamped into range rather than
 * refused, because a number picker cannot offer an impossible value in the
 * first place, whereas a pasted list of names can be any length at all.
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
  const { courts, rounds } = clampConfig(config);

  const prefix = tablePrefix(n, courts, rounds, config.seed);
  if (prefix.length >= rounds) return { source: "table", rounds: prefix };

  return {
    // Part Table is still part generated, and the label exists so that nothing
    // downstream mistakes a Table for a guarantee of balance.
    source: "generated",
    rounds: generateRounds({ n, courts, rounds, seed: config.seed, prefix }),
  };
}

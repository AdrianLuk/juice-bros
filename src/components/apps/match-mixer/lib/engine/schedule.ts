import { findTable, TABLES } from "./tables.ts";
import {
  MAX_ROSTER_SIZE,
  MIN_ROSTER_SIZE,
  type Config,
  type Round,
  type Schedule,
} from "./types.ts";

/**
 * The engine's generation entry point. Table lookup only for now: RR-1.2 adds
 * the randomized greedy fallback behind this same signature, which is why
 * callers ask for a Schedule rather than asking whether a Table exists.
 */

/**
 * Roster sizes `generateSchedule` can serve, for callers that need to know
 * before they ask — the UI has to offer a "not yet supported" state rather
 * than catch. Today that is exactly the sizes with a stored Table, so it is
 * read off the Tables rather than restated beside them; RR-1.2 widens it to
 * MIN_ROSTER_SIZE..MAX_ROSTER_SIZE when the greedy generator lands.
 */
export const SUPPORTED_ROSTER_SIZES: readonly number[] = TABLES.map(
  (table) => table.n,
);

/**
 * Thrown when no Schedule can be produced for a Config. Callers screen for
 * this ahead of time with `SUPPORTED_ROSTER_SIZES`; reaching it means the UI
 * offered a Config the engine never claimed to serve.
 */
export class UnsupportedConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedConfigError";
  }
}

export function generateSchedule(config: Config): Schedule {
  const n = config.roster.length;

  if (n < MIN_ROSTER_SIZE || n > MAX_ROSTER_SIZE) {
    throw new UnsupportedConfigError(
      `Roster of ${n} is outside ${MIN_ROSTER_SIZE}-${MAX_ROSTER_SIZE} players.`,
    );
  }

  const table = findTable(n, config.courts);
  if (!table) {
    throw new UnsupportedConfigError(
      `No Table for ${n} players on ${config.courts} courts, and the generator is not built yet.`,
    );
  }

  // Truncation is the normal case, not a compromise: any leading run of a
  // whist tournament is still balanced (ADR 0002).
  const requested = config.rounds ?? table.rounds.length;
  const length = Math.max(0, Math.min(requested, table.rounds.length));

  const rounds: Round[] = table.rounds.slice(0, length).map((games) => ({
    games: games.map((teams, court) => ({ court, teams })),
    // A Table seats everyone every Round, by construction.
    byes: [],
  }));

  return { source: "table", rounds };
}

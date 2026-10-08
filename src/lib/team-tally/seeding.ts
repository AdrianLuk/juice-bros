/**
 * Seeding (team-tally/CONTEXT.md, "Seeding"): every Team ranked on its
 * opening Team score, then paired down the order into Flights (1 and 2 are
 * Flight A, 3 and 4 Flight B, and so on).
 *
 * A tie on Team score is broken, in order, by:
 *   1. the Matchup winner, when the tied Teams played each other;
 *   2. point differential;
 *   3. Games won;
 *   4. the Organizer's order (their setup order until they say otherwise).
 *
 * Rule 1 is for two Teams: a group of three or more never all played each
 * other (each Team plays one opening Matchup), so it skips to point
 * differential, and any pair a later rule leaves level restarts at rule 1.
 * Because each Team has one opponent, that restart is the same as a plain
 * sort key: Team score, point differential, the Matchup winner within a pair
 * level on both, Games won, the Matchup winner within a pair level on all
 * three, then the Organizer. `team_tally_seed_order` in the database sorts on
 * the same key, so the Flights it places match these standings.
 *
 * Only a tie across a Flight boundary needs rule 4 to place Flights; a tie
 * inside a Flight is reported as "level". Relative imports only, for
 * `node --test`.
 */

/** One Team's opening record, as Seeding reads it. */
export type SeedEntry = {
  teamId: string;
  /** Position in the Organizer's setup, from 0. */
  setupIndex: number;
  /** The opening Matchup it played: two entries sharing one played each other. */
  matchupId: string;
  teamScore: number;
  pointDiff: number;
  gamesWon: number;
  /** Whether it won that Matchup (by Team score, or the Dreambreaker on a tie); null while undecided. */
  wonMatchup: boolean | null;
};

/** Which rule put a Team below the one above it. */
export type TieRule = "teamScore" | "matchupWinner" | "pointDiff" | "gamesWon" | "organizer" | "level";

export type Seed = {
  teamId: string;
  /** 1 and up. */
  position: number;
  flightLetter: string;
  /** What separated this Team from the one above it; null for the top seed. */
  decidedBy: TieRule | null;
};

/** Positions 1 and 2 are Flight A, 3 and 4 Flight B, and so on. */
export function flightLetterFor(position: number): string {
  return String.fromCharCode(65 + Math.floor((position - 1) / 2));
}

type Keyed = SeedEntry & { pairWinFirst: number; pairWinLast: number; organizerRank: number };

/** 1 for the winner of a pair that played each other and is level on `same`, else 0. */
function pairWins(entries: SeedEntry[], same: (a: SeedEntry, b: SeedEntry) => boolean): Map<string, number> {
  const wins = new Map<string, number>();
  for (const entry of entries) {
    const level = entries.filter((other) => same(entry, other));
    const pair = level.length === 2 && level[0].matchupId === level[1].matchupId;
    wins.set(entry.teamId, pair && entry.wonMatchup === true ? 1 : 0);
  }
  return wins;
}

/** Ranks every Team and says which rule decided each adjacent pair. */
export function seedTeams(entries: readonly SeedEntry[], organizerOrder: readonly string[] = []): Seed[] {
  const list = [...entries];
  const first = pairWins(list, (a, b) => a.teamScore === b.teamScore && a.pointDiff === b.pointDiff);
  const last = pairWins(
    list,
    (a, b) => a.teamScore === b.teamScore && a.pointDiff === b.pointDiff && a.gamesWon === b.gamesWon,
  );

  const keyed: Keyed[] = list.map((entry) => {
    const placed = organizerOrder.indexOf(entry.teamId);
    return {
      ...entry,
      pairWinFirst: first.get(entry.teamId)!,
      pairWinLast: last.get(entry.teamId)!,
      organizerRank: placed >= 0 ? placed : 1000 + entry.setupIndex,
    };
  });

  keyed.sort(
    (a, b) =>
      b.teamScore - a.teamScore ||
      b.pointDiff - a.pointDiff ||
      b.pairWinFirst - a.pairWinFirst ||
      b.gamesWon - a.gamesWon ||
      b.pairWinLast - a.pairWinLast ||
      a.organizerRank - b.organizerRank,
  );

  return keyed.map((entry, index) => {
    const position = index + 1;
    const above = keyed[index - 1];
    return {
      teamId: entry.teamId,
      position,
      flightLetter: flightLetterFor(position),
      decidedBy: above ? ruleBetween(above, entry, position) : null,
    };
  });
}

function ruleBetween(above: Keyed, below: Keyed, belowPosition: number): TieRule {
  if (above.teamScore !== below.teamScore) return "teamScore";
  if (above.pointDiff !== below.pointDiff) return "pointDiff";
  if (above.pairWinFirst !== below.pairWinFirst) return "matchupWinner";
  if (above.gamesWon !== below.gamesWon) return "gamesWon";
  if (above.pairWinLast !== below.pairWinLast) return "matchupWinner";
  // Level on every count. Inside one Flight it changes nothing.
  return flightLetterFor(belowPosition - 1) === flightLetterFor(belowPosition) ? "level" : "organizer";
}

const LABELS: Record<TieRule, string | null> = {
  teamScore: null,
  matchupWinner: "Won their Matchup",
  pointDiff: "Ahead on point differential",
  gamesWon: "Ahead on Games won",
  organizer: "Level on every count: organizer's call",
  level: "Level, same Flight",
};

/** How the standings say a tie was settled; null when Team score alone did it. */
export function tieRuleLabel(rule: TieRule): string | null {
  return LABELS[rule];
}

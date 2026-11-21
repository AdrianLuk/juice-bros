/**
 * Lineups (issue #713): the rule check. Pure and relative-import-only, so
 * `node --test` loads it and the editor warns live with the code the page
 * reads with. Rules warn, they never block a save (D3, D4, D20).
 */

export const LINEUP_GAMES = ["mens", "womens", "mixed1", "mixed2"] as const;
export type LineupGame = (typeof LINEUP_GAMES)[number];

export const GAME_LABEL: Record<LineupGame, string> = {
  mens: "Men's doubles",
  womens: "Women's doubles",
  mixed1: "Mixed 1",
  mixed2: "Mixed 2",
};

/** Two player ids; null is an empty slot. */
export type Pair = [string | null, string | null];
export type Lineup = Record<LineupGame, Pair>;
/** What the database hands back: only the Pairs that were saved, ids possibly stale. */
export type RawLineup = Partial<Record<LineupGame, (string | null)[]>>;

type Member = { id: string; name: string; gender: "M" | "F" };

export const MAX_GAMES_PER_PLAYER = 2;

export const emptyLineup = (): Lineup => ({
  mens: [null, null],
  womens: [null, null],
  mixed1: [null, null],
  mixed2: [null, null],
});

/** A Team's saved Lineup, or null when none is saved. An id no longer on the Team reads as an empty slot. */
export function readLineup(players: Member[], raw: RawLineup | null | undefined): Lineup | null {
  if (!raw || LINEUP_GAMES.every((game) => !raw[game]?.some(Boolean))) return null;
  const known = new Set(players.map((player) => player.id));
  const slot = (id: string | null | undefined) => (id && known.has(id) ? id : null);
  const lineup = emptyLineup();
  for (const game of LINEUP_GAMES) lineup[game] = [slot(raw[game]?.[0]), slot(raw[game]?.[1])];
  return lineup;
}

export type LineupWarnings = {
  /** Beside the Pair each is about. */
  pairs: Record<LineupGame, string[]>;
  /** About the Team: players left out of every Game. */
  team: string[];
};

/** Every rule a Lineup can break. An uneven Team doubling up its few players is not a break. */
export function lineupWarnings(players: Member[], lineup: Lineup): LineupWarnings {
  const byId = new Map(players.map((player) => [player.id, player]));
  const pairs: Record<LineupGame, string[]> = { mens: [], womens: [], mixed1: [], mixed2: [] };
  const games = new Map<string, number>();
  const membersOf = (game: LineupGame) => [...new Set(lineup[game].map((id) => (id ? byId.get(id) : undefined)))];

  for (const game of LINEUP_GAMES) {
    const [a, b] = lineup[game].map((id) => (id ? byId.get(id) : undefined));
    if (a && a === b) pairs[game].push(`${a.name} is in this Pair twice.`);
    for (const member of membersOf(game)) if (member) games.set(member.id, (games.get(member.id) ?? 0) + 1);

    if (game === "mens" || game === "womens") {
      const want = game === "mens" ? "M" : "F";
      for (const member of membersOf(game)) {
        if (member && member.gender !== want) {
          pairs[game].push(
            `${member.name} is ${member.gender === "M" ? "a man" : "a woman"}. ${GAME_LABEL[game]} takes two ${want === "M" ? "men" : "women"}.`,
          );
        }
      }
    } else if (a && b && a !== b && a.gender === b.gender) {
      pairs[game].push(`${GAME_LABEL[game]} takes one man and one woman.`);
    }
  }

  for (const game of LINEUP_GAMES) {
    for (const member of membersOf(game)) {
      const count = member ? (games.get(member.id) ?? 0) : 0;
      if (member && count > MAX_GAMES_PER_PLAYER) pairs[game].push(`${member.name} plays ${count} Games. Two is the most.`);
    }
  }

  const team = players.filter((player) => !games.has(player.id)).map((player) => `${player.name} is in no Game.`);
  return { pairs, team };
}

export function hasWarnings(warnings: LineupWarnings): boolean {
  return warnings.team.length > 0 || LINEUP_GAMES.some((game) => warnings.pairs[game].length > 0);
}

/** The editor's form field for a slot, e.g. `mens-1`. */
export const slotField = (game: LineupGame, slot: 1 | 2) => `${game}-${slot}`;

/** Reads the editor's fields. A blank is an empty slot; an id that is not on the Team is refused. */
export function readLineupFields(
  players: Member[],
  get: (field: string) => string,
): { lineup: Lineup } | { problem: string } {
  const known = new Set(players.map((player) => player.id));
  const lineup = emptyLineup();
  for (const game of LINEUP_GAMES) {
    for (const slot of [1, 2] as const) {
      const id = get(slotField(game, slot)).trim();
      if (id !== "" && !known.has(id)) return { problem: "That player is not on this Team. Reload the page." };
      lineup[game][slot - 1] = id === "" ? null : id;
    }
  }
  return { lineup };
}

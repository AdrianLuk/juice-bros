/**
 * The roster (issue #712): the paste parser and the Average Rating. Pure and
 * relative-import-only, so `node --test` loads it (path aliases don't work
 * there) and the browser can preview with the same code the server saves with.
 */

export type Gender = "M" | "F";

/** A player as pasted, before it has an id. Ratings are null when blank. */
export type RosterPlayer = {
  name: string;
  gender: Gender;
  dupr: number | null;
  duar: number | null;
  dusr: number | null;
};

/** A saved player and Team: the same, with ids. */
export type StoredPlayer = RosterPlayer & { id: string };
export type StoredTeam = { id: string; name: string; players: StoredPlayer[] };

export type RosterTeam ={ name: string; players: RosterPlayer[] };

export type RosterProblem = { line: number | null; message: string };

export type ParsedRoster = {
  teams: RosterTeam[];
  /** Rows that did not parse, and rows with a rating out of range. */
  rowProblems: RosterProblem[];
  /** Whole-roster flags: the Team count, a Team with no Captain. */
  teamProblems: RosterProblem[];
};

export const TEAM_COUNT = 4;
export const MAX_PLAYER_NAME = 80;
export const MAX_TEAM_NAME = 60;
export const MAX_PLAYERS_PER_TEAM = 30;

/** What the Average Rating shows when no rating is filled in. */
export const NO_AVERAGE = "–";

const BLANKS = new Set(["", "-", "–", "—", "n/a", "na"]);

export type RatingKind = "dupr" | "duar" | "dusr";

const RATINGS: Record<RatingKind, { label: string; decimals: number; min: number; max: number }> = {
  dupr: { label: "DUPR", decimals: 3, min: 1, max: 9 },
  duar: { label: "DUAR", decimals: 1, min: 1, max: 7 },
  dusr: { label: "DUSR", decimals: 1, min: 1, max: 7 },
};

/** A rating cell: `null` for blank, a number rounded to the scale, or a message when it can't be one. */
export function readRating(cell: string, kind: RatingKind): { value: number | null } | { problem: string } {
  const { label, decimals, min, max } = RATINGS[kind];
  const text = cell.trim();
  if (BLANKS.has(text.toLowerCase())) return { value: null };
  if (!/^\d+(\.\d+)?$/.test(text)) return { problem: `${label} "${text}" is not a number` };
  const value = Number(Number(text).toFixed(decimals));
  if (value < min || value > max) return { problem: `${label} ${text} is outside ${min.toFixed(1)} to ${max.toFixed(1)}` };
  return { value };
}

/** Mean of the ratings that are filled in, to 3 decimals, or null when none are. Computed, never stored. */
export function averageRating(player: Pick<RosterPlayer, "dupr" | "duar" | "dusr">): number | null {
  const filled = [player.dupr, player.duar, player.dusr].filter((value): value is number => value !== null);
  if (filled.length === 0) return null;
  return Number((filled.reduce((sum, value) => sum + value, 0) / filled.length).toFixed(3));
}

/** "4.258", or "–" when no rating is filled in. */
export function formatAverage(player: Pick<RosterPlayer, "dupr" | "duar" | "dusr">): string {
  const average = averageRating(player);
  return average === null ? NO_AVERAGE : average.toFixed(3);
}

/** "3.5" for DUAR and DUSR, "4.258" for DUPR, "–" for blank. */
export function formatRating(value: number | null, kind: RatingKind): string {
  return value === null ? NO_AVERAGE : value.toFixed(RATINGS[kind].decimals);
}

/** The Captain is the player whose name matches the Team name. */
export function captainOf<P extends { name: string }>(team: { name: string; players: P[] }): P | undefined {
  const want = team.name.trim().toLowerCase();
  return team.players.find((player) => player.name.trim().toLowerCase() === want);
}

function isHeader(cells: string[]): boolean {
  return cells[0].trim().toLowerCase() === "player" || cells[2]?.trim().toLowerCase() === "dupr";
}

/**
 * Rows copied from the sheet, tab-separated: Player, M/F, DUPR, DUAR, DUSR,
 * Total Avg Rating, Team. A header row and blank lines are skipped; the
 * average column is ignored. Teams come out in the order they first appear.
 * Nothing here throws: whatever can't be read comes back as a problem.
 */
export function parseRoster(text: string): ParsedRoster {
  const teams: RosterTeam[] = [];
  const rowProblems: RosterProblem[] = [];
  const teamProblems: RosterProblem[] = [];

  text.split(/\r?\n/).forEach((raw, index) => {
    if (raw.trim() === "") return;
    const line = index + 1;
    const cells = raw.split("\t");
    if (isHeader(cells)) return;
    if (cells.length < 7) {
      rowProblems.push({ line, message: `Row ${line} has ${cells.length} columns, not 7. Copy the rows from the sheet again.` });
      return;
    }
    const name = cells[0].trim();
    const gender = cells[1].trim().toUpperCase();
    const teamName = cells[6].trim();
    const problems: string[] = [];
    if (name === "") problems.push("no player name");
    else if (name.length > MAX_PLAYER_NAME) problems.push(`name over ${MAX_PLAYER_NAME} characters`);
    if (gender !== "M" && gender !== "F") problems.push(`gender "${cells[1].trim()}" is not M or F`);
    if (teamName === "") problems.push("no Team");
    else if (teamName.length > MAX_TEAM_NAME) problems.push(`Team name over ${MAX_TEAM_NAME} characters`);
    const ratings = (["dupr", "duar", "dusr"] as const).map((kind, i) => readRating(cells[2 + i], kind));
    for (const rating of ratings) if ("problem" in rating) problems.push(rating.problem);
    if (problems.length > 0) {
      rowProblems.push({ line, message: `Row ${line}${name ? ` (${name})` : ""}: ${problems.join("; ")}.` });
      return;
    }
    const [dupr, duar, dusr] = ratings.map((rating) => ("value" in rating ? rating.value : null));
    let team = teams.find((each) => each.name.toLowerCase() === teamName.toLowerCase());
    if (!team) {
      team = { name: teamName, players: [] };
      teams.push(team);
    }
    team.players.push({ name, gender: gender as Gender, dupr, duar, dusr });
  });

  if (teams.length !== TEAM_COUNT) {
    teamProblems.push({
      line: null,
      message: `Found ${teams.length} ${teams.length === 1 ? "Team" : "Teams"}. A DDD has exactly ${TEAM_COUNT}, so check the Team column.`,
    });
  }
  for (const team of teams) {
    if (team.players.length > MAX_PLAYERS_PER_TEAM) {
      teamProblems.push({ line: null, message: `${team.name} has more than ${MAX_PLAYERS_PER_TEAM} players.` });
    }
    if (!captainOf(team)) {
      teamProblems.push({ line: null, message: `${team.name} has no Captain: no player is named ${team.name}.` });
    }
  }
  return { teams, rowProblems, teamProblems };
}

/** One player's fields as an edit form sends them. */
export type PlayerFields = { name: string; gender: string; dupr: string; duar: string; dusr: string };

/** A player from an edit or add form, or what stops it saving, in the Organizer's words. */
export function readPlayer(fields: PlayerFields): { player: RosterPlayer } | { problem: string } {
  const name = fields.name.trim();
  if (name === "") return { problem: "Give the player a name." };
  if (name.length > MAX_PLAYER_NAME) return { problem: `Keep the name to ${MAX_PLAYER_NAME} characters.` };
  if (fields.gender !== "M" && fields.gender !== "F") return { problem: "Pick M or F." };
  const ratings = (["dupr", "duar", "dusr"] as const).map((kind) => readRating(fields[kind], kind));
  for (const rating of ratings) if ("problem" in rating) return { problem: `${rating.problem}.` };
  const [dupr, duar, dusr] = ratings.map((rating) => ("value" in rating ? rating.value : null));
  return { player: { name, gender: fields.gender, dupr, duar, dusr } };
}

/** True when the roster can be saved: every row read and exactly 4 Teams. A missing Captain only warns. */
export function canSave(parsed: ParsedRoster): boolean {
  return (
    parsed.rowProblems.length === 0 &&
    parsed.teams.length === TEAM_COUNT &&
    parsed.teams.every((team) => team.players.length <= MAX_PLAYERS_PER_TEAM)
  );
}

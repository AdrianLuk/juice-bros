/**
 * What an Organizer fills in to build a Team Event, and the rules it has to
 * meet before Team Tally saves it (issue #622).
 *
 * Pure and relative-import-only, so `node --test` loads it directly. The
 * problems it returns are shown to the Organizer as they are.
 */

export type SetupTeam = {
  /**
   * The saved Team's id, when editing. Saving with it keeps the Team's row,
   * and so the Score Link already printed in the Brief.
   */
  id?: string;
  /** Optional: a blank nickname prints no quoted part in the Brief. */
  nickname: string;
  captain: string;
  slotA: string;
  slotB: string;
  slotC: string;
  homeCourt: string;
};

/** An opening Matchup: two Teams, by their index in `teams`. */
export type SetupMatchup = {
  red: number;
  blue: number;
};

export type TeamEventSetup = {
  name: string;
  /** `YYYY-MM-DD`. */
  date: string;
  teams: SetupTeam[];
  matchups: SetupMatchup[];
};

export type SetupValidation = { ok: true } | { ok: false; problems: string[] };

function teamLabel(team: SetupTeam | undefined, index: number): string {
  const captain = team?.captain.trim();
  return captain ? `Team ${captain}` : `Team ${index + 1}`;
}

/**
 * The date a new Team Event starts on: the coming Tuesday, or `today` when it
 * is one (the night Team Tally was built around). Both are `YYYY-MM-DD`.
 */
export function comingTuesday(today: string): string {
  const date = new Date(`${today}T00:00:00Z`);
  const daysAhead = (2 - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + daysAhead);
  return date.toISOString().slice(0, 10);
}

const TEAM_TEXT_FIELDS =["nickname", "captain", "slotA", "slotB", "slotC", "homeCourt"] as const;

/**
 * Reads the setup the form posts as JSON. Anything not shaped like a setup is
 * null as a whole, so a tampered post is refused rather than half-read. Says
 * nothing about whether the setup is valid: that is `validateSetup`.
 */
export function parseSetup(json: string): TeamEventSetup | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }

  if (typeof raw !== "object" || raw === null) return null;
  const { name, date, teams, matchups } = raw as Record<string, unknown>;
  if (typeof name !== "string" || typeof date !== "string") return null;
  if (!Array.isArray(teams) || !Array.isArray(matchups)) return null;

  const parsedTeams: SetupTeam[] = [];
  for (const team of teams) {
    if (typeof team !== "object" || team === null) return null;
    const record = team as Record<string, unknown>;
    if (TEAM_TEXT_FIELDS.some((field) => typeof record[field] !== "string")) return null;
    if (record.id !== undefined && typeof record.id !== "string") return null;

    const parsed: SetupTeam = {
      nickname: record.nickname as string,
      captain: record.captain as string,
      slotA: record.slotA as string,
      slotB: record.slotB as string,
      slotC: record.slotC as string,
      homeCourt: record.homeCourt as string,
    };
    if (typeof record.id === "string") parsed.id = record.id;
    parsedTeams.push(parsed);
  }

  const parsedMatchups: SetupMatchup[] = [];
  for (const matchup of matchups) {
    if (typeof matchup !== "object" || matchup === null) return null;
    const { red, blue } = matchup as Record<string, unknown>;
    if (!Number.isInteger(red) || !Number.isInteger(blue)) return null;
    parsedMatchups.push({ red: red as number, blue: blue as number });
  }

  return { name, date, teams: parsedTeams, matchups: parsedMatchups };
}

/** The format's ceiling: Flights are lettered A to G, two Teams each. */
export const MAX_TEAMS = 14;
export const MIN_TEAMS = 4;

const SLOT_FIELDS = [
  ["slotA", "A"],
  ["slotB", "B"],
  ["slotC", "C"],
] as const;

export function validateSetup(setup: TeamEventSetup): SetupValidation {
  const problems: string[] = [];
  const { teams, matchups } = setup;

  if (!setup.name.trim()) {
    problems.push("Give the Team Event a name.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(setup.date.trim())) {
    problems.push("Pick the date of the Team Event.");
  }

  if (teams.length < MIN_TEAMS) {
    problems.push(`A Team Event needs at least ${MIN_TEAMS} Teams.`);
  } else if (teams.length > MAX_TEAMS) {
    problems.push(`Team Tally runs up to ${MAX_TEAMS} Teams.`);
  }
  if (teams.length % 2 !== 0) {
    problems.push("A Team Event needs an even number of Teams.");
  }

  teams.forEach((team, index) => {
    const label = teamLabel(team, index);
    if (!team.captain.trim()) {
      problems.push(`${label} needs a captain.`);
    }
    for (const [field, slot] of SLOT_FIELDS) {
      if (!team[field].trim()) {
        problems.push(`${label} needs a name for Player ${slot}.`);
      }
    }
    if (!team.homeCourt.trim()) {
      problems.push(`${label} needs a home court.`);
    }
  });

  // Which Matchup each Team is in. A Team must be in exactly one.
  const matchupOf = new Map<number, number[]>();
  matchups.forEach((matchup, matchupIndex) => {
    const pair = [matchup.red, matchup.blue];
    if (
      matchup.red === matchup.blue ||
      pair.some((index) => !Number.isInteger(index) || index < 0 || index >= teams.length)
    ) {
      problems.push(`Match ${matchupIndex + 1} needs two different Teams.`);
      return;
    }
    for (const index of pair) {
      matchupOf.set(index, [...(matchupOf.get(index) ?? []), matchupIndex]);
    }

    const red = teams[matchup.red];
    const blue = teams[matchup.blue];
    const court = red.homeCourt.trim();
    if (court && court === blue.homeCourt.trim()) {
      problems.push(
        `${teamLabel(red, matchup.red)} and ${teamLabel(blue, matchup.blue)} both meet on court ${court}. A Matchup plays on its two Teams' home courts.`,
      );
    }
  });

  teams.forEach((team, index) => {
    const count = matchupOf.get(index)?.length ?? 0;
    if (count === 0) {
      problems.push(`${teamLabel(team, index)} isn't in a Matchup.`);
    } else if (count > 1) {
      problems.push(`${teamLabel(team, index)} is in more than one Matchup.`);
    }
  });

  // One Team per court. Two Teams of the same Matchup on one court are
  // already reported above, as the Matchup's problem.
  const teamsOnCourt = new Map<string, number[]>();
  teams.forEach((team, index) => {
    const court = team.homeCourt.trim();
    if (court) {
      teamsOnCourt.set(court, [...(teamsOnCourt.get(court) ?? []), index]);
    }
  });
  for (const [court, indexes] of teamsOnCourt) {
    const sameMatchup =
      indexes.length === 2 &&
      matchups.some(
        (matchup) =>
          (matchup.red === indexes[0] && matchup.blue === indexes[1]) ||
          (matchup.red === indexes[1] && matchup.blue === indexes[0]),
      );
    if (indexes.length > 1 && !sameMatchup) {
      problems.push(`Court ${court} is the home court of more than one Team.`);
    }
  }

  return problems.length === 0 ? { ok: true } : { ok: false, problems };
}

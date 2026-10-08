/**
 * Reads an old brief back into Matchups and Teams, so an Organizer who wrote
 * theirs before Team Tally existed can paste it into the setup form instead
 * of retyping it (issue #626).
 *
 * It reads only what the form holds: per Matchup, the court pair; per Team,
 * captain, nickname, home court and the roster (captain, A, B, C, separated
 * by `•`). Every other line (the format sections, Score Links, Flights) is
 * ignored. It never fails: what it cannot read comes back blank and listed in
 * the Team's `flagged`, for the form to highlight.
 *
 * Two layouts are read, and a few spellings of each:
 *
 *   🔴 Team Ben — “The Real Dill”      🔴 Team Ben (Just4Fun)— Court 10
 *   Court 21                           Ben• Anna Leigh • Federico • Catherine
 *   Ben • Anna Leigh • ...
 *
 * Pure and relative-import-only, so `node --test` loads it directly.
 */

export type TeamField = "captain" | "slotA" | "slotB" | "slotC" | "nickname" | "homeCourt";

/** The order `flagged` lists fields in, matching the order the form shows them. */
const FIELD_ORDER: TeamField[] = ["captain", "slotA", "slotB", "slotC", "nickname", "homeCourt"];

const ROSTER_FIELDS = ["captain", "slotA", "slotB", "slotC"] as const;

export type ParsedTeam = {
  captain: string;
  slotA: string;
  slotB: string;
  slotC: string;
  /** Empty when the Team has none. */
  nickname: string;
  homeCourt: string;
  /** Fields that could not be read cleanly. The form highlights them. */
  flagged: TeamField[];
};

export type ParsedMatchup = {
  /** The courts the header names, red Team's first. Null when it names none. */
  courts: [string, string] | null;
  red: ParsedTeam;
  blue: ParsedTeam;
};

export type ParsedBrief = { matchups: ParsedMatchup[] };

type TeamDraft = {
  /** The name on the Team line, before the roster says better. */
  lineCaptain: string;
  /** The line's name has a dash in it: probably a nickname that lost its quotes. */
  lineCaptainSuspect: boolean;
  nickname: string;
  nicknameFlagged: boolean;
  court: string | null;
  roster: string[] | null;
};

type MatchupDraft = { courts: [string, string] | null; teams: TeamDraft[] };

/** Leading emoji, bullets and spaces: anything before the first letter or digit. */
const LEADING_NOISE = /^[^\p{L}\p{N}]*/u;

const MATCH_HEADER =
  /^[^\p{L}\p{N}]*match\s+\d+\b(?:[^\n]*?\bcourts?\s+([\p{L}\p{N}]+)\s*(?:&|\band\b|\+|,|\/)\s*([\p{L}\p{N}]+))?/iu;

const COURT_LINE = /^[^\p{L}\p{N}]*court\s+([\p{L}\p{N}]+)\s*$/iu;

const TRAILING_COURT = /[\s—–\-,:]*\bcourt\s+([\p{L}\p{N}]+)\s*$/iu;

const TEAM_MARKER = /[🔴🔵]/u;

function parseTeamLine(line: string): TeamDraft | null {
  const noise = line.match(LEADING_NOISE)?.[0] ?? "";
  let body = line.slice(noise.length);

  const teamWord = /^team(?=$|[\s—–\-:])/i;
  if (!TEAM_MARKER.test(noise) && !teamWord.test(body)) return null;
  body = body.replace(teamWord, "");

  let court: string | null = null;
  const courtMatch = body.match(TRAILING_COURT);
  if (courtMatch) {
    court = courtMatch[1];
    body = body.slice(0, courtMatch.index);
  }

  let nickname = "";
  let nicknameFlagged = false;
  const quoted = body.match(/[“"‘]([^”"’]*)[”"’]/u) ?? body.match(/\(([^)]*)\)/);
  const unclosed = quoted ? null : (body.match(/[“"‘]([^”"’]*)$/u) ?? body.match(/\(([^)]*)$/));
  const found = quoted ?? unclosed;
  if (found) {
    nickname = found[1].trim();
    nicknameFlagged = !quoted;
    body = body.slice(0, found.index) + body.slice((found.index ?? 0) + found[0].length);
  }

  const lineCaptain = body.replace(/^[\s—–\-:,]+|[\s—–\-:,]+$/g, "").replace(/\s+/g, " ");

  return {
    lineCaptain,
    lineCaptainSuspect: /[—–]/.test(lineCaptain),
    nickname,
    nicknameFlagged,
    court,
    roster: null,
  };
}

function parseRoster(line: string): string[] {
  return line.split("•").map((name) => name.trim().replace(/\s+/g, " "));
}

function finishTeam(draft: TeamDraft | undefined, pairedCourt: string | undefined): ParsedTeam {
  const flagged = new Set<TeamField>();
  const names: Record<(typeof ROSTER_FIELDS)[number], string> = {
    captain: "",
    slotA: "",
    slotB: "",
    slotC: "",
  };

  if (!draft?.roster) {
    for (const field of ["slotA", "slotB", "slotC"] as const) flagged.add(field);
    names.captain = draft?.lineCaptain ?? "";
    // With no roster the Team line's name is all there is, and the slots are
    // flagged anyway. It is the captain only when it does not look suspect.
    if (draft?.lineCaptainSuspect) flagged.add("captain");
  } else {
    const tooMany = draft.roster.length > ROSTER_FIELDS.length;
    ROSTER_FIELDS.forEach((field, index) => {
      names[field] = draft.roster?.[index] ?? "";
      if (tooMany || names[field] === "") flagged.add(field);
    });
    if (names.captain === "") {
      names.captain = draft.lineCaptain;
      if (names.captain !== "") flagged.delete("captain");
    }
  }
  if (names.captain === "") flagged.add("captain");

  if (draft?.nicknameFlagged) flagged.add("nickname");

  const homeCourt = draft?.court ?? pairedCourt ?? "";
  if (homeCourt === "") flagged.add("homeCourt");

  return {
    ...names,
    nickname: draft?.nickname ?? "",
    homeCourt,
    flagged: FIELD_ORDER.filter((field) => flagged.has(field)),
  };
}

function finishMatchup({ courts, teams }: MatchupDraft): ParsedMatchup {
  return {
    courts,
    red: finishTeam(teams[0], courts?.[0]),
    blue: finishTeam(teams[1], courts?.[1]),
  };
}

export function parseBrief(text: string): ParsedBrief {
  const matchups: ParsedMatchup[] = [];
  let current: MatchupDraft | null = null;

  const close = () => {
    if (current) matchups.push(finishMatchup(current));
    current = null;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "") continue;

    const header = line.match(MATCH_HEADER);
    if (header) {
      close();
      current = { courts: header[1] && header[2] ? [header[1], header[2]] : null, teams: [] };
      continue;
    }
    if (!current) continue;

    const lastTeam: TeamDraft | undefined = current.teams[current.teams.length - 1];

    const courtLine = line.match(COURT_LINE);
    if (courtLine) {
      if (lastTeam && lastTeam.court === null) lastTeam.court = courtLine[1];
      continue;
    }

    if (line.includes("•")) {
      if (lastTeam && lastTeam.roster === null) lastTeam.roster = parseRoster(line);
      continue;
    }

    const team = parseTeamLine(line);
    if (team && current.teams.length < 2) current.teams.push(team);
  }
  close();

  return { matchups };
}

/**
 * Team Tally fixtures (issue #623): a throwaway Organizer and their four-Team
 * night, built straight through the database's own save function as that
 * Organizer, so a scoring spec doesn't have to drive the setup form (that is
 * `team-tally.spec.ts`'s job). Deleting the Organizer takes the night with it.
 *
 * Local Docker stack only, with Supabase's published demo keys, the same as
 * `on-deck.ts`. Names are PPA Tour pros: this repo is public.
 */

import { torontoDate } from "./dates.ts";

const API_URL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const PASSWORD = "pickleball123";

export const TEAM_TALLY_NIGHT = {
  teams: [
    { nickname: "Golden Set", homeCourt: "16", captain: "Ben Johns", slotA: "Anna Leigh Waters", slotB: "Collin Johns", slotC: "Anna Bright" },
    { nickname: "", homeCourt: "19", captain: "Federico Staksrud", slotA: "Catherine Parenteau", slotB: "Andrei Daescu", slotC: "Jorja Johnson" },
    { nickname: "Kitchen Kings", homeCourt: "17", captain: "Hayden Patriquin", slotA: "Tyra Black", slotB: "Gabriel Tardio", slotC: "Lea Jansen" },
    { nickname: "", homeCourt: "18", captain: "Christian Alshon", slotA: "Jessie Irvine", slotB: "JW Johnson", slotC: "Kaitlyn Christian" },
  ],
  matchups: [
    { red: 0, blue: 1 },
    { red: 2, blue: 3 },
  ],
};

type Night = typeof TEAM_TALLY_NIGHT;

const FOURTEEN: [string, string, string, string, string][] = [
  ["16", "Ben Johns", "Anna Leigh Waters", "Collin Johns", "Anna Bright"],
  ["19", "Federico Staksrud", "Catherine Parenteau", "Andrei Daescu", "Jorja Johnson"],
  ["17", "Hayden Patriquin", "Tyra Black", "Gabriel Tardio", "Lea Jansen"],
  ["18", "Christian Alshon", "Jessie Irvine", "JW Johnson", "Kaitlyn Christian"],
  ["20", "Riley Newman", "Parris Todd", "Tyson McGuffin", "Callie Smith"],
  ["21", "Jay Devilliers", "Lucy Kovalova", "Dylan Frazier", "Vivienne David"],
  ["22", "Connor Garnett", "Allyce Jones", "Hunter Johnson", "Jade Kawamoto"],
  ["23", "Pablo Tellez", "Etta Wright", "Zane Navratil", "Mary Brascia"],
  ["24", "Matt Wright", "Rachel Rohrabacher", "James Ignatowich", "Sofia Sewing"],
  ["25", "Augustus Ge", "Meghan Dizon", "Jaume Martinez Vich", "Kate Fahey"],
  ["26", "Quang Duong", "Lacy Schneemann", "Thomas Wilson", "Jackie Kawamoto"],
  ["27", "Eric Oncins", "Genie Erokhina", "Jack Sock", "Judit Castillo"],
  ["28", "Rob Nunnery", "Alix Truong", "CJ Klinger", "Salome Devidze"],
  ["29", "Will Howells", "Simone Jardim", "Dekel Bar", "Tyler Loong"],
];

/**
 * A full 14-Team night (seven Matchups), for the big screen at its busiest.
 * Names are PPA Tour pros, the same as the 14-Team brief fixture.
 */
export const TEAM_TALLY_FOURTEEN: Night = {
  teams: FOURTEEN.map(([homeCourt, captain, slotA, slotB, slotC], index) => ({
    nickname: ["Golden Set", "Third Shot Drop", "Kitchen Kings"][index] ?? "",
    homeCourt,
    captain,
    slotA,
    slotB,
    slotC,
  })),
  matchups: Array.from({ length: 7 }, (_, index) => ({ red: index * 2, blue: index * 2 + 1 })),
};

export type SeededTeamEvent = {
  organizerEmail: string;
  organizerPassword: string;
  userId: string;
  eventId: string;
  publicToken: string;
  /** In setup order, matching `TEAM_TALLY_NIGHT.teams`. */
  scoreTokens: string[];
};

async function ok(res: Response, what: string): Promise<Response> {
  if (!res.ok) {
    throw new Error(`${what} failed: ${res.status} ${await res.text()}`);
  }
  return res;
}

type Headers = Record<string, string>;

/** Signs the Organizer in by password and returns headers that call PostgREST as them. */
async function organizerHeaders(email: string, password: string): Promise<Headers> {
  const session = await ok(
    await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
    "signing the Organizer in",
  );
  const accessToken = ((await session.json()) as { access_token: string }).access_token;
  return { apikey: ANON_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
}

/** Calls a Team Tally database function as the Organizer. */
async function rpc(headers: Headers, fn: string, args: Record<string, unknown>, what: string): Promise<Response> {
  return ok(
    await fetch(`${API_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args) }),
    what,
  );
}

type OrganizerDoc = {
  teams: { id: string }[];
  matchups: {
    id: string;
    stage: string;
    number: number;
    flightLetter: string | null;
    redTeamId: string;
    blueTeamId: string;
    games: { id: string }[];
  }[];
};

async function organizerEvent(headers: Headers, seeded: SeededTeamEvent): Promise<OrganizerDoc> {
  const read = await rpc(headers, "team_tally_organizer_event", { p_event_id: seeded.eventId }, "reading the Team Event");
  return (await read.json()) as OrganizerDoc;
}

/** A fresh Organizer with a four-Team night (Matchups 16 & 19, 17 & 18). */
export async function seedTeamEvent(name = "Tuesday Team Night", night: Night = TEAM_TALLY_NIGHT): Promise<SeededTeamEvent> {
  const email = `team-tally-live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

  const created = await ok(
    await fetch(`${API_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
    }),
    "creating the Organizer",
  );
  const userId = ((await created.json()) as { id: string }).id;
  const asOrganizer = await organizerHeaders(email, PASSWORD);

  const saved = await rpc(
    asOrganizer,
    "team_tally_save_event",
    {
      p_event_id: null,
      p_name: name,
      p_event_date: torontoDate(0),
      p_teams: night.teams,
      p_matchups: night.matchups,
    },
    "saving the Team Event",
  );
  const eventId = (await saved.json()) as string;

  const read = await ok(
    await fetch(
      `${API_URL}/rest/v1/team_tally_events?id=eq.${eventId}&select=public_token,team_tally_teams(position,score_token)`,
      { headers: asOrganizer },
    ),
    "reading the links",
  );
  const [row] = (await read.json()) as {
    public_token: string;
    team_tally_teams: { position: number; score_token: string }[];
  }[];

  return {
    organizerEmail: email,
    organizerPassword: PASSWORD,
    userId,
    eventId,
    publicToken: row.public_token,
    scoreTokens: [...row.team_tally_teams].sort((a, b) => a.position - b.position).map((team) => team.score_token),
  };
}

/**
 * Scores an opening Matchup's six Games as the Organizer (issue #624), red
 * side first in Round order, captains' game before teammates'. For specs that
 * need a played Matchup without typing 36 boxes.
 */
export async function scoreMatchup(
  seeded: SeededTeamEvent,
  matchupNumber: number,
  scores: [number, number][],
): Promise<void> {
  await playMatchup(seeded, { opening: matchupNumber }, scores);
}

/**
 * Plays one Matchup as the Organizer (issue #625): all six scores, red side
 * first in Round order, and optionally marks it done. An opening Matchup is
 * named by its number, a Flight by its letter. Marking the last opening
 * Matchup done places the Flights; the last Flight done ends the night.
 */
export async function playMatchup(
  seeded: SeededTeamEvent,
  which: { opening: number } | { flight: string },
  scores: [number, number][],
  options: { done?: boolean; dreambreakerWinner?: "red" | "blue" } = {},
): Promise<void> {
  const asOrganizer = await organizerHeaders(seeded.organizerEmail, seeded.organizerPassword);
  const event = await organizerEvent(asOrganizer, seeded);
  const matchup = event.matchups.find((candidate) =>
    "opening" in which
      ? candidate.stage === "opening" && candidate.number === which.opening
      : candidate.stage === "flight" && candidate.flightLetter === which.flight,
  );
  if (!matchup) throw new Error(`No such Matchup: ${JSON.stringify(which)}`);

  for (const [index, [red, blue]] of scores.entries()) {
    await rpc(
      asOrganizer,
      "team_tally_organizer_score_game",
      { p_game_id: matchup.games[index].id, p_red: red, p_blue: blue },
      "saving a score",
    );
  }

  if (options.dreambreakerWinner) {
    await rpc(
      asOrganizer,
      "team_tally_organizer_set_dreambreaker",
      {
        p_matchup_id: matchup.id,
        p_winner_team_id: options.dreambreakerWinner === "red" ? matchup.redTeamId : matchup.blueTeamId,
      },
      "recording the Dreambreaker",
    );
  }

  if (options.done) {
    await rpc(asOrganizer, "team_tally_organizer_mark_done", { p_matchup_id: matchup.id }, "marking the Matchup done");
  }
}

/** Deletes the Organizer, and with them their Team Events. */
export async function deleteTeamEventOrganizer(seeded: SeededTeamEvent): Promise<void> {
  await fetch(`${API_URL}/auth/v1/admin/users/${seeded.userId}`, {
    method: "DELETE",
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
}

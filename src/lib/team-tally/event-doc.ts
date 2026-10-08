/**
 * A running Team Event as the link reads return it (issue #623): the night,
 * its Teams with their Player slots, and every Matchup with its six Games.
 * One shape for all three readers, built by `team_tally_event_doc` in the
 * database: the Public Link, a Score Link and the Organizer.
 *
 * Plus the few things every screen derives from it: a Team's name, who plays
 * in each Game, and which Round is live. Relative imports only, for
 * `node --test`.
 */

export type Round = 1 | 2 | 3;
export type GameKind = "captains" | "teammates";
export type Side = "red" | "blue";

export type DocGame = {
  id: string;
  round: Round;
  kind: GameKind;
  redScore: number | null;
  blueScore: number | null;
  /** Who last saved the score: a Team by its Score Link, or the Organizer. */
  lastEditedByKind: "team" | "organizer" | null;
  lastEditedByTeamId: string | null;
};

export type DocMatchup = {
  id: string;
  stage: "opening" | "flight";
  number: number;
  flightLetter: string | null;
  courtPair: [string, string];
  redTeamId: string;
  blueTeamId: string;
  /** Round order, captains' game before teammates'. */
  games: DocGame[];
  /** When a captain (or the Organizer) marked it done; null while it is open. */
  doneAt: string | null;
  /** The Team whose captain marked it done; null when the Organizer did, or while open. */
  doneByTeamId: string | null;
  /** Who won the Dreambreaker a tied Matchup played. Decides the winner only on a tie. */
  dreambreakerWinnerId: string | null;
};

export type DocTeam = {
  id: string;
  nickname: string | null;
  homeCourt: string;
  captain: string;
  slotA: string;
  slotB: string;
  slotC: string;
};

export type TeamEventDoc = {
  id: string;
  name: string;
  date: string;
  status: "opening" | "flights" | "finished";
  /** In setup order. */
  teams: DocTeam[];
  /** Opening Matchups in MATCH order, then Flights. */
  matchups: DocMatchup[];
  /** When the Flights were placed; null until Seeding. */
  seededAt: string | null;
  /** Teams the Organizer has ordered for a tie on every count, first ahead. */
  tieOrder: string[];
};

/** "Team Ben Johns", as the Brief prints a Team. */
export function captainTeamName(team: Pick<DocTeam, "captain">): string {
  return `Team ${team.captain}`;
}

/** What the graphics call a Team: its nickname, or its captain's Team name. */
export function teamName(team: Pick<DocTeam, "captain" | "nickname">): string {
  return team.nickname?.trim() || captainTeamName(team);
}

/** "Match 1 · Courts 16 & 19". */
export function matchupLabel(matchup: Pick<DocMatchup, "stage" | "number" | "flightLetter" | "courtPair">): string {
  const name = matchup.stage === "flight" ? `Flight ${matchup.flightLetter}` : `Match ${matchup.number}`;
  return `${name} · Courts ${matchup.courtPair[0]} & ${matchup.courtPair[1]}`;
}

const SLOT_FOR_ROUND = { 1: "slotA", 2: "slotB", 3: "slotC" } as const;

/**
 * Who plays a Game for one Team. Round N's captains' game is the captain with
 * slot N; the other two slots play the teammates' game.
 */
export function playersIn(team: DocTeam, round: Round, kind: GameKind): string[] {
  if (kind === "captains") {
    return [team.captain, team[SLOT_FOR_ROUND[round]]];
  }
  return ([1, 2, 3] as const).filter((other) => other !== round).map((other) => team[SLOT_FOR_ROUND[other]]);
}

export function isScored(game: Pick<DocGame, "redScore" | "blueScore">): boolean {
  return game.redScore !== null && game.blueScore !== null;
}

/**
 * The Round being played: the first with a Game still unscored. Undefined once
 * all six Games have a score.
 */
export function liveRound(matchup: Pick<DocMatchup, "games">): Round | undefined {
  for (const round of [1, 2, 3] as const) {
    const roundGames = matchup.games.filter((game) => game.round === round);
    if (roundGames.length === 0 || roundGames.some((game) => !isScored(game))) {
      return round;
    }
  }
  return undefined;
}

/** A Team's side in a Matchup, or undefined when it doesn't play in it. */
export function sideOf(matchup: Pick<DocMatchup, "redTeamId" | "blueTeamId">, teamId: string): Side | undefined {
  if (matchup.redTeamId === teamId) return "red";
  if (matchup.blueTeamId === teamId) return "blue";
  return undefined;
}

/** The Rounds with a score in any Matchup this Team plays: their slots are pinned. */
export function scoredRoundsFor(event: Pick<TeamEventDoc, "matchups">, teamId: string): Round[] {
  const rounds = new Set<Round>();
  for (const matchup of event.matchups) {
    if (!sideOf(matchup, teamId)) continue;
    for (const game of matchup.games) {
      if (isScored(game)) rounds.add(game.round);
    }
  }
  return [...rounds].sort();
}

/** Points per Round for one side of a Matchup, null for a Round with nothing scored yet. */
export function roundPoints(matchup: Pick<DocMatchup, "games">, side: Side): [number | null, number | null, number | null] {
  return ([1, 2, 3] as const).map((round) => {
    const scored = matchup.games.filter((game) => game.round === round && isScored(game));
    if (scored.length === 0) return null;
    return scored.reduce((sum, game) => sum + ((side === "red" ? game.redScore : game.blueScore) ?? 0), 0);
  }) as [number | null, number | null, number | null];
}

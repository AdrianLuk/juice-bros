/**
 * The demo night (issue #631): a Tuesday team night in the real format
 * (team-tally/CONTEXT.md), already under way when the visitor opens it.
 *
 * 14 Teams, captain plus Players A, B and C, in seven opening Matchups on the
 * court pairs the organizer's own brief uses. Four Matchups are done, Match 6
 * is tied and waiting on its Dreambreaker, Match 7 is into Round 3, and Match
 * 1 is the visitor's: Round 1 scored, Round 2 waiting for them.
 *
 * Every name is a PPA Tour pro. Nobody local, nobody real at this club.
 * Authored as plain data so the same night comes back on every Reset.
 * Relative imports only, for `node --test`.
 */

import type { DocGame, DocMatchup, DocTeam, GameKind, Round, TeamEventDoc } from "../event-doc.ts";

export const DEMO_EVENT_ID = "demo-night";
export const DEMO_EVENT_NAME = "Tuesday Team Night";

export type DemoNight = {
  event: TeamEventDoc;
  /** The Team whose Score Link the visitor holds. */
  myTeamId: string;
};

/** Captain, then Players A, B and C, then a nickname if the Team has one. */
const ROSTERS: [string, string, string, string, string | null][] = [
  ["Ben Johns", "Anna Leigh Waters", "Collin Johns", "Anna Bright", "Golden Set"],
  ["Federico Staksrud", "Catherine Parenteau", "Andrei Daescu", "Jorja Johnson", null],
  ["Hayden Patriquin", "Tyra Black", "Gabriel Tardio", "Lea Jansen", "Kitchen Kings"],
  ["Christian Alshon", "Jessie Irvine", "JW Johnson", "Kaitlyn Christian", null],
  ["Tyson McGuffin", "Parris Todd", "Dylan Frazier", "Callie Smith", null],
  ["Jay Devilliers", "Rachel Rohrabacher", "Connor Garnett", "Vivienne David", "Third Shot Club"],
  ["Riley Newman", "Lucy Kovalova", "Matt Wright", "Salome Devidze", null],
  ["James Ignatowich", "Meghan Dizon", "Zane Navratil", "Jackie Kawamoto", null],
  ["Quang Duong", "Etta Wright", "Jack Sock", "Mary Brascia", "Net Results"],
  ["Thomas Wilson", "Jade Kawamoto", "Pablo Tellez", "Andrea Koop", null],
  ["Hunter Johnson", "Allyce Jones", "Augustus Ge", "Kate Fahey", null],
  ["Rafa Hewett", "Sofia Sewing", "Roscoe Bellamy", "Lauren Stratman", null],
  ["AJ Koller", "Genie Erokhina", "Jaume Martinez Vich", "Judit Castillo", null],
  ["Dekel Bar", "Brooke Buckner", "Will Howells", "Simone Jardim", null],
];

const COURT_PAIRS: [string, string][] = [
  ["16", "19"],
  ["17", "18"],
  ["20", "21"],
  ["22", "23"],
  ["24", "25"],
  ["26", "27"],
  ["28", "29"],
];

type Score = [number, number] | null;

/**
 * Each opening Matchup's six Games, Round order, captains' game first, and
 * who marked it done. Match 1 is yours.
 */
const OPENING: { scores: Score[]; doneBy: "red" | "blue" | null }[] = [
  { scores: [[11, 7], [9, 11], null, null, null, null], doneBy: null },
  { scores: [[11, 6], [11, 8], [9, 11], [11, 9], [11, 5], [8, 11]], doneBy: "red" }, // 61-50
  { scores: [[7, 11], [11, 9], [6, 11], [10, 12], [11, 8], [9, 11]], doneBy: "blue" }, // 54-62
  { scores: [[11, 4], [11, 7], [11, 9], [5, 11], [11, 3], [11, 6]], doneBy: "red" }, // 60-40
  { scores: [[9, 11], [11, 8], [11, 10], [8, 11], [11, 9], [7, 11]], doneBy: "blue" }, // 57-60
  { scores: [[11, 8], [8, 11], [11, 6], [6, 11], [11, 9], [9, 11]], doneBy: null }, // 56-56, Dreambreaker to play
  { scores: [[11, 9], [6, 11], [11, 7], [11, 10], [9, 11], null], doneBy: null },
];

const ROUND_GAMES: [Round, GameKind][] = [
  [1, "captains"],
  [1, "teammates"],
  [2, "captains"],
  [2, "teammates"],
  [3, "captains"],
  [3, "teammates"],
];

function teamId(index: number): string {
  return `demo-team-${index + 1}`;
}

/** The demo night as it stands when the visitor opens it. `date` is `YYYY-MM-DD`. */
export function demoNight(date: string): DemoNight {
  const teams: DocTeam[] = ROSTERS.map(([captain, slotA, slotB, slotC, nickname], index) => ({
    id: teamId(index),
    nickname,
    homeCourt: COURT_PAIRS[Math.floor(index / 2)][index % 2],
    captain,
    slotA,
    slotB,
    slotC,
  }));

  const matchups: DocMatchup[] = OPENING.map(({ scores, doneBy }, index) => {
    const id = `demo-match-${index + 1}`;
    const red = teamId(index * 2);
    const blue = teamId(index * 2 + 1);
    const games: DocGame[] = ROUND_GAMES.map(([round, kind], g) => {
      const score = scores[g];
      return {
        id: `${id}-r${round}-${kind}`,
        round,
        kind,
        redScore: score?.[0] ?? null,
        blueScore: score?.[1] ?? null,
        // The two captains took turns entering scores.
        lastEditedByKind: score ? "team" : null,
        lastEditedByTeamId: score ? (g % 2 === 0 ? red : blue) : null,
      };
    });
    return {
      id,
      stage: "opening",
      number: index + 1,
      flightLetter: null,
      courtPair: COURT_PAIRS[index],
      redTeamId: red,
      blueTeamId: blue,
      games,
      doneAt: doneBy ? `${date}T23:${String(20 + index * 3).padStart(2, "0")}:00.000Z` : null,
      doneByTeamId: doneBy === "red" ? red : doneBy === "blue" ? blue : null,
      dreambreakerWinnerId: null,
    };
  });

  return {
    event: {
      id: DEMO_EVENT_ID,
      name: DEMO_EVENT_NAME,
      date,
      status: "opening",
      teams,
      matchups,
      seededAt: null,
      tieOrder: [],
    },
    myTeamId: teamId(0),
  };
}

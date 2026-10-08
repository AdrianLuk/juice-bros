import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { generateBrief, type BriefMatchup, type BriefTeam } from "./brief.ts";

/**
 * The Brief is the Organizer's own group-chat message (issue #622), so it is
 * checked against hand-written goldens built from the layout in the issue, not
 * against anything the generator computes. Every name is a PPA Tour pro: this
 * repo is public, and the organizer's real briefs carry real players' names.
 */

const SITE = "https://juicebrospickleball.com/tools/team-tally";

function golden(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\n$/, "");
}

let tokenCounter = 0;
function team(
  captain: string,
  nickname: string | null,
  homeCourt: string,
  slotA: string,
  slotB: string,
  slotC: string,
): BriefTeam {
  tokenCounter += 1;
  return {
    captain,
    nickname,
    homeCourt,
    slotA,
    slotB,
    slotC,
    scoreLink: `${SITE}/score/team-${String(tokenCounter).padStart(2, "0")}`,
  };
}

function twelveTeamMatchups(): BriefMatchup[] {
  tokenCounter = 0;
  return [
    {
      red: team("Ben Johns", "Golden Set", "16", "Anna Leigh Waters", "Collin Johns", "Anna Bright"),
      blue: team("Federico Staksrud", "Third Shot Drop", "19", "Catherine Parenteau", "Andrei Daescu", "Jorja Johnson"),
    },
    {
      // No nickname: the line is just "Team <captain>", no quoted part.
      red: team("Hayden Patriquin", null, "17", "Tyra Black", "Gabriel Tardio", "Lea Jansen"),
      blue: team("Christian Alshon", "Kitchen Kings", "18", "Jessie Irvine", "JW Johnson", "Kaitlyn Christian"),
    },
    {
      red: team("Riley Newman", "Erne Gang", "20", "Parris Todd", "Tyson McGuffin", "Callie Smith"),
      blue: team("Jay Devilliers", "Dink Dynasty", "21", "Lucy Kovalova", "Dylan Frazier", "Vivienne David"),
    },
    {
      red: team("Connor Garnett", "Spin Doctors", "22", "Allyce Jones", "Hunter Johnson", "Jade Kawamoto"),
      blue: team("Pablo Tellez", "Lob City", "23", "Etta Wright", "Zane Navratil", "Mary Brascia"),
    },
    {
      red: team("Matt Wright", "Net Rushers", "24", "Rachel Rohrabacher", "James Ignatowich", "Sofia Sewing"),
      blue: team("Augustus Ge", "Paddle Up", "25", "Meghan Dizon", "Jaume Martinez Vich", "Kate Fahey"),
    },
    {
      red: team("Quang Duong", "Around the Post", "26", "Lacy Schneemann", "Thomas Wilson", "Jackie Kawamoto"),
      blue: team("Eric Oncins", "Speed Up", "27", "Genie Erokhina", "Jack Sock", "Judit Castillo"),
    },
  ];
}

test("a 12-Team event's Brief matches the Organizer's layout, with Flights A to F", () => {
  const brief = generateBrief({
    publicLink: `${SITE}/live/public-twelve`,
    matchups: twelveTeamMatchups(),
  });

  assert.equal(brief, golden("brief-12-teams.txt"));
});

test("a 14-Team event's Brief runs to Flight G", () => {
  const matchups = twelveTeamMatchups();
  matchups.push({
    red: team("Rob Nunnery", "Drop Zone", "28", "Alix Truong", "CJ Klinger", "Salome Devidze"),
    blue: team("Will Howells", null, "29", "Simone Jardim", "Dekel Bar", "Tyler Loong"),
  });

  const brief = generateBrief({
    publicLink: `${SITE}/live/public-fourteen`,
    matchups,
  });

  assert.equal(brief, golden("brief-14-teams.txt"));
});

test("a blank nickname prints like no nickname at all", () => {
  tokenCounter = 0;
  const brief = generateBrief({
    publicLink: `${SITE}/live/p`,
    matchups: [
      {
        red: team("Ben Johns", "   ", "1", "Anna Leigh Waters", "Collin Johns", "Anna Bright"),
        blue: team("Federico Staksrud", "", "2", "Catherine Parenteau", "Andrei Daescu", "Jorja Johnson"),
      },
      {
        red: team("Hayden Patriquin", null, "3", "Tyra Black", "Gabriel Tardio", "Lea Jansen"),
        blue: team("Christian Alshon", null, "4", "Jessie Irvine", "JW Johnson", "Kaitlyn Christian"),
      },
    ],
  });

  assert.match(brief, /^🔴 Team Ben Johns$/m);
  assert.match(brief, /^🔵 Team Federico Staksrud$/m);
  assert.doesNotMatch(brief, /“”/);
});

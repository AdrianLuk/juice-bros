import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { generateBrief, type BriefMatchup, type BriefTeam } from "./brief.ts";
import { parseBrief, type ParsedTeam } from "./parse-brief.ts";

/**
 * Pasting an old brief (issue #626). The fixtures are the Organizer's two
 * hand-written layouts with every name swapped for a PPA Tour pro: this repo
 * is public. Expected values are literals written out below, never computed.
 */

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")
    .replace(/\r\n/g, "\n");
}

type Expected = {
  captain: string;
  nickname: string;
  homeCourt: string;
  slots: [string, string, string];
};

/** Who is in each fixture's 7 Matchups, red then blue; the 6-Matchup ones stop at 12. */
const ROSTERS: Record<string, Pick<Expected, "captain" | "nickname" | "slots">> = {
  ben: { captain: "Ben", nickname: "Golden Set", slots: ["Anna Leigh Waters", "Collin Johns", "Anna Bright"] },
  federico: { captain: "Federico", nickname: "Third Shot Drop", slots: ["Catherine Parenteau", "Andrei Daescu", "Jorja Johnson"] },
  hayden: { captain: "Hayden", nickname: "", slots: ["Tyra Black", "Gabriel Tardio", "Lea Jansen"] },
  christian: { captain: "Christian", nickname: "Kitchen Kings", slots: ["Jessie Irvine", "JW Johnson", "Kaitlyn Christian"] },
  riley: { captain: "Riley", nickname: "Erne Gang", slots: ["Parris Todd", "Tyson McGuffin", "Callie Smith"] },
  jay: { captain: "Jay", nickname: "Dink Dynasty", slots: ["Lucy Kovalova", "Dylan Frazier", "Vivienne David"] },
  connor: { captain: "Connor", nickname: "Spin Doctors", slots: ["Allyce Jones", "Hunter Johnson", "Jade Kawamoto"] },
  pablo: { captain: "Pablo", nickname: "", slots: ["Etta Wright", "Zane Navratil", "Mary Brascia"] },
  matt: { captain: "Matt", nickname: "Net Rushers", slots: ["Rachel Rohrabacher", "James Ignatowich", "Sofia Sewing"] },
  augustus: { captain: "Augustus", nickname: "Paddle Up", slots: ["Meghan Dizon", "Jaume Martinez Vich", "Kate Fahey"] },
  quang: { captain: "Quang", nickname: "Around the Post", slots: ["Lacy Schneemann", "Thomas Wilson", "Jackie Kawamoto"] },
  eric: { captain: "Eric", nickname: "Speed Up", slots: ["Genie Erokhina", "Jack Sock", "Judit Castillo"] },
  rob: { captain: "Rob", nickname: "Drop Zone", slots: ["Alix Truong", "CJ Klinger", "Salome Devidze"] },
  will: { captain: "Will", nickname: "", slots: ["Simone Jardim", "Dekel Bar", "Tyler Loong"] },
};

/** [court pair, red, blue] per Matchup, in the newer layout fixtures. */
const NEWER: [[string, string], string, string][] = [
  [["16", "19"], "ben", "federico"],
  [["21", "18"], "hayden", "christian"],
  [["20", "23"], "riley", "jay"],
  [["25", "22"], "connor", "pablo"],
  [["24", "27"], "matt", "augustus"],
  [["29", "26"], "quang", "eric"],
  [["28", "31"], "rob", "will"],
];

/** The same Teams in the older layout fixtures, on their own courts. */
const OLDER: [[string, string], string, string][] = [
  [["10", "13"], "ben", "federico"],
  [["15", "12"], "hayden", "christian"],
  [["14", "17"], "riley", "jay"],
  [["19", "16"], "connor", "pablo"],
  [["18", "21"], "matt", "augustus"],
  [["23", "20"], "quang", "eric"],
  [["22", "25"], "rob", "will"],
];

function expectTeam(actual: ParsedTeam, who: string, homeCourt: string) {
  const roster = ROSTERS[who];
  assert.deepEqual(
    {
      captain: actual.captain,
      nickname: actual.nickname,
      homeCourt: actual.homeCourt,
      slots: [actual.slotA, actual.slotB, actual.slotC],
      flagged: actual.flagged,
    },
    { captain: roster.captain, nickname: roster.nickname, homeCourt, slots: roster.slots, flagged: [] },
    who,
  );
}

for (const [layout, expected, files] of [
  ["newer layout", NEWER, { 6: "old-brief-newer-6.txt", 7: "old-brief-newer-7.txt" }],
  ["older layout", OLDER, { 6: "old-brief-older-6.txt", 7: "old-brief-older-7.txt" }],
] as const) {
  for (const count of [6, 7] as const) {
    test(`${layout}, ${count} Matchups: Teams, nicknames, home courts and court pairs`, () => {
      const parsed = parseBrief(fixture(files[count]));

      assert.equal(parsed.matchups.length, count);
      expected.slice(0, count).forEach(([courts, red, blue], index) => {
        const matchup = parsed.matchups[index];
        assert.deepEqual(matchup.courts, courts, `Match ${index + 1} courts`);
        expectTeam(matchup.red, red, courts[0]);
        expectTeam(matchup.blue, blue, courts[1]);
      });
    });
  }
}

test("a Team with no nickname reads an empty nickname, not a flag", () => {
  const parsed = parseBrief(fixture("old-brief-newer-6.txt"));
  assert.equal(parsed.matchups[1].red.captain, "Hayden");
  assert.equal(parsed.matchups[1].red.nickname, "");
  assert.deepEqual(parsed.matchups[1].red.flagged, []);
});

test("text with no Matchups in it reads as no Matchups", () => {
  assert.deepEqual(parseBrief("hello\n\nsee you Tuesday").matchups, []);
  assert.deepEqual(parseBrief("").matchups, []);
});

test("Windows line endings and stray spaces read the same", () => {
  const text = [
    "🏓 MATCH 1 — Courts 3 & 4   ",
    "  🔴 Team Ben — “Golden Set”  ",
    "Court 3",
    "Ben • Anna Leigh • Collin • Anna Bright   ",
    "🆚",
    "🔵 Team Federico",
    "Court 4",
    "Federico • Catherine • Andrei • Jorja",
  ].join("\r\n");

  const [matchup] = parseBrief(text).matchups;
  assert.equal(matchup.red.nickname, "Golden Set");
  assert.deepEqual([matchup.red.slotA, matchup.red.slotB, matchup.red.slotC], ["Anna Leigh", "Collin", "Anna Bright"]);
  assert.equal(matchup.blue.slotC, "Jorja");
  assert.deepEqual(matchup.blue.flagged, []);
});

test("ordinary quotes around a nickname read like curly ones", () => {
  const text = [
    "🏓 MATCH 1 — Courts 3 & 4",
    '🔴 Team Ben — "Golden Set"',
    "Court 3",
    "Ben • A • B • C",
    "🔵 Team Hayden",
    "Court 4",
    "Hayden • D • E • F",
  ].join("\n");

  assert.equal(parseBrief(text).matchups[0].red.nickname, "Golden Set");
});

test("a Team with no Court line takes its home court from the Matchup's pair", () => {
  const text = [
    "🏓 MATCH 1 — Courts 3 & 4",
    "🔴 Team Ben",
    "Ben • A • B • C",
    "🔵 Team Hayden",
    "Hayden • D • E • F",
  ].join("\n");

  const [matchup] = parseBrief(text).matchups;
  assert.equal(matchup.red.homeCourt, "3");
  assert.equal(matchup.blue.homeCourt, "4");
  assert.deepEqual(matchup.red.flagged, []);
});

test("a Team's own court wins over the Matchup's pair", () => {
  const text = [
    "🏓 MATCH 1 — Courts 3 & 4",
    "🔴 Team Ben — Court 9",
    "Ben • A • B • C",
    "🔵 Team Hayden — Court 4",
    "Hayden • D • E • F",
  ].join("\n");

  assert.equal(parseBrief(text).matchups[0].red.homeCourt, "9");
});

test("a roster that is one name short fills what it has and flags the rest", () => {
  const text = [
    "🏓 MATCH 1 — Courts 3 & 4",
    "🔴 Team Ben — Court 3",
    "Ben • Anna Leigh • Collin",
    "🔵 Team Hayden — Court 4",
    "Hayden • D • E • F",
  ].join("\n");

  const red = parseBrief(text).matchups[0].red;
  assert.deepEqual([red.captain, red.slotA, red.slotB, red.slotC], ["Ben", "Anna Leigh", "Collin", ""]);
  assert.deepEqual(red.flagged, ["slotC"]);
});

test("a roster with an empty slot flags that slot", () => {
  const text = [
    "🏓 MATCH 1 — Courts 3 & 4",
    "🔴 Team Ben — Court 3",
    "Ben •  • Collin • Anna Bright",
    "🔵 Team Hayden — Court 4",
    "Hayden • D • E • F",
  ].join("\n");

  const red = parseBrief(text).matchups[0].red;
  assert.equal(red.slotA, "");
  assert.deepEqual(red.flagged, ["slotA"]);
});

test("a roster with too many names keeps the first four and flags all four to check", () => {
  const text = [
    "🏓 MATCH 1 — Courts 3 & 4",
    "🔴 Team Ben — Court 3",
    "Ben • A • B • C • D",
    "🔵 Team Hayden — Court 4",
    "Hayden • D • E • F",
  ].join("\n");

  const red = parseBrief(text).matchups[0].red;
  assert.deepEqual([red.captain, red.slotA, red.slotB, red.slotC], ["Ben", "A", "B", "C"]);
  assert.deepEqual(red.flagged, ["captain", "slotA", "slotB", "slotC"]);
});

test("a Team with no roster line takes its captain from the Team line and flags the slots", () => {
  const text = [
    "🏓 MATCH 1 — Courts 3 & 4",
    "🔴 Team Ben — Court 3",
    "🆚",
    "🔵 Team Hayden — Court 4",
    "Hayden • D • E • F",
  ].join("\n");

  const red = parseBrief(text).matchups[0].red;
  assert.equal(red.captain, "Ben");
  assert.deepEqual(red.flagged, ["slotA", "slotB", "slotC"]);
  assert.deepEqual(parseBrief(text).matchups[0].blue.flagged, []);
});

test("a Team line that never closes its quote keeps the text and flags the nickname", () => {
  const text = [
    "🏓 MATCH 1 — Courts 3 & 4",
    "🔴 Team Ben — “Golden Set",
    "Court 3",
    "Ben • A • B • C",
    "🔵 Team Hayden",
    "Court 4",
    "Hayden • D • E • F",
  ].join("\n");

  const red = parseBrief(text).matchups[0].red;
  assert.equal(red.captain, "Ben");
  assert.equal(red.nickname, "Golden Set");
  assert.deepEqual(red.flagged, ["nickname"]);
});

test("a Team line with no name flags the captain, and the roster still fills it", () => {
  const text = [
    "🏓 MATCH 1 — Courts 3 & 4",
    "🔴 Team — Court 3",
    "Ben • A • B • C",
    "🔵 Team Hayden — Court 4",
    "Hayden • D • E • F",
  ].join("\n");

  const red = parseBrief(text).matchups[0].red;
  assert.equal(red.captain, "Ben");
  assert.deepEqual(red.flagged, []);
});

test("no name on the line and no roster flags the captain", () => {
  const text = [
    "🏓 MATCH 1 — Courts 3 & 4",
    "🔴 Team — Court 3",
    "🔵 Team Hayden — Court 4",
    "Hayden • D • E • F",
  ].join("\n");

  assert.deepEqual(parseBrief(text).matchups[0].red.flagged, ["captain", "slotA", "slotB", "slotC"]);
});

test("a Matchup missing its second Team still comes back, the Team blank and flagged", () => {
  const text = [
    "🏓 MATCH 1 — Courts 3 & 4",
    "🔴 Team Ben — Court 3",
    "Ben • A • B • C",
    "",
    "🏓 MATCH 2 — Courts 5 & 6",
    "🔴 Team Hayden — Court 5",
    "Hayden • D • E • F",
    "🔵 Team Riley — Court 6",
    "Riley • G • H • I",
  ].join("\n");

  const { matchups } = parseBrief(text);
  assert.equal(matchups.length, 2);
  assert.equal(matchups[0].blue.captain, "");
  assert.equal(matchups[0].blue.homeCourt, "4");
  assert.deepEqual(matchups[0].blue.flagged, ["captain", "slotA", "slotB", "slotC"]);
  assert.equal(matchups[1].blue.captain, "Riley");
});

test("a line with a team marker but no 'Team' word is still a Team line", () => {
  const text = [
    "🏓 MATCH 1 — Courts 3 & 4",
    "🔴 Ben — Court 3",
    "Ben • A • B • C",
    "🔵 Hayden — Court 4",
    "Hayden • D • E • F",
  ].join("\n");

  const { red, blue } = parseBrief(text).matchups[0];
  assert.equal(red.captain, "Ben");
  assert.equal(blue.captain, "Hayden");
});

test("a Matchup header with no courts leaves the pair null and the home courts to flag", () => {
  const text = [
    "🏓 MATCH 1",
    "🔴 Team Ben",
    "Ben • A • B • C",
    "🔵 Team Hayden — Court 4",
    "Hayden • D • E • F",
  ].join("\n");

  const [matchup] = parseBrief(text).matchups;
  assert.equal(matchup.courts, null);
  assert.deepEqual(matchup.red.flagged, ["homeCourt"]);
  assert.equal(matchup.blue.homeCourt, "4");
});

// The generator from #622 writes the brief; reading it back has to give the
// same Teams and Matchups, including the Score Link lines it adds.
function team(captain: string, nickname: string | null, homeCourt: string, slots: [string, string, string]): BriefTeam {
  return {
    captain,
    nickname,
    homeCourt,
    slotA: slots[0],
    slotB: slots[1],
    slotC: slots[2],
    scoreLink: `https://example.com/score/${homeCourt}`,
  };
}

test("parse(generate(event)) gives back the same Teams and Matchups", () => {
  const matchups: BriefMatchup[] = [
    {
      red: team("Ben Johns", "Golden Set", "16", ["Anna Leigh Waters", "Collin Johns", "Anna Bright"]),
      blue: team("Federico Staksrud", null, "19", ["Catherine Parenteau", "Andrei Daescu", "Jorja Johnson"]),
    },
    {
      red: team("Hayden Patriquin", "Kitchen Kings", "17", ["Tyra Black", "Gabriel Tardio", "Lea Jansen"]),
      blue: team("Christian Alshon", "Erne Gang", "18", ["Jessie Irvine", "JW Johnson", "Kaitlyn Christian"]),
    },
    {
      red: team("Riley Newman", null, "20", ["Parris Todd", "Tyson McGuffin", "Callie Smith"]),
      blue: team("Jay Devilliers", "Dink Dynasty", "21", ["Lucy Kovalova", "Dylan Frazier", "Vivienne David"]),
    },
  ];

  const parsed = parseBrief(generateBrief({ matchups, publicLink: "https://example.com/live/abc" }));

  assert.deepEqual(
    parsed.matchups.map(({ courts, red, blue }) => ({
      courts,
      red: strip(red),
      blue: strip(blue),
    })),
    matchups.map(({ red, blue }) => ({
      courts: [red.homeCourt, blue.homeCourt],
      red: expectedFromBrief(red),
      blue: expectedFromBrief(blue),
    })),
  );
});

function strip(parsed: ParsedTeam) {
  const { flagged, ...fields } = parsed;
  assert.deepEqual(flagged, []);
  return fields;
}

function expectedFromBrief(source: BriefTeam) {
  return {
    captain: source.captain,
    slotA: source.slotA,
    slotB: source.slotB,
    slotC: source.slotC,
    nickname: source.nickname ?? "",
    homeCourt: source.homeCourt,
  };
}

test("the real generated 14-Team Brief fixture reads back to 7 Matchups", () => {
  const parsed = parseBrief(fixture("brief-14-teams.txt"));
  assert.equal(parsed.matchups.length, 7);
  assert.equal(parsed.matchups[6].blue.captain, "Will Howells");
  assert.equal(parsed.matchups[6].blue.nickname, "");
  assert.equal(parsed.matchups[0].red.nickname, "Golden Set");
});

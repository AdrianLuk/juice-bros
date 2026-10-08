import assert from "node:assert/strict";
import { test } from "node:test";

import { scoredRoundsFor, type DocMatchup } from "./event-doc.ts";
import { checkRosterChange } from "./roster.ts";

test("a Team's scored Rounds count every Matchup it plays, and only those", () => {
  const game = (round: 1 | 2 | 3, score: number | null) => ({
    id: `g${round}${score}`,
    round,
    kind: "captains" as const,
    redScore: score,
    blueScore: score,
    lastEditedByKind: null,
    lastEditedByTeamId: null,
  });
  const matchup = (id: string, red: string, blue: string, games: ReturnType<typeof game>[]): DocMatchup => ({
    id, stage: "opening", number: 1, flightLetter: null, courtPair: ["1", "2"], redTeamId: red, blueTeamId: blue, games,
  });

  const event = {
    matchups: [
      matchup("m1", "ben", "fed", [game(1, 11), game(2, null), game(3, 4)]),
      matchup("m2", "hay", "chr", [game(2, 11)]),
    ],
  };
  assert.deepEqual(scoredRoundsFor(event, "fed"), [1, 3]);
  assert.deepEqual(scoredRoundsFor(event, "chr"), [2]);
});

const ROSTER = { slotA: "Anna Leigh Waters", slotB: "Collin Johns", slotC: "Anna Bright" };

test("with nothing scored, any rename or reorder saves", () => {
  assert.deepEqual(
    checkRosterChange(ROSTER, { slotA: "Anna Bright", slotB: "Tyra Black", slotC: "Anna Leigh Waters" }, []),
    { ok: true },
  );
});

test("a reorder that only moves Rounds with no score saves", () => {
  // Round 1 is scored, so Player A stays; B and C swap.
  assert.deepEqual(
    checkRosterChange(ROSTER, { slotA: "Anna Leigh Waters", slotB: "Anna Bright", slotC: "Collin Johns" }, [1]),
    { ok: true },
  );
});

test("a rename of a slot whose Round has a score is refused, naming the Round", () => {
  assert.deepEqual(
    checkRosterChange(ROSTER, { slotA: "Tyra Black", slotB: "Collin Johns", slotC: "Anna Bright" }, [1]),
    { ok: false, problem: "Round 1 already has a score, so Player A stays Anna Leigh Waters." },
  );
});

test("a reorder that moves a scored Round is refused", () => {
  const result = checkRosterChange(
    ROSTER,
    { slotA: "Anna Leigh Waters", slotB: "Anna Bright", slotC: "Collin Johns" },
    [1, 2],
  );
  assert.deepEqual(result, {
    ok: false,
    problem: "Round 2 already has a score, so Player B stays Collin Johns.",
  });
});

test("every slot needs a name, and surrounding spaces don't count as a change", () => {
  assert.equal(checkRosterChange(ROSTER, { ...ROSTER, slotC: "  " }, []).ok, false);
  assert.deepEqual(checkRosterChange(ROSTER, { ...ROSTER, slotA: " Anna Leigh Waters " }, [1, 2, 3]), { ok: true });
});

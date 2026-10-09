import assert from "node:assert/strict";
import test from "node:test";

import { decodeShareLink } from "./persistence/share-link.ts";
import {
  chooseCourts,
  chooseMixed,
  choosePools,
  chooseRounds,
  derive,
  editRoster,
  EMPTY,
  generate,
  restore,
  saveFor,
  type EditorState,
} from "./board-editor.ts";

/** The roster box typed out, then the two numbers set by hand. */
function typed(text: string, courts: number, rounds: number): EditorState {
  return chooseRounds(chooseCourts(editRoster(EMPTY, text), courts), rounds);
}

const FOUR = [
  "Ben Johns",
  "Anna Leigh Waters",
  "Federico Staksrud",
  "Catherine Parenteau",
];
const EIGHT = [...FOUR, "JW Johnson", "Anna Bright", "Gabriel Tardio", "Jorja Johnson"];

/**
 * The draw key, pinned.
 *
 * It is half of a stored Selection's board identity (`boardIdentity` in
 * `selection-storage.ts`), so a key that changes shape silently drops every
 * Selection already sitting in somebody's browser. These strings were taken
 * off the function as it stood inside `match-mixer.tsx` before it moved here,
 * and typed in. If one of them fails, the fix is to put the key back, not to
 * update the string.
 */
test("the draw key of a plain board has not moved", () => {
  const state = typed(FOUR.join("\n"), 1, 3);
  assert.equal(
    derive(state).key,
    "rotating/1/3/Ben Johns\nAnna Leigh Waters\nFederico Staksrud\nCatherine Parenteau",
  );
});

test("the draw key of a mixed board has not moved", () => {
  const text = ["Ben Johns M", "Anna Leigh Waters F", "JW Johnson M", "Anna Bright F"].join("\n");
  const state = chooseMixed(typed(text, 1, 3), true);
  assert.equal(
    derive(state).key,
    "rotating+mixed/1/3/Ben Johns M\nAnna Leigh Waters F\nJW Johnson M\nAnna Bright F",
  );
});

test("the draw key of a dealt two-pool board has not moved", () => {
  const state = choosePools(typed(EIGHT.join("\n"), 2, 4), 2);
  assert.equal(
    derive(state).key,
    "rotating+2pools/2/4/Ben Johns\nAnna Leigh Waters\nFederico Staksrud\nCatherine Parenteau\nJW Johnson\nAnna Bright\nGabriel Tardio\nJorja Johnson",
  );
});

test("the draw key of a declared split has not moved", () => {
  const text = ["---", ...FOUR, "--- 4.0", ...EIGHT.slice(4)].join("\n");
  const state = typed(text, 2, 4);
  assert.equal(
    derive(state).key,
    "rotating+2pools+declared:@0,4.0@4/2/4/Ben Johns\nAnna Leigh Waters\nFederico Staksrud\nCatherine Parenteau\nJW Johnson\nAnna Bright\nGabriel Tardio\nJorja Johnson",
  );
});

/**
 * A link minted for eight players on two courts, the same payload
 * `unchanged-boards.test.ts` pins: what the address bar hands the editor.
 */
function opened(): EditorState {
  const names = Array.from({ length: 8 }, (_, i) => `Player ${i + 1}`).join("\n");
  const shared = decodeShareLink(`1.2.7.3.1vpp81p.r\n${names}`);
  assert.ok(shared, "the link no longer opens");
  return restore(EMPTY, { from: "link", board: shared });
}

test("a borrowed board is never saved until it changes", () => {
  const borrowed = opened();
  assert.ok(borrowed.draw, "the link draws its board");
  assert.equal(saveFor(borrowed), null);
  // Choosing what is already chosen is not a change.
  assert.equal(saveFor(chooseCourts(borrowed, 2)), null);

  const claimed = editRoster(borrowed, `${borrowed.text}\nPlayer 9`);
  assert.equal(claimed.borrowed, null);
  assert.equal(saveFor(claimed)?.edited.roster.length, 9);
});

test("a claimed board stays claimed when the edit is typed back out", () => {
  const borrowed = opened();
  const claimed = editRoster(editRoster(borrowed, `${borrowed.text}\nPlayer 9`), borrowed.text);
  assert.equal(claimed.text, borrowed.text);
  assert.equal(saveFor(claimed)?.edited.roster.length, 8);
});

test("a redraw claims a borrowed board, and saves the board it drew", () => {
  const redrawn = generate(opened(), 42);
  assert.equal(redrawn.draw?.config.seed, 42);
  assert.equal(saveFor(redrawn)?.drawn?.seed, 42);
});

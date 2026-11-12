import assert from "node:assert/strict";
import test from "node:test";

import { bookedNumbers, PRESETS } from "../../../../lib/court-grid/grid.ts";
import { courtLabel } from "./court-labels.ts";
import { decodeShareLink } from "./persistence/share-link.ts";
import {
  chooseCourtLabels,
  chooseCourts,
  chooseFormat,
  chooseMixed,
  clearRoster,
  restoreRoster,
  choosePools,
  chooseRounds,
  derive,
  editRoster,
  EMPTY,
  generate,
  keepSplit,
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

/**
 * The same string off the other road. What a stored Selection is filed under
 * is the key on the drawn board, which `generate` builds from the Config it
 * draws rather than from `derive`; the two agreeing is what keeps a board
 * from reading stale the moment it is drawn, and the drawn one is the one
 * `boardIdentity` stores.
 */
test("the draw key a generated board carries has not moved", () => {
  const state = generate(typed(FOUR.join("\n"), 1, 3), 7);
  assert.equal(
    state.draw?.key,
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

/** A tab that came back to a saved visit of eight names and no board. */
function returned(): EditorState {
  const kept = typed(EIGHT.join("\n"), 2, 4);
  return restore(EMPTY, {
    from: "visit",
    visit: { schema: 1, savedAt: 0, drawn: null, edited: saveForced(kept) },
  });
}

/** The Config a state would save, gates aside, for building a saved visit. */
function saveForced(state: EditorState) {
  const save = saveFor({ ...state, restored: true, held: true });
  assert.ok(save);
  return save.edited;
}

test("a pending Clear undo blocks the save", () => {
  const back = returned();
  assert.equal(saveFor(back)?.edited.roster.length, 8);

  const emptied = clearRoster(back);
  assert.equal(emptied.text, "");
  assert.equal(saveFor(emptied), null);

  // Put back, it saves again, as the same Players.
  const undone = restoreRoster(emptied);
  assert.deepEqual(saveFor(undone)?.edited.roster, back.roster);
});

test("typing after a Clear gives up the undo, and the empty box is saved", () => {
  const typedOver = editRoster(clearRoster(returned()), "");
  assert.equal(typedOver.cleared, null);
  assert.deepEqual(saveFor(typedOver)?.edited.roster, []);
});

test("an empty tab that never held a Roster writes nothing", () => {
  assert.equal(saveFor(EMPTY), null);
  const empty = restore(EMPTY, { from: "visit", visit: null });
  assert.equal(saveFor(empty), null);
  assert.equal(saveFor(chooseCourts(choosePools(empty, 2), 3)), null);
  // Its first name is what makes it a tab with something to say.
  assert.equal(saveFor(editRoster(empty, "Ben Johns"))?.edited.roster.length, 1);
});

test("leaving rotating turns mixed off, and coming back leaves it off", () => {
  const text = ["Ben Johns M", "Anna Leigh Waters F", "JW Johnson M", "Anna Bright F"].join("\n");
  const mixed = chooseMixed(editRoster(EMPTY, text), true);
  assert.equal(mixed.roster[0].name, "Ben Johns");
  assert.equal(derive(mixed).mixing, true);

  const fixed = chooseFormat(mixed, "fixed");
  assert.equal(fixed.mixed, false);
  // The same lines read back as names, last initial and all.
  assert.equal(fixed.roster[0].name, "Ben Johns M");

  const back = chooseFormat(fixed, "rotating");
  assert.equal(back.mixed, false);
  assert.equal(derive(back).mixing, false);
});

test("Keep this split gives the same board with the same Seed", () => {
  const dealt = generate(choosePools(typed(EIGHT.join("\n"), 2, 4), 2), 7);
  assert.equal(dealt.draw?.pools.length, 2);
  assert.equal(derive(dealt).declared, null);

  const kept = keepSplit(dealt);
  assert.equal(kept.draw?.config.seed, 7);
  assert.match(kept.text, /^---$/m);
  assert.notEqual(derive(kept).declared, null);
  assert.equal(derive(kept).stale, false);
  // Down to the seat every name sat in.
  assert.deepEqual(
    kept.draw?.pools.map((pool) => [pool.roster.map((p) => p.name), pool.schedule]),
    dealt.draw?.pools.map((pool) => [pool.roster.map((p) => p.name), pool.schedule]),
  );
});

test("Keep this split does nothing over a stale board", () => {
  const dealt = generate(choosePools(typed(EIGHT.join("\n"), 2, 4), 2), 7);
  const edited = chooseRounds(dealt, 5);
  assert.equal(derive(edited).stale, true);
  assert.equal(keepSplit(edited), edited);
});

test("a saved visit comes back as the board it saved, current and its own", () => {
  const fresh = restore(EMPTY, { from: "visit", visit: null });
  const board = generate(editRoster(fresh, EIGHT.join("\n")), 11);
  const save = saveFor(board);
  assert.ok(save?.drawn);

  const back = restore(EMPTY, {
    from: "visit",
    visit: { schema: 1, savedAt: 0, edited: save.edited, drawn: save.drawn },
  });
  assert.equal(back.borrowed, null);
  assert.equal(back.draw?.key, board.draw?.key);
  assert.equal(derive(back).stale, false);
  assert.deepEqual(saveFor(back), save);
});

test("a redraw claims a borrowed board, and saves the board it drew", () => {
  const redrawn = generate(opened(), 42);
  assert.equal(redrawn.draw?.config.seed, 42);
  assert.equal(saveFor(redrawn)?.drawn?.seed, 42);
});

/** Court labels (#697): tonight's courts, by the numbers the facility prints. */

function fresh(text: string): EditorState {
  return editRoster(restore(EMPTY, { from: "visit", visit: null }), text);
}

test("tonight's courts set the court count and label the board drawn next", () => {
  const state = generate(chooseCourtLabels(fresh(EIGHT.join("\n")), [14, 17]), 5);
  assert.equal(derive(state).courts, 2);
  assert.deepEqual(state.draw?.config.courtLabels, [14, 17]);
});

const TWENTY = Array.from({ length: 20 }, (_, i) => `Player ${i + 1}`).join("\n");

test("a plus-shaped booking from a 4 x 3 hall gives a 5-court board named by it", () => {
  // Courts 1 to 12 in a 4 x 3 hall; tonight is the plus around court 6.
  const tonight = bookedNumbers(
    PRESETS.find((preset) => preset.id === "hall-4x3")!.grid(),
    new Set([2, 5, 6, 7, 10]),
  );
  const state = generate(chooseCourtLabels(fresh(TWENTY), tonight), 5);
  assert.equal(derive(state).courts, 5);
  const courts = new Set(
    state.draw!.pools.flatMap((pool) =>
      pool.schedule.rounds.flatMap((round) => round.games.map((game) => game.court)),
    ),
  );
  assert.deepEqual(
    [...courts].sort((a, b) => a - b).map((court) => courtLabel(court, state.draw!.config.courtLabels)),
    ["2", "5", "6", "7", "10"],
  );
});

test("on a pooled board each Game carries the label of its real court", () => {
  const state = generate(chooseCourtLabels(choosePools(fresh(TWENTY), 2), [3, 4, 7, 8]), 5);
  const [first, second] = state.draw!.pools;
  const labelsOf = (pool: typeof first) =>
    new Set(
      pool.schedule.rounds.flatMap((round) =>
        round.games.map((game) => courtLabel(game.court, state.draw!.config.courtLabels)),
      ),
    );
  assert.deepEqual([...labelsOf(first)].sort(), ["3", "4"]);
  assert.deepEqual([...labelsOf(second)].sort(), ["7", "8"]);
});

test("relabelling a drawn board keeps every seat and needs no redraw", () => {
  const drawn = generate(chooseCourts(fresh(EIGHT.join("\n")), 2), 5);
  const relabelled = chooseCourtLabels(drawn, [3, 9]);
  assert.equal(derive(relabelled).stale, false);
  assert.deepEqual(relabelled.draw?.pools, drawn.draw?.pools);
  assert.deepEqual(relabelled.draw?.config.courtLabels, [3, 9]);
});

test("labels never move the draw key, so a stored Selection still finds its board", () => {
  const plain = generate(chooseCourts(fresh(EIGHT.join("\n")), 2), 5);
  assert.equal(chooseCourtLabels(plain, [3, 9]).draw?.key, plain.draw?.key);
});

test("setting a different court count by hand drops the labels", () => {
  const labelled = generate(chooseCourtLabels(fresh(EIGHT.join("\n")), [14, 17]), 5);
  const one = chooseCourts(labelled, 1);
  assert.equal(one.courtLabels, null);
  assert.equal(generate(one, 5).draw?.config.courtLabels, undefined);
  assert.deepEqual(chooseCourts(labelled, 2).courtLabels, [14, 17]);
});

test("clearing the labels goes back to courts 1 to N and keeps the count", () => {
  const labelled = generate(chooseCourtLabels(fresh(EIGHT.join("\n")), [14, 17]), 5);
  const cleared = chooseCourtLabels(labelled, null);
  assert.equal(derive(cleared).courts, 2);
  assert.equal(cleared.draw?.config.courtLabels, undefined);
});

test("labels are saved with the board and come back with it", () => {
  const labelled = generate(chooseCourtLabels(fresh(EIGHT.join("\n")), [14, 17]), 5);
  const save = saveFor(labelled);
  assert.deepEqual(save?.edited.courtLabels, [14, 17]);
  const back = restore(EMPTY, {
    from: "visit",
    visit: { schema: 2, savedAt: 0, edited: save!.edited, drawn: save!.drawn },
  });
  assert.deepEqual(back.courtLabels, [14, 17]);
  assert.deepEqual(back.draw?.config.courtLabels, [14, 17]);
});

test("a labelled link opens labelled, and relabelling it claims it", () => {
  const names = Array.from({ length: 8 }, (_, i) => `Player ${i + 1}`).join("\n");
  const shared = decodeShareLink(`1.2.7.3.1vpp81p.r...14-17\n${names}`);
  assert.ok(shared, "the labelled link no longer opens");
  const borrowed = restore(EMPTY, { from: "link", board: shared });
  assert.deepEqual(borrowed.courtLabels, [14, 17]);
  assert.equal(saveFor(borrowed), null);
  assert.notEqual(saveFor(chooseCourtLabels(borrowed, [1, 2])), null);
});

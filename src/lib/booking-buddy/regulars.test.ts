import assert from "node:assert/strict";
import test from "node:test";

import {
  diffRegulars,
  groupRegularsByGame,
  parseRegularIds,
  regularsCountLabel,
  withGroupMembers,
} from "./regulars.ts";
import { isUuid } from "./uuid.ts";

const BEN = "bbbbbbbb-0000-4000-8000-000000000001";
const CAL = "cccccccc-0000-4000-8000-000000000002";
const DEE = "dddddddd-0000-4000-8000-000000000003";

function form(ids: string[]): FormData {
  const formData = new FormData();
  for (const id of ids) {
    formData.append("regular_ids", id);
  }
  return formData;
}

test("parseRegularIds reads every ticked Regular once", () => {
  assert.deepEqual(parseRegularIds(form([BEN, CAL, BEN])), [BEN, CAL]);
});

test("parseRegularIds with nothing ticked is an empty list", () => {
  assert.deepEqual(parseRegularIds(new FormData()), []);
});

test("parseRegularIds drops anything that isn't a user id", () => {
  assert.deepEqual(parseRegularIds(form(["", "not-an-id", ` ${DEE} `])), [DEE]);
});

test("diffRegulars adds the newly ticked and removes the unticked, leaving the rest", () => {
  assert.deepEqual(diffRegulars([BEN, CAL], [CAL, DEE]), { add: [DEE], remove: [BEN] });
});

test("diffRegulars on an unchanged list does nothing", () => {
  assert.deepEqual(diffRegulars([BEN, CAL], [CAL, BEN]), { add: [], remove: [] });
});

test("a Friend Group fills the list with its members, keeping who was already there", () => {
  assert.deepEqual(withGroupMembers([BEN], [CAL, BEN, DEE]), [BEN, CAL, DEE]);
});

test("groupRegularsByGame lists each Standing Game's Regulars in row order", () => {
  const grouped = groupRegularsByGame([
    { standing_game_id: "sg-1", user_id: BEN },
    { standing_game_id: "sg-2", user_id: CAL },
    { standing_game_id: "sg-1", user_id: DEE },
  ]);

  assert.deepEqual(grouped.get("sg-1"), [BEN, DEE]);
  assert.deepEqual(grouped.get("sg-2"), [CAL]);
  assert.equal(grouped.get("sg-3"), undefined);
});

test("regularsCountLabel says regular or regulars", () => {
  assert.equal(regularsCountLabel(0), "0 regulars");
  assert.equal(regularsCountLabel(1), "1 regular");
  assert.equal(regularsCountLabel(2), "2 regulars");
});

test("isUuid accepts a user id or token and nothing else", () => {
  assert.equal(isUuid(BEN), true);
  assert.equal(isUuid(BEN.toUpperCase()), true);
  assert.equal(isUuid("not-a-uuid"), false);
  assert.equal(isUuid(`${BEN}x`), false);
  assert.equal(isUuid(""), false);
});

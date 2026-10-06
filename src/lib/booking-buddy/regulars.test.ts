import assert from "node:assert/strict";
import test from "node:test";

import { diffRegulars, parseRegularIds, withGroupMembers } from "./regulars.ts";

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

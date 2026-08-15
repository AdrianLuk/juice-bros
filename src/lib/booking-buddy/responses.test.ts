import assert from "node:assert/strict";
import test from "node:test";

import { isResponseAnswer, parseAnswer, responseWriteMessage } from "./responses.ts";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }
  return data;
}

test("a slot id and a valid answer are accepted", () => {
  for (const answer of ["yes", "no", "maybe"]) {
    assert.deepEqual(parseAnswer(form({ slot_id: "slot-1", answer })), {
      slotId: "slot-1",
      answer,
    });
  }
});

test("a missing slot id is refused", () => {
  assert.ok("error" in parseAnswer(form({ answer: "yes" })));
});

test("a missing or unknown answer is refused rather than defaulted", () => {
  // Defaulting to "no" would record a Response the User never gave.
  assert.ok("error" in parseAnswer(form({ slot_id: "slot-1" })));
  assert.ok("error" in parseAnswer(form({ slot_id: "slot-1", answer: "maybe not" })));
});

test("isResponseAnswer rejects anything outside the three answers", () => {
  assert.equal(isResponseAnswer("yes"), true);
  assert.equal(isResponseAnswer("nope"), false);
  assert.equal(isResponseAnswer(null), false);
});

test("a real error reads as a generic write failure", () => {
  assert.match(responseWriteMessage({ code: "08006" }), /try again/i);
});

test("no error but zero rows reads as a permission failure", () => {
  assert.match(responseWriteMessage(null), /permission/i);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { settleWrite, UNANSWERED } from "./settle-write.ts";

test("a write that answers passes through, refusals included", async () => {
  assert.deepEqual(await settleWrite(Promise.resolve({ ok: true })), { ok: true });
  assert.deepEqual(await settleWrite(Promise.resolve({ ok: false, problem: "No." })), { ok: false, problem: "No." });
});

test("a write that throws becomes a refusal saying to reload", async () => {
  assert.deepEqual(await settleWrite(Promise.reject(new TypeError("Failed to fetch"))), {
    ok: false,
    problem: UNANSWERED,
  });
});

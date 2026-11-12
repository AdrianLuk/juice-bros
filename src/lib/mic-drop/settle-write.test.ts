import assert from "node:assert/strict";
import { test } from "node:test";

import { settleWrite, UNANSWERED } from "./settle-write.ts";

test("a write that lands, or that the database refuses, comes back as it was", async () => {
  assert.deepEqual(await settleWrite(Promise.resolve({ ok: true as const })), { ok: true });
  assert.deepEqual(await settleWrite(Promise.resolve({ ok: false as const, problem: "Voting is closed." })), {
    ok: false,
    problem: "Voting is closed.",
  });
});

test("a write that never gets an answer says to check the signal, instead of throwing", async () => {
  assert.deepEqual(await settleWrite(Promise.reject(new TypeError("Failed to fetch"))), {
    ok: false,
    problem: UNANSWERED,
  });
});

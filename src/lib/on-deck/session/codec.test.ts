import assert from "node:assert/strict";
import test from "node:test";

import { encode } from "./codec.ts";
import type { EventBody } from "./types.ts";

// Pinned shapes. SQL reads these keys by name (unique indexes on
// `payload->>'token'`, `on_deck_is_paused` reading `token` / `out`, the queue
// and form-group pre-checks, the Volunteer and Kiosk append whitelists), and
// there is no migration to rename them, so a renamed key has to fail here.

const cases: ReadonlyArray<[EventBody, { type: string; payload: object }]> = [
  [
    {
      type: "PLAYER_JOINED",
      token: "t1",
      firstName: "Ben",
      lastInitial: "J",
      skillLevel: "advanced",
    },
    {
      type: "PLAYER_JOINED",
      payload: {
        token: "t1",
        firstName: "Ben",
        lastInitial: "J",
        skillLevel: "advanced",
      },
    },
  ],
  [
    {
      type: "PLAYER_JOINED",
      token: "walkup-1",
      firstName: "Anna",
      lastInitial: "W",
      skillLevel: "intermediate",
      queueOnJoin: true,
    },
    {
      type: "PLAYER_JOINED",
      payload: {
        token: "walkup-1",
        firstName: "Anna",
        lastInitial: "W",
        skillLevel: "intermediate",
        queueOnJoin: true,
      },
    },
  ],
  [
    { type: "PLAYER_SKILL_SET", token: "t1", skillLevel: "beginner" },
    {
      type: "PLAYER_SKILL_SET",
      payload: { token: "t1", skillLevel: "beginner" },
    },
  ],
  [
    { type: "PLAYER_QUEUED", token: "t1" },
    { type: "PLAYER_QUEUED", payload: { token: "t1" } },
  ],
  [
    { type: "COURT_FINISHED", court: 3 },
    { type: "COURT_FINISHED", payload: { court: 3 } },
  ],
  [
    { type: "COURT_CONFIRMED", court: 2, since: 1_700_000_000_000 },
    {
      type: "COURT_CONFIRMED",
      payload: { court: 2, since: 1_700_000_000_000 },
    },
  ],
  [
    { type: "COURT_CONFIRMED", court: 2, since: null },
    { type: "COURT_CONFIRMED", payload: { court: 2, since: null } },
  ],
  [
    { type: "PLAYER_PAUSED", token: "t1", reason: "set-aside" },
    { type: "PLAYER_PAUSED", payload: { token: "t1", reason: "set-aside" } },
  ],
  [
    { type: "PLAYER_REQUEUED", token: "t1" },
    { type: "PLAYER_REQUEUED", payload: { token: "t1" } },
  ],
  [
    { type: "FOURSOME_MEMBER_SWAPPED", court: 4, out: "t1", in: "t2" },
    {
      type: "FOURSOME_MEMBER_SWAPPED",
      payload: { court: 4, out: "t1", in: "t2" },
    },
  ],
  [
    { type: "GROUP_FORMED", groupId: "group-1", memberTokens: ["t1", "t2"] },
    {
      type: "GROUP_FORMED",
      payload: { groupId: "group-1", memberTokens: ["t1", "t2"] },
    },
  ],
  [
    { type: "GROUP_MEMBER_REMOVED", groupId: "group-1", token: "t2" },
    {
      type: "GROUP_MEMBER_REMOVED",
      payload: { groupId: "group-1", token: "t2" },
    },
  ],
  [
    { type: "GROUP_DISSOLVED", groupId: "group-1" },
    { type: "GROUP_DISSOLVED", payload: { groupId: "group-1" } },
  ],
  [
    { type: "GROUP_CAP_CHANGED", cap: 3 },
    { type: "GROUP_CAP_CHANGED", payload: { cap: 3 } },
  ],
  // Structural events carry no payload keys: SQL builds SESSION_STARTED's
  // config keys itself, and nothing decodes them.
  [{ type: "SESSION_STARTED" }, { type: "SESSION_STARTED", payload: {} }],
  [{ type: "LAST_CALL" }, { type: "LAST_CALL", payload: {} }],
  [{ type: "SESSION_CLOSED" }, { type: "SESSION_CLOSED", payload: {} }],
];

for (const [body, expected] of cases) {
  test(`encode pins the ${body.type} payload keys${
    "queueOnJoin" in body ? " with queueOnJoin" : ""
  }${"since" in body && body.since === null ? " and a null since" : ""}`, () => {
    assert.deepEqual(encode(body), expected);
  });
}

test("encode covers every SessionEvent type", () => {
  const types = new Set(cases.map(([body]) => body.type));
  assert.equal(types.size, 15);
});

test("encode writes queueOnJoin only when the body carries it", () => {
  const { payload } = encode({
    type: "PLAYER_JOINED",
    token: "t1",
    firstName: "Ben",
    lastInitial: "J",
    skillLevel: "advanced",
  });
  assert.equal("queueOnJoin" in payload, false);
});

test("encode copies memberTokens instead of aliasing the body's array", () => {
  const memberTokens = ["t1", "t2"];
  const { payload } = encode({ type: "GROUP_FORMED", groupId: "g", memberTokens });
  assert.notEqual(payload.memberTokens, memberTokens);
});

import assert from "node:assert/strict";
import test from "node:test";

import { inviteTokenOf, needsSession, safeRedirectTarget } from "./routes.ts";

test("the Organizer's pages and invites refresh a session; the Score and Public Links don't", () => {
  assert.equal(needsSession("/tools/ddd"), true);
  assert.equal(needsSession("/tools/ddd/events/7d1c/edit"), true);
  assert.equal(needsSession("/tools/ddd/join/abc123"), true);
  assert.equal(needsSession("/tools/ddd/score/abc123"), false);
  assert.equal(needsSession("/tools/ddd/live/abc123"), false);
  assert.equal(needsSession("/tools/dddx"), false);
  assert.equal(needsSession("/tools/team-tally"), false);
});

test("after sign-in, only a DDD path is a place to go back to", () => {
  assert.equal(safeRedirectTarget("/tools/ddd/join/abc123"), "/tools/ddd/join/abc123");
  assert.equal(safeRedirectTarget("/tools/ddd/new"), "/tools/ddd/new");
  assert.equal(safeRedirectTarget("https://evil.example/tools/ddd"), "/tools/ddd");
  assert.equal(safeRedirectTarget("//evil.example/tools/ddd"), "/tools/ddd");
  assert.equal(safeRedirectTarget("/tools/team-tally"), "/tools/ddd");
  assert.equal(safeRedirectTarget("/tools/dddx"), "/tools/ddd");
  assert.equal(safeRedirectTarget(null), "/tools/ddd");
});

test("an invite path carries its token; nothing else does", () => {
  assert.equal(inviteTokenOf("/tools/ddd/join/abc123"), "abc123");
  assert.equal(inviteTokenOf("/tools/ddd/join/abc123/"), "abc123");
  assert.equal(inviteTokenOf("/tools/ddd/join/"), null);
  assert.equal(inviteTokenOf("/tools/ddd/join/a/b"), null);
  assert.equal(inviteTokenOf("/tools/ddd/score/abc123"), null);
});

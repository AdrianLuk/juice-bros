import assert from "node:assert/strict";
import test from "node:test";

import { isHostPath } from "./routes.ts";

test("the Host's pages need a session; a Guest Link and other routes don't", () => {
  assert.equal(isHostPath("/tools/mic-drop"), true);
  assert.equal(isHostPath("/tools/mic-drop/polls/7d1c"), true);
  assert.equal(isHostPath("/tools/mic-drop/vote/abc123"), false);
  assert.equal(isHostPath("/tools/mic-drop-x"), false);
  assert.equal(isHostPath("/tools/team-tally"), false);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { pushResultForError } from "./push-error.ts";

/** The shape web-push throws for a non-2xx answer from the push service. */
function webPushError(statusCode: number) {
  return Object.assign(new Error(`Received unexpected response code ${statusCode}`), { statusCode });
}

test("a 404 from the push service means the device is gone", () => {
  assert.deepEqual(pushResultForError(webPushError(404)), { status: "gone" });
});

test("a 410 from the push service means the device is gone", () => {
  assert.deepEqual(pushResultForError(webPushError(410)), { status: "gone" });
});

test("any other status is an error the device survives", () => {
  const error = webPushError(500);
  assert.deepEqual(pushResultForError(error), { status: "error", error });
});

test("a throw with no HTTP status (a network failure) is an error", () => {
  const error = new TypeError("fetch failed");
  assert.deepEqual(pushResultForError(error), { status: "error", error });
});

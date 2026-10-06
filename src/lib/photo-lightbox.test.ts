import assert from "node:assert/strict";
import test from "node:test";

import { stepPhoto, swipeStep } from "./photo-lightbox.ts";

test("stepPhoto moves one photo forward and back", () => {
  assert.equal(stepPhoto(3, 1, 10), 4);
  assert.equal(stepPhoto(3, -1, 10), 2);
});

test("stepPhoto stops at the first and last photo instead of wrapping", () => {
  assert.equal(stepPhoto(0, -1, 10), null);
  assert.equal(stepPhoto(9, 1, 10), null);
});

test("stepPhoto has nowhere to go with a single photo", () => {
  assert.equal(stepPhoto(0, 1, 1), null);
  assert.equal(stepPhoto(0, -1, 1), null);
});

test("swipeStep reads a swipe left as next and a swipe right as previous", () => {
  assert.equal(swipeStep(-120, 10), 1);
  assert.equal(swipeStep(120, -10), -1);
});

test("swipeStep ignores a short drag", () => {
  assert.equal(swipeStep(-20, 0), 0);
  assert.equal(swipeStep(30, 0), 0);
});

test("swipeStep ignores a mostly vertical drag", () => {
  assert.equal(swipeStep(-80, 200), 0);
  assert.equal(swipeStep(90, -150), 0);
});

import assert from "node:assert/strict";
import test from "node:test";

import { GENDER_LABEL, isGender, parseGender } from "./gender.ts";

test("male and female are recognized genders", () => {
  assert.equal(isGender("male"), true);
  assert.equal(isGender("female"), true);
});

test("anything else, including a stray case or empty string, is not a recognized gender", () => {
  assert.equal(isGender("nonbinary"), false);
  assert.equal(isGender("Male"), false);
  assert.equal(isGender(""), false);
  assert.equal(isGender(undefined), false);
});

test("a blank selection parses to null — unset, not an error", () => {
  assert.equal(parseGender(""), null);
  assert.equal(parseGender("   "), null);
});

test("a real choice parses case-insensitively", () => {
  assert.equal(parseGender("male"), "male");
  assert.equal(parseGender("Female"), "female");
  assert.equal(parseGender("  male  "), "male");
});

test("a tampered or stale value falls back to null rather than an error", () => {
  assert.equal(parseGender("nonbinary"), null);
  assert.equal(parseGender("<script>"), null);
});

test("every gender has a display label", () => {
  assert.equal(GENDER_LABEL.male, "Male");
  assert.equal(GENDER_LABEL.female, "Female");
});

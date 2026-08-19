import assert from "node:assert/strict";
import test from "node:test";

import { DIVISION_LABEL, isDivision, parseDivision } from "./division.ts";

test("open, mixed, mens and womens are recognized divisions", () => {
  assert.equal(isDivision("open"), true);
  assert.equal(isDivision("mixed"), true);
  assert.equal(isDivision("mens"), true);
  assert.equal(isDivision("womens"), true);
});

test("anything else, including a stray case or empty string, is not a recognized division", () => {
  assert.equal(isDivision("Mixed"), false);
  assert.equal(isDivision("coed"), false);
  assert.equal(isDivision(""), false);
  assert.equal(isDivision(undefined), false);
});

test("a blank or tampered selection falls back to open, not an error", () => {
  assert.equal(parseDivision(""), "open");
  assert.equal(parseDivision("coed"), "open");
  assert.equal(parseDivision("<script>"), "open");
});

test("a real choice parses case-insensitively", () => {
  assert.equal(parseDivision("mixed"), "mixed");
  assert.equal(parseDivision("Mens"), "mens");
  assert.equal(parseDivision("  womens  "), "womens");
});

test("every division has a display label", () => {
  assert.equal(DIVISION_LABEL.open, "Open");
  assert.equal(DIVISION_LABEL.mixed, "Mixed");
  assert.equal(DIVISION_LABEL.mens, "Men's");
  assert.equal(DIVISION_LABEL.womens, "Women's");
});

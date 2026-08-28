import assert from "node:assert/strict";
import test from "node:test";

import { REFRESH_LEAD_DAYS, shouldRefreshToken } from "./instagram-token.ts";

const DAY = 24 * 60 * 60;
const NOW = 1_800_000_000;

test("shouldRefreshToken is false for a token with more than the lead time left", () => {
  const expiresAt = NOW + (REFRESH_LEAD_DAYS + 5) * DAY;
  assert.equal(shouldRefreshToken(expiresAt, NOW), false);
});

test("shouldRefreshToken is true once the token is within the lead window", () => {
  const expiresAt = NOW + (REFRESH_LEAD_DAYS - 1) * DAY;
  assert.equal(shouldRefreshToken(expiresAt, NOW), true);
});

test("shouldRefreshToken is true for an already-expired token", () => {
  assert.equal(shouldRefreshToken(NOW - DAY, NOW), true);
});

test("shouldRefreshToken never refreshes an env-var token (Infinity expiry)", () => {
  assert.equal(shouldRefreshToken(Number.POSITIVE_INFINITY, NOW), false);
});

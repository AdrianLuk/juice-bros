import assert from "node:assert/strict";
import test from "node:test";

import { isKnownTimeZone, knownTimeZones } from "./timezone.ts";

test("a real IANA zone is accepted", () => {
  assert.equal(isKnownTimeZone("America/Toronto"), true);
  assert.equal(isKnownTimeZone("UTC"), true);
  assert.equal(isKnownTimeZone("Europe/London"), true);
});

test("a bare offset is refused, because Postgres refuses it too", () => {
  // `Intl` would accept these; `pg_timezone_names` would not, and an offset
  // cannot say what happens when the clocks change.
  assert.equal(isKnownTimeZone("+05:30"), false);
  assert.equal(isKnownTimeZone("-04:00"), false);
});

test("nonsense is refused", () => {
  assert.equal(isKnownTimeZone("Mars/Olympus"), false);
  assert.equal(isKnownTimeZone(""), false);
  assert.equal(isKnownTimeZone("   "), false);
});

test("the picker list is non-empty and holds the zones it claims", () => {
  const zones = knownTimeZones();
  assert.ok(zones.length > 0);
  // Every entry must survive the validator, or the picker offers a zone the
  // database will then refuse.
  for (const zone of zones) assert.equal(isKnownTimeZone(zone), true);
});

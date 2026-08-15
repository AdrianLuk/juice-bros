import assert from "node:assert/strict";
import test from "node:test";

import { deriveTimeZoneFromCoordinates } from "./derive-time-zone.ts";

test("PicklePlex Downsview's coordinates resolve to America/Toronto", () => {
  // Same coordinates the pgTAP fixture and the Playwright Places mock use, so
  // this doubles as a check that the dependency is wired up correctly.
  assert.equal(deriveTimeZoneFromCoordinates(43.7419, -79.4783), "America/Toronto");
});

test("open ocean resolves to a GMT offset zone rather than nothing", () => {
  // geo-tz never returns empty for an in-range lat/lng — the middle of the
  // Pacific is still "a clock", just an Etc/GMT one rather than a named city.
  const zone = deriveTimeZoneFromCoordinates(0, -140);
  assert.ok(zone);
  assert.match(zone, /^Etc\/GMT/);
});

test("out-of-range coordinates resolve to nothing rather than throwing", () => {
  // geo-tz throws on an invalid lat/lng. A real Place's coordinates shouldn't
  // be out of range, but a corrupted cache row could be, and that shouldn't
  // take down Org creation.
  assert.equal(deriveTimeZoneFromCoordinates(1000, 0), null);
});

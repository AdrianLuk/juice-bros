import assert from "node:assert/strict";
import test from "node:test";

import { isKnownTimeZone } from "./timezone.ts";

test("real IANA zones are recognised and invented ones are not", () => {
  assert.equal(isKnownTimeZone("America/Toronto"), true);
  assert.equal(isKnownTimeZone("UTC"), true);
  assert.equal(isKnownTimeZone("Mars/Olympus_Mons"), false);
  assert.equal(isKnownTimeZone(""), false);
});

test("a bare UTC offset is not a time zone, whatever Intl says", () => {
  // `Intl` accepts these; `pg_timezone_names` does not, so the trigger would
  // refuse the row after this said it was fine — and an offset is not a zone
  // anyway, since it cannot say what happens when the clocks change.
  for (const offset of ["+05:30", "-08:00", "+00:00"]) {
    assert.equal(isKnownTimeZone(offset), false, `${offset} is not a zone`);
  }
});

test("legacy and canonical spellings of one zone are both accepted", () => {
  // Node's ICU lists the legacy name and the browser reports the canonical one.
  // Postgres knows both, so refusing either here would reject a real zone.
  for (const zone of [
    "Asia/Kolkata",
    "Asia/Calcutta",
    "Europe/Kyiv",
    "Europe/Kiev",
  ]) {
    assert.equal(isKnownTimeZone(zone), true, `${zone} is a zone`);
  }
});

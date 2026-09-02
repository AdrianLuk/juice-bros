import assert from "node:assert/strict";
import test from "node:test";

import {
  isAllowedFeedHost,
  isCourtReserveHost,
  validateFeedUrl,
} from "./calendar-feed-url.ts";

test("isCourtReserveHost accepts the bare domain and any subdomain, case-insensitively", () => {
  assert.equal(isCourtReserveHost("courtreserve.com"), true);
  assert.equal(isCourtReserveHost("app.courtreserve.com"), true);
  assert.equal(isCourtReserveHost("APP.CourtReserve.com"), true);
  assert.equal(isCourtReserveHost("a.b.courtreserve.com"), true);
});

test("isCourtReserveHost rejects lookalikes and suffix tricks", () => {
  assert.equal(isCourtReserveHost("evilcourtreserve.com"), false);
  assert.equal(isCourtReserveHost("courtreserve.com.attacker.net"), false);
  assert.equal(isCourtReserveHost("courtreserve.co"), false);
  assert.equal(isCourtReserveHost("notcourtreserve.com"), false);
});

test("isAllowedFeedHost widens only by exact match, no subdomain logic on the extras", () => {
  assert.equal(isAllowedFeedHost("127.0.0.1", ["127.0.0.1"]), true);
  assert.equal(isAllowedFeedHost("mock.test", ["mock.test"]), true);
  assert.equal(isAllowedFeedHost("evil.mock.test", ["mock.test"]), false);
  assert.equal(isAllowedFeedHost("courtreserve.com", []), true);
  assert.equal(isAllowedFeedHost("example.com", []), false);
});

test("validateFeedUrl accepts an https CourtReserve URL and returns the normalized url and host", () => {
  const outcome = validateFeedUrl("https://app.courtreserve.com/Online/Calendar/ical/abc123");
  assert.deepEqual(outcome, {
    ok: true,
    url: "https://app.courtreserve.com/Online/Calendar/ical/abc123",
    host: "app.courtreserve.com",
  });
});

test("validateFeedUrl rejects a non-https scheme without echoing the URL", () => {
  const outcome = validateFeedUrl("http://app.courtreserve.com/feed.ics");
  assert.equal(outcome.ok, false);
  assert.match((outcome as { reason: string }).reason, /https/);
  assert.doesNotMatch((outcome as { reason: string }).reason, /courtreserve\.com\/feed/);
});

test("validateFeedUrl rejects a webcal URL", () => {
  assert.equal(validateFeedUrl("webcal://app.courtreserve.com/feed.ics").ok, false);
});

test("validateFeedUrl rejects a non-CourtReserve host", () => {
  const outcome = validateFeedUrl("https://example.com/feed.ics");
  assert.equal(outcome.ok, false);
  assert.match((outcome as { reason: string }).reason, /CourtReserve/);
});

test("validateFeedUrl rejects a lookalike host", () => {
  assert.equal(validateFeedUrl("https://courtreserve.com.attacker.net/feed.ics").ok, false);
});

test("validateFeedUrl rejects blank and unparseable input", () => {
  assert.equal(validateFeedUrl("   ").ok, false);
  assert.equal(validateFeedUrl("not a url").ok, false);
});

test("validateFeedUrl honours the extra-hosts widening", () => {
  const outcome = validateFeedUrl("https://127.0.0.1:5605/feed.ics", ["127.0.0.1"]);
  assert.equal(outcome.ok, true);
  assert.equal((outcome as { host: string }).host, "127.0.0.1");
});

test("validateFeedUrl accepts http: only for an extra-allowed host, never for CourtReserve", () => {
  assert.equal(validateFeedUrl("http://127.0.0.1:5605/feed.ics", ["127.0.0.1"]).ok, true);
  assert.equal(validateFeedUrl("http://app.courtreserve.com/feed.ics", ["127.0.0.1"]).ok, false);
  // http: to a host that isn't on the extra list is still rejected.
  assert.equal(validateFeedUrl("http://127.0.0.1:5605/feed.ics", []).ok, false);
});

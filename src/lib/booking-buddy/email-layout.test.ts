import assert from "node:assert/strict";
import test from "node:test";

import { renderEmailLayout } from "./email-layout.ts";

test("renderEmailLayout shows the heading and links the primary action", () => {
  const html = renderEmailLayout({
    heading: "Bookings just opened at PicklePlex",
    paragraphs: ["Grab a court before they go."],
    primaryAction: { label: "View the game", url: "https://x.test/booking-buddy/slots/abc" },
  });

  assert.match(html, /Bookings just opened at PicklePlex/);
  assert.match(html, /Grab a court before they go\./);
  assert.match(html, /<a [^>]*href="https:\/\/x\.test\/booking-buddy\/slots\/abc"[^>]*>[\s\S]*View the game/);
});

test("renderEmailLayout escapes every text and URL field it is given", () => {
  const html = renderEmailLayout({
    heading: "<h-script>",
    emphasis: "<em-script>",
    paragraphs: ["<p-script>", "Tom & Jerry"],
    primaryAction: { label: "<a-label>", url: "https://x.test/go?a=1&b=2\"onclick=\"x" },
    secondaryActions: [{ label: "<b-label>", url: "https://x.test/no?a=1&b=2" }],
    smallPrint: "<small-script>",
  });

  for (const raw of ["<h-script>", "<em-script>", "<p-script>", "<a-label>", "<b-label>", "<small-script>"]) {
    assert.ok(!html.includes(raw), `${raw} must not reach the HTML unescaped`);
    assert.ok(html.includes(raw.replace("<", "&lt;").replace(">", "&gt;")), `${raw} is still shown`);
  }
  assert.match(html, /Tom &amp; Jerry/);
  assert.match(html, /href="https:\/\/x\.test\/go\?a=1&amp;b=2&quot;onclick=&quot;x"/);
  assert.match(html, /href="https:\/\/x\.test\/no\?a=1&amp;b=2"/);
});

test("renderEmailLayout renders secondary actions only when given", () => {
  const withOne = renderEmailLayout({
    heading: "Ben Johns wants to connect",
    paragraphs: [],
    primaryAction: { label: "Accept", url: "https://x.test/accept" },
    secondaryActions: [{ label: "Decline", url: "https://x.test/decline" }],
  });
  const without = renderEmailLayout({
    heading: "Ben Johns accepted your friend request",
    paragraphs: [],
    primaryAction: { label: "Open your Friends page", url: "https://x.test/friends" },
  });

  assert.match(withOne, /href="https:\/\/x\.test\/decline"[^>]*>Decline</);
  assert.equal(without.match(/<a /g)?.length, 1, "only the primary action is a link");
});

test("renderEmailLayout carries the Booking Buddy wordmark as text, with no images", () => {
  const html = renderEmailLayout({
    heading: "You're down as yes",
    paragraphs: [],
    primaryAction: { label: "View the game", url: "https://x.test/g" },
  });

  assert.match(html, />Booking Buddy</);
  assert.doesNotMatch(html, /<img|<svg|background-image|url\(/i);
});

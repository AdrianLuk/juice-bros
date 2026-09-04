import assert from "node:assert/strict";
import test from "node:test";

import { formatConnectionAcceptedEmail } from "./connection-accepted-email.ts";

test("formatConnectionAcceptedEmail names the accepter in the subject and body", () => {
  const { subject, html } = formatConnectionAcceptedEmail({
    accepterLabel: "Ben (@ben)",
    friendsUrl: "https://x.test/booking-buddy/friends",
  });

  assert.match(subject, /Ben \(@ben\) accepted your friend request on Booking Buddy/);
  assert.match(html, /Ben \(@ben\) accepted your friend request/);
  assert.match(html, /href="https:\/\/x\.test\/booking-buddy\/friends"/);
});

test("formatConnectionAcceptedEmail states that visibility is now open", () => {
  const { html } = formatConnectionAcceptedEmail({
    accepterLabel: "Ben (@ben)",
    friendsUrl: "https://x.test/booking-buddy/friends",
  });

  assert.match(html, /You'll now see each other's games and availability/);
});

test("formatConnectionAcceptedEmail escapes HTML in the accepter label", () => {
  const { html } = formatConnectionAcceptedEmail({
    accepterLabel: '<img src=x onerror=alert(1)> "Ben"',
    friendsUrl: "https://x.test/booking-buddy/friends",
  });

  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
  assert.match(html, /&quot;Ben&quot;/);
});

test("formatConnectionAcceptedEmail escapes an ampersand in the link", () => {
  const { html } = formatConnectionAcceptedEmail({
    accepterLabel: "Amy",
    friendsUrl: "https://x.test/booking-buddy/friends?ref=email&x=1",
  });

  assert.match(html, /friends\?ref=email&amp;x=1/);
});

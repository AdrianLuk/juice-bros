import assert from "node:assert/strict";
import test from "node:test";

import { visibleText } from "./email-test-text.ts";

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

test("formatConnectionAcceptedEmail has one link, to the Friends page, and never says slot", () => {
  const { html } = formatConnectionAcceptedEmail({
    accepterLabel: "Anna Leigh Waters (@alw)",
    friendsUrl: "https://x.test/booking-buddy/friends",
  });

  assert.equal(html.match(/<a /g)?.length, 1);
  assert.match(html, /href="https:\/\/x\.test\/booking-buddy\/friends"[^>]*>Open your Friends page</);
  assert.doesNotMatch(visibleText(html), /slot/i);
});

test("formatConnectionAcceptedEmail shows the accepter's name and handle in their own case", () => {
  const { html } = formatConnectionAcceptedEmail({
    accepterLabel: "Anna Leigh Waters (@annaleigh)",
    friendsUrl: "https://x.test/booking-buddy/friends",
  });

  assert.match(visibleText(html), /Anna Leigh Waters \(@annaleigh\) accepted your friend request/);
});

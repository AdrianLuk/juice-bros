import assert from "node:assert/strict";
import test from "node:test";

import {
  formatConnectionRequestEmail,
  parseConnectionRequestAction,
} from "./connection-request-email.ts";

test("parseConnectionRequestAction accepts the two known actions", () => {
  assert.equal(parseConnectionRequestAction("accept"), "accept");
  assert.equal(parseConnectionRequestAction("decline"), "decline");
});

test("parseConnectionRequestAction rejects anything else", () => {
  for (const raw of ["", "ACCEPT", "yes", "remove", null, undefined]) {
    assert.equal(parseConnectionRequestAction(raw), null);
  }
});

test("formatConnectionRequestEmail names the requester in the subject and body", () => {
  const { subject, html } = formatConnectionRequestEmail({
    requesterLabel: "Daven (@daven)",
    acceptUrl: "https://x.test/connect/tok?a=accept",
    declineUrl: "https://x.test/connect/tok?a=decline",
  });

  assert.match(subject, /Daven \(@daven\) wants to connect on Booking Buddy/);
  assert.match(html, /Daven \(@daven\) wants to connect/);
  assert.match(html, /href="https:\/\/x\.test\/connect\/tok\?a=accept"/);
  assert.match(html, /href="https:\/\/x\.test\/connect\/tok\?a=decline"/);
});

test("formatConnectionRequestEmail states the visibility consequence of accepting", () => {
  const { html } = formatConnectionRequestEmail({
    requesterLabel: "Daven (@daven)",
    acceptUrl: "https://x.test/connect/tok?a=accept",
    declineUrl: "https://x.test/connect/tok?a=decline",
  });

  assert.match(
    html,
    /You'll both see each other's games and availability — change that any time/,
  );
});

test("formatConnectionRequestEmail escapes HTML in the requester label", () => {
  const { html } = formatConnectionRequestEmail({
    requesterLabel: '<img src=x onerror=alert(1)> "Ben"',
    acceptUrl: "https://x.test/a",
    declineUrl: "https://x.test/d",
  });

  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
  assert.match(html, /&quot;Ben&quot;/);
});

test("formatConnectionRequestEmail escapes an ampersand in a link", () => {
  const { html } = formatConnectionRequestEmail({
    requesterLabel: "Amy",
    acceptUrl: "https://x.test/connect/tok?a=accept&ref=email",
    declineUrl: "https://x.test/connect/tok?a=decline",
  });

  assert.match(html, /a=accept&amp;ref=email/);
});

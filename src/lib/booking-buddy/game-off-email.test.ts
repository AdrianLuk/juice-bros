import assert from "node:assert/strict";
import test from "node:test";

import { visibleText } from "./email-test-text.ts";

import { formatGameOffEmail } from "./game-off-email.ts";

const BASE = {
  organizerLabel: "Amy (@amy)",
  slotWhen: "Tue, Oct 13, 2026 · 8:00 PM – 10:00 PM",
  gameDate: "2026-10-13",
  gamesUrl: "https://x.test/booking-buddy/slots",
  weeklyGameContinues: true,
};

test("formatGameOffEmail names the game's date in the subject and body, never \"this week\"", () => {
  const { subject, html } = formatGameOffEmail(BASE);

  assert.equal(subject, "The game on Tue, Oct 13 is off");
  const text = visibleText(html);
  assert.match(text, /The game on Tue, Oct 13 is off/);
  assert.match(text, /Tue, Oct 13, 2026 · 8:00 PM – 10:00 PM/);
  assert.match(text, /Amy \(@amy\) skipped the weekly game on Tue, Oct 13/);
  // With a long Booking Window the skipped game can be weeks out, so neither
  // "this week" nor "next week" is safe to say.
  assert.doesNotMatch(`${subject} ${text}`, /this week|next week/i);
});

test("formatGameOffEmail says the weekly game carries on, unless it has ended", () => {
  assert.match(visibleText(formatGameOffEmail(BASE).html), /Only that week is off/);
  assert.doesNotMatch(
    visibleText(formatGameOffEmail({ ...BASE, weeklyGameContinues: false }).html),
    /carries on/i,
  );
});

test("formatGameOffEmail has one link, to the Games page", () => {
  const { html } = formatGameOffEmail(BASE);

  assert.equal(html.match(/<a /g)?.length, 1);
  assert.match(html, /href="https:\/\/x\.test\/booking-buddy\/slots"[^>]*>See your games</);
});

test("formatGameOffEmail escapes HTML in the organizer's name", () => {
  const { html } = formatGameOffEmail({ ...BASE, organizerLabel: '<img src=x onerror=alert(1)> "Amy"' });

  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
});

test("formatGameOffEmail reads like the app: no em-dashes, never says slot", () => {
  for (const weeklyGameContinues of [true, false]) {
    const { subject, html } = formatGameOffEmail({ ...BASE, weeklyGameContinues });
    const words = `${subject} ${visibleText(html)}`;
    assert.doesNotMatch(words, /—/);
    assert.doesNotMatch(words, /slot/i);
  }
});

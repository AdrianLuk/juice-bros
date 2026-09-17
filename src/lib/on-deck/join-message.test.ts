import assert from "node:assert/strict";
import test from "node:test";

import { buildJoinMessage } from "./join-message.ts";

test("carries the club name and the exact link, with no markdown", () => {
  const message = buildJoinMessage(
    "TO Pickleball Club",
    "https://juicebrospickleball.com/on-deck/c/club-1",
  );

  assert.match(message, /TO Pickleball Club/);
  assert.match(
    message,
    /https:\/\/juicebrospickleball\.com\/on-deck\/c\/club-1/,
  );
  // Plain text for a group chat: no em dash, no asterisks/markdown links.
  assert.doesNotMatch(message, /—/);
  assert.doesNotMatch(message, /[*_[\]]/);
});

test("says what tapping it does, without claiming a session is running", () => {
  const message = buildJoinMessage("Ramsden Park Socials", "https://example.com/x");

  assert.match(message, /name/i);
  assert.match(message, /no sign-up/i);
  // The link is stable and gets pinned/reused; it must not promise "tonight".
  assert.doesNotMatch(message, /tonight/i);
});

test("never doubles up an s for a club name that already ends in one", () => {
  const message = buildJoinMessage("Ramsden Park Socials", "https://example.com/x");

  assert.doesNotMatch(message, /Socials's/);
  assert.doesNotMatch(message, /Socialss/);
});

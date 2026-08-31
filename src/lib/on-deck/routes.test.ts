import assert from "node:assert/strict";
import test from "node:test";

import {
  ON_DECK_HOME_PATH,
  ON_DECK_SIGN_IN_PATH,
  clubQrPath,
  requiresOrganizerSession,
  safeRedirectTarget,
  sessionPath,
} from "./routes.ts";

test("only the Organizer subtree requires a session", () => {
  assert.equal(requiresOrganizerSession("/on-deck/home"), true);
  assert.equal(requiresOrganizerSession("/on-deck/home/settings"), true);

  assert.equal(requiresOrganizerSession("/on-deck"), false);
  assert.equal(requiresOrganizerSession("/on-deck/sign-in"), false);
  assert.equal(requiresOrganizerSession("/on-deck/c/abc"), false);
  assert.equal(requiresOrganizerSession("/on-deck/session/abc"), false);
  assert.equal(requiresOrganizerSession("/booking-buddy/friends"), false);
});

test("the prefix alone does not make a route On Deck's", () => {
  assert.equal(requiresOrganizerSession("/on-deck-press-kit"), false);
});

test("path builders produce the stable shapes the proxy and pages share", () => {
  assert.equal(clubQrPath("club-1"), "/on-deck/c/club-1");
  assert.equal(sessionPath("session-1"), "/on-deck/session/session-1");
});

test("safeRedirectTarget only ever returns an On Deck path", () => {
  assert.equal(safeRedirectTarget("/on-deck/home"), "/on-deck/home");
  assert.equal(safeRedirectTarget("/on-deck/session/abc"), "/on-deck/session/abc");

  // Falls back to the home screen for anything off-limits.
  assert.equal(safeRedirectTarget(null), ON_DECK_HOME_PATH);
  assert.equal(safeRedirectTarget(""), ON_DECK_HOME_PATH);
  assert.equal(safeRedirectTarget("https://evil.example"), ON_DECK_HOME_PATH);
  assert.equal(safeRedirectTarget("//evil.example"), ON_DECK_HOME_PATH);
  assert.equal(safeRedirectTarget("/booking-buddy/friends"), ON_DECK_HOME_PATH);
  assert.equal(safeRedirectTarget("\\\\evil.example"), ON_DECK_HOME_PATH);
  assert.equal(safeRedirectTarget(ON_DECK_SIGN_IN_PATH), ON_DECK_HOME_PATH);
});

test("safeRedirectTarget won't bounce back to an auth page dressed up with a query or slash", () => {
  assert.equal(
    safeRedirectTarget("/on-deck/sign-in?next=/on-deck/home"),
    ON_DECK_HOME_PATH,
  );
  assert.equal(safeRedirectTarget("/on-deck/sign-in/"), ON_DECK_HOME_PATH);
  assert.equal(
    safeRedirectTarget("/on-deck/auth/callback?code=x"),
    ON_DECK_HOME_PATH,
  );
});

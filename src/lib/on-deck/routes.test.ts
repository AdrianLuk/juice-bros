import assert from "node:assert/strict";
import test from "node:test";

import {
  ON_DECK_HOME_PATH,
  ON_DECK_NEW_SESSION_PATH,
  ON_DECK_SETTINGS_PATH,
  ON_DECK_SIGN_IN_PATH,
  clubQrPath,
  displayPath,
  editSessionPath,
  floorPath,
  kioskPath,
  requiresOrganizerSession,
  safeRedirectTarget,
  sessionPath,
  volunteerPath,
} from "./routes.ts";

test("only the Organizer subtree requires a session", () => {
  assert.equal(requiresOrganizerSession("/on-deck/home"), true);
  assert.equal(requiresOrganizerSession("/on-deck/home/settings"), true);
  assert.equal(requiresOrganizerSession(ON_DECK_SETTINGS_PATH), true);
  assert.equal(requiresOrganizerSession(ON_DECK_NEW_SESSION_PATH), true);
  assert.equal(
    requiresOrganizerSession(editSessionPath("session-1")),
    true,
  );

  assert.equal(requiresOrganizerSession("/on-deck"), false);
  assert.equal(requiresOrganizerSession("/on-deck/sign-in"), false);
  assert.equal(requiresOrganizerSession("/on-deck/c/abc"), false);
  assert.equal(requiresOrganizerSession("/on-deck/session/abc"), false);
  assert.equal(requiresOrganizerSession("/booking-buddy/friends"), false);
});

test("the floor screen under a Session is Organizer-only", () => {
  assert.equal(requiresOrganizerSession("/on-deck/session/abc/floor"), true);
  assert.equal(requiresOrganizerSession("/on-deck/session/abc/floor/"), true);
  assert.equal(requiresOrganizerSession("/on-deck/session/abc"), false);
});

test("the Volunteer Link floor screen is not Organizer-gated — the token is its credential", () => {
  assert.equal(
    requiresOrganizerSession("/on-deck/session/abc/volunteer/tok123"),
    false,
  );
  assert.equal(
    requiresOrganizerSession("/on-deck/session/abc/volunteer/tok123/"),
    false,
  );
});

test("the read-only Display is not Organizer-gated — it renders only wall-public data", () => {
  assert.equal(requiresOrganizerSession("/on-deck/session/abc/display"), false);
  assert.equal(requiresOrganizerSession("/on-deck/session/abc/display/"), false);
});

test("the Kiosk is not Organizer-gated — the session id is its credential (ADR 0005)", () => {
  assert.equal(requiresOrganizerSession("/on-deck/session/abc/kiosk"), false);
  assert.equal(requiresOrganizerSession("/on-deck/session/abc/kiosk/"), false);
});

test("the prefix alone does not make a route On Deck's", () => {
  assert.equal(requiresOrganizerSession("/on-deck-press-kit"), false);
});

test("path builders produce the stable shapes the proxy and pages share", () => {
  assert.equal(clubQrPath("club-1"), "/on-deck/c/club-1");
  assert.equal(sessionPath("session-1"), "/on-deck/session/session-1");
  assert.equal(floorPath("session-1"), "/on-deck/session/session-1/floor");
  assert.equal(
    displayPath("session-1"),
    "/on-deck/session/session-1/display",
  );
  assert.equal(
    volunteerPath("session-1", "tok-abc"),
    "/on-deck/session/session-1/volunteer/tok-abc",
  );
  assert.equal(
    kioskPath("session-1"),
    "/on-deck/session/session-1/kiosk",
  );
  assert.equal(
    editSessionPath("session-1"),
    "/on-deck/home/sessions/session-1",
  );
  assert.equal(ON_DECK_NEW_SESSION_PATH, "/on-deck/home/sessions/new");
  assert.equal(ON_DECK_SETTINGS_PATH, "/on-deck/home/settings");
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

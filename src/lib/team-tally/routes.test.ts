import assert from "node:assert/strict";
import test from "node:test";

import {
  TEAM_TALLY_DEMO_PATH,
  TEAM_TALLY_NEW_EVENT_PATH,
  TEAM_TALLY_ROOT,
  TEAM_TALLY_SIGN_IN_PATH,
  editTeamEventPath,
  isTeamTallyDemo,
  publicLinkPath,
  requiresOrganizerSession,
  safeRedirectTarget,
  scoreLinkPath,
  teamEventPath,
} from "./routes.ts";

test("only the Organizer's Team Events need a session", () => {
  assert.equal(requiresOrganizerSession(TEAM_TALLY_NEW_EVENT_PATH), true);
  assert.equal(requiresOrganizerSession(teamEventPath("event-1")), true);
  assert.equal(requiresOrganizerSession(editTeamEventPath("event-1")), true);

  // The landing doubles as the Organizer's list, and branches on the session
  // itself rather than bouncing a visitor to sign-in.
  assert.equal(requiresOrganizerSession(TEAM_TALLY_ROOT), false);
  assert.equal(requiresOrganizerSession(TEAM_TALLY_SIGN_IN_PATH), false);
  // Score Links and the Public Link are credentials in their own right.
  assert.equal(requiresOrganizerSession(scoreLinkPath("token")), false);
  assert.equal(requiresOrganizerSession(publicLinkPath("token")), false);
  // Shares the prefix but is another route.
  assert.equal(requiresOrganizerSession("/tools/team-tally-events"), false);
});

test("the Score Link and Public Link carry their token in the path", () => {
  assert.equal(scoreLinkPath("abc123"), "/tools/team-tally/score/abc123");
  assert.equal(publicLinkPath("def456"), "/tools/team-tally/live/def456");
});

test("a post-sign-in redirect stays inside Team Tally", () => {
  assert.equal(safeRedirectTarget(teamEventPath("event-1")), "/tools/team-tally/events/event-1");
  assert.equal(safeRedirectTarget(undefined), TEAM_TALLY_ROOT);
  assert.equal(safeRedirectTarget("https://evil.example"), TEAM_TALLY_ROOT);
  assert.equal(safeRedirectTarget("//evil.example"), TEAM_TALLY_ROOT);
  assert.equal(safeRedirectTarget("/\\evil.example"), TEAM_TALLY_ROOT);
  assert.equal(safeRedirectTarget("/on-deck/home"), TEAM_TALLY_ROOT);
  // Never back to sign-in, which would loop.
  assert.equal(safeRedirectTarget(`${TEAM_TALLY_SIGN_IN_PATH}?next=/x`), TEAM_TALLY_ROOT);
});

test("the demo night is public and needs no database", () => {
  assert.equal(TEAM_TALLY_DEMO_PATH, "/tools/team-tally/demo");
  assert.equal(requiresOrganizerSession(TEAM_TALLY_DEMO_PATH), false);
  assert.equal(isTeamTallyDemo(TEAM_TALLY_DEMO_PATH), true);
  assert.equal(isTeamTallyDemo(`${TEAM_TALLY_DEMO_PATH}/`), true);
  assert.equal(isTeamTallyDemo(TEAM_TALLY_ROOT), false);
  assert.equal(isTeamTallyDemo(scoreLinkPath("demo")), false);
  assert.equal(isTeamTallyDemo("/tools/team-tally/demonstration"), false);
});

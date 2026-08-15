import assert from "node:assert/strict";
import test from "node:test";

import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  parseUsername,
  usernameWriteMessage,
} from "./username.ts";

test("a plain handle is accepted as it stands", () => {
  assert.deepEqual(parseUsername("amyace"), { username: "amyace" });
});

test("case and surrounding space are normalised away", () => {
  // The unique index is on lower(username), so `AmyAce` and `amyace` are the
  // same handle. Storing what was typed would make that surprising.
  assert.deepEqual(parseUsername("  AmyAce  "), { username: "amyace" });
});

test("digits and underscores are allowed", () => {
  assert.deepEqual(parseUsername("amy_ace_2"), { username: "amy_ace_2" });
});

test("an empty handle is rejected, not treated as clearing it", () => {
  // Nulling a username would make the User unfindable by anything but their
  // email, which is the thing Usernames exist to avoid handing out.
  const result = parseUsername("   ");
  assert.ok("error" in result);
});

test("a too-short handle says so, with the number", () => {
  const result = parseUsername("am");
  assert.ok("error" in result);
  assert.match(result.error, new RegExp(String(USERNAME_MIN_LENGTH)));
});

test("a too-long handle says so, with the number", () => {
  const result = parseUsername("a".repeat(USERNAME_MAX_LENGTH + 1));
  assert.ok("error" in result);
  assert.match(result.error, new RegExp(String(USERNAME_MAX_LENGTH)));
});

test("a handle at each boundary is allowed", () => {
  assert.deepEqual(parseUsername("a".repeat(USERNAME_MIN_LENGTH)), {
    username: "a".repeat(USERNAME_MIN_LENGTH),
  });
  assert.deepEqual(parseUsername("a".repeat(USERNAME_MAX_LENGTH)), {
    username: "a".repeat(USERNAME_MAX_LENGTH),
  });
});

test("punctuation and spaces are rejected rather than stripped", () => {
  // Signup *strips* to build a handle nobody chose; here someone typed it, so
  // silently changing it would hand them a handle they didn't ask for.
  for (const bad of ["amy ace", "amy.ace", "amy-ace", "amy@ace", "amy/ace"]) {
    const result = parseUsername(bad);
    assert.ok("error" in result, `${bad} should be rejected`);
  }
});

test("non-ascii is rejected, since these get retyped off a phone screen", () => {
  assert.ok("error" in parseUsername("amyacé"));
});

test("a taken handle is reported as taken, not as a generic failure", () => {
  assert.match(usernameWriteMessage({ code: "23505" }), /taken/i);
});

test("a format breach that slipped past us still reads as a bad handle", () => {
  // The database check constraint is the backstop for anything parseUsername
  // fails to catch; the User should still get a useful message.
  assert.match(usernameWriteMessage({ code: "23514" }), /letters|numbers/i);
});

test("an unrecognised failure is not dressed up as the User's fault", () => {
  assert.match(usernameWriteMessage({ code: "08006" }), /try again/i);
});

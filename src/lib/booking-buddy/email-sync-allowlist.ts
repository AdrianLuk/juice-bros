/**
 * The app-side allowlist gating issue #62's Gmail sync feature (ADR-0009's
 * addendum) — separate from Google's own Testing-mode test-user list, which
 * blocks OAuth consent at the Google layer but isn't queryable by the app.
 *
 * Kept free of Next.js and Supabase imports so it's unit tested directly.
 * Callers resolve the session's User to their Username and account email the
 * same way `getOwnProfile`/`verifySession` do, then pass both here alongside
 * the raw env value — comparing on Username or email, not User id, per the
 * addendum. Both are accepted because a User adding a friend to the list
 * realistically only has the friend's email on hand, not a Username they'd
 * have to go ask for.
 */

function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw) {
    return new Set();
  }

  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0),
  );
}

/**
 * An empty or unset allowlist rejects everyone rather than defaulting open —
 * a forgotten env var must fail closed, not silently expose the feature.
 *
 * A User with neither a Username nor an email on their session (shouldn't
 * happen post-signup, but not this function's place to assume) simply
 * matches nothing rather than throwing.
 */
export function isEmailSyncAllowed(
  username: string | null,
  email: string | null | undefined,
  allowlistEnv: string | undefined,
): boolean {
  const allowlist = parseAllowlist(allowlistEnv);
  if (allowlist.size === 0) {
    return false;
  }

  const normalizedUsername = username?.trim().toLowerCase();
  const normalizedEmail = email?.trim().toLowerCase();

  return (
    (!!normalizedUsername && allowlist.has(normalizedUsername)) ||
    (!!normalizedEmail && allowlist.has(normalizedEmail))
  );
}

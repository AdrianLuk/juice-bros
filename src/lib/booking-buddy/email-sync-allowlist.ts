/**
 * The app-side allowlist gating issue #62's Gmail sync feature (ADR-0009's
 * addendum) — separate from Google's own Testing-mode test-user list, which
 * blocks OAuth consent at the Google layer but isn't queryable by the app.
 *
 * Kept free of Next.js and Supabase imports so it's unit tested directly.
 * Callers resolve the session's User to their Username the same way
 * `getOwnProfile` does, then pass it here alongside the raw env value —
 * comparing on Username, not User id, per the addendum.
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
 */
export function isEmailSyncAllowed(
  username: string | null,
  allowlistEnv: string | undefined,
): boolean {
  if (!username) {
    return false;
  }

  const allowlist = parseAllowlist(allowlistEnv);
  if (allowlist.size === 0) {
    return false;
  }

  return allowlist.has(username.trim().toLowerCase());
}

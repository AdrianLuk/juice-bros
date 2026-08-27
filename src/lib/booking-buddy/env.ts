/**
 * Env access for Booking Buddy's Supabase connection.
 *
 * Reads are explicit rather than inlined at call sites so a missing or blank
 * variable fails with the variable's name instead of a cryptic error from deep
 * inside the Supabase client.
 */

type EnvSource = Record<string, string | undefined>;

function requireEnv(source: EnvSource, name: string): string {
  const value = source[name];

  if (value === undefined || value.trim() === "") {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example for what it should hold.`,
    );
  }

  return value;
}

export type PublicSupabaseEnv = {
  url: string;
  anonKey: string;
};

/**
 * The two values safe to expose to the browser.
 *
 * The default source spells each variable out as a literal `process.env.X`.
 * That is load-bearing: Next.js only inlines a `NEXT_PUBLIC_` variable into the
 * browser bundle where it appears verbatim. Neither a dynamic lookup
 * (`process.env[name]`) nor an alias (`const e = process.env`) is inlined, so
 * reading through either would hand the browser `undefined` in production.
 */
export function readPublicSupabaseEnv(
  source: EnvSource = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
): PublicSupabaseEnv {
  return {
    url: requireEnv(source, "NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: requireEnv(source, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

/**
 * The Google OAuth Client ID Google Identity Services uses to render the
 * "Continue with Google" button (see `google-sign-in-button.tsx`) — safe to
 * expose to the browser, same reasoning as `readPublicSupabaseEnv` above, and
 * for the same reason a literal `process.env.NEXT_PUBLIC_*` reference rather
 * than a dynamic lookup. Deliberately the *same* Client ID Supabase's Google
 * provider already holds for the (now-removed) OAuth-redirect flow — see
 * ADR-0013 for why this one is reused rather than split like the Gmail-sync
 * client (`GOOGLE_OAUTH_CLIENT_ID` below) is.
 *
 * Optional, unlike `readPublicSupabaseEnv`: this only gates one button on the
 * sign-in page, not the page itself, so a missing value means "don't render
 * the Google option" rather than failing the whole page — magic link and
 * password sign-in have to keep working regardless of whether the human-only
 * Cloud Console / Supabase Dashboard setup (`google-sign-in-setup.md`) has
 * been done yet in this environment.
 */
export function readGoogleSignInClientId(
  source: EnvSource = {
    NEXT_PUBLIC_GOOGLE_SIGN_IN_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN_CLIENT_ID,
  },
): string | undefined {
  const value = source.NEXT_PUBLIC_GOOGLE_SIGN_IN_CLIENT_ID;
  return value && value.trim() !== "" ? value : undefined;
}

/**
 * Bypasses Row Level Security entirely. First real use is `place_cache` (see
 * `supabase/admin.ts`) — PROGRESS.md expected Phase 8's Reminder job to need
 * this first, but writing the Place cache beat it there (ADR 0005).
 */
export function requireSupabaseServiceRoleKey(
  source: EnvSource = { SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY },
): string {
  return requireEnv(source, "SUPABASE_SERVICE_ROLE_KEY");
}

/** Server-only. Never read this into anything that reaches the browser. */
export function requireGoogleMapsApiKey(
  source: EnvSource = { GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY },
): string {
  return requireEnv(source, "GOOGLE_MAPS_API_KEY");
}

const DEFAULT_GOOGLE_PLACES_API_BASE_URL = "https://places.googleapis.com";

/**
 * Test-only override so Playwright can point the app at a local fixture server
 * instead of Google (see `e2e/support/google-places-mock.ts`). Not required —
 * a blank or missing value means "use the real API".
 */
export function readGooglePlacesApiBaseUrl(
  source: EnvSource = {
    GOOGLE_PLACES_API_BASE_URL: process.env.GOOGLE_PLACES_API_BASE_URL,
  },
): string {
  const value = source.GOOGLE_PLACES_API_BASE_URL;
  return value && value.trim() !== "" ? value : DEFAULT_GOOGLE_PLACES_API_BASE_URL;
}

/**
 * This app's own Gmail OAuth client (issue #62's "Sync from Email" —
 * `gmail-client.ts`). Separate from the client id Supabase's Google
 * sign-in provider holds internally (that one never reaches this repo's
 * env at all — see PROGRESS.md's Phase 0 notes) — both reuse the same
 * Cloud Console project per ADR-0009, but a Mailbox Link is its own OAuth
 * grant, not a Supabase Auth session, so it needs its own credentials here.
 */
export function requireGoogleOAuthClientId(
  source: EnvSource = { GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID },
): string {
  return requireEnv(source, "GOOGLE_OAUTH_CLIENT_ID");
}

/** Server-only. Never read this into anything that reaches the browser. */
export function requireGoogleOAuthClientSecret(
  source: EnvSource = {
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  },
): string {
  return requireEnv(source, "GOOGLE_OAUTH_CLIENT_SECRET");
}

/**
 * Encrypts `mailbox_links.encrypted_refresh_token` at rest (issue #62) —
 * see `token-encryption.ts`. Treated as sensitively as
 * `SUPABASE_SERVICE_ROLE_KEY`: server-only, never `NEXT_PUBLIC_*`.
 */
export function requireMailboxLinkEncryptionKey(
  source: EnvSource = {
    MAILBOX_LINK_ENCRYPTION_KEY: process.env.MAILBOX_LINK_ENCRYPTION_KEY,
  },
): string {
  return requireEnv(source, "MAILBOX_LINK_ENCRYPTION_KEY");
}

/**
 * Server-only. Comma-separated Usernames and/or account emails approved for
 * issue #62's email-sync feature — see `email-sync-allowlist.ts` and
 * ADR-0009's addendum. A deliberately separate list from Google's own
 * Testing-mode test users, not a mirror of it. Unset/blank means nobody is
 * allowed — see `isEmailSyncAllowed`, which fails closed rather than
 * defaulting open.
 */
export function readEmailSyncAllowlist(
  source: EnvSource = { EMAIL_SYNC_ALLOWLIST: process.env.EMAIL_SYNC_ALLOWLIST },
): string | undefined {
  return source.EMAIL_SYNC_ALLOWLIST;
}

/**
 * Test-only override collapsing Google's three real OAuth-flow hosts
 * (`accounts.google.com`, `oauth2.googleapis.com`, `www.googleapis.com`)
 * onto one local mock (`e2e/support/gmail-mock.ts`) — mirrors
 * `GOOGLE_PLACES_API_BASE_URL`. Blank/missing means "use the real hosts".
 */
export function readGmailApiBaseUrl(
  source: EnvSource = { GMAIL_API_BASE_URL: process.env.GMAIL_API_BASE_URL },
): string | undefined {
  const value = source.GMAIL_API_BASE_URL;
  return value && value.trim() !== "" ? value : undefined;
}

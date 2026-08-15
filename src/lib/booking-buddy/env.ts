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

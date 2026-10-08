/**
 * Env access for Team Tally's Supabase connection.
 *
 * Team Tally shares the Supabase project and the site sign-in with Booking
 * Buddy and On Deck, and nothing in the domain (CONTEXT-MAP.md), so it reads
 * its own env the way On Deck does: a few lines of deliberate duplication keep
 * the contexts independent. Each variable is spelled out as a literal
 * `process.env.X`, because Next.js only inlines a `NEXT_PUBLIC_` variable into
 * the browser bundle where it appears verbatim.
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

export function readPublicSupabaseEnv(
  source: EnvSource = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
): { url: string; anonKey: string } {
  return {
    url: requireEnv(source, "NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: requireEnv(source, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

/**
 * The Google OAuth Client ID behind "Continue with Google": the same one
 * Booking Buddy and On Deck read (one Cloud Console client for the domain).
 * Optional: missing means "don't render the Google option".
 */
export function readGoogleSignInClientId(
  source: EnvSource = {
    NEXT_PUBLIC_GOOGLE_SIGN_IN_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN_CLIENT_ID,
  },
): string | undefined {
  const value = source.NEXT_PUBLIC_GOOGLE_SIGN_IN_CLIENT_ID;
  return value && value.trim() !== "" ? value : undefined;
}

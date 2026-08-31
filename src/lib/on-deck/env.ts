/**
 * Env access for On Deck's Supabase connection.
 *
 * On Deck shares the Supabase *project* with Booking Buddy but nothing in the
 * domain (see CONTEXT-MAP.md), so it reads its own env rather than importing
 * Booking Buddy's helper — a few lines of deliberate duplication keeps the two
 * contexts structurally independent. Reads are explicit so a missing variable
 * fails with its own name, not a cryptic error from inside the Supabase client.
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
 * Each variable is spelled out as a literal `process.env.X`: Next.js only
 * inlines a `NEXT_PUBLIC_` variable into the browser bundle where it appears
 * verbatim, so a dynamic lookup would hand the browser `undefined` in
 * production.
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

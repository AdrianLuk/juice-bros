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

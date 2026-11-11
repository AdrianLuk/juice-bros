/**
 * Env access for Mic Drop's Supabase connection.
 *
 * Mic Drop shares the Supabase project and the site sign-in with the other
 * apps, and nothing in the domain (CONTEXT-MAP.md), so it reads its own env
 * the way Team Tally and On Deck do: a few lines of deliberate duplication
 * keep the contexts independent. Each variable is spelled out as a literal
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

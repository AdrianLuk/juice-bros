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

/**
 * The `service_role` key — server-only, bypasses RLS. On Deck uses it for the
 * turn-notification send job (issue #260): it reads every opted-in Player's
 * push subscription for a Session and writes the idempotency log, neither of
 * which any single Player's grant allows. Spelled out as a literal
 * `process.env.X`, never `NEXT_PUBLIC_*`.
 */
export function requireSupabaseServiceRoleKey(
  source: EnvSource = { SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY },
): string {
  return requireEnv(source, "SUPABASE_SERVICE_ROLE_KEY");
}

export type WebPushEnv = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

/**
 * The VAPID keys for `web-push`, shared with Booking Buddy (issue #12) — a
 * deploy provisions one set. Returns `null` when any is unset: the turn
 * notification then degrades silently (issue #260), it is not a hard failure
 * the way the Supabase connection is.
 */
export function readWebPushEnv(
  source: EnvSource = {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_SUBJECT: process.env.VAPID_SUBJECT,
  },
): WebPushEnv | null {
  const publicKey = source.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = source.VAPID_PRIVATE_KEY?.trim();
  const subject = source.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) {
    return null;
  }
  return { publicKey, privateKey, subject };
}

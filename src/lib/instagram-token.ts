import { createClient } from "@vercel/edge-config";

const EDGE_CONFIG_KEY = "instagram_token";

/** Days before expiry at which the refresh cron rotates the token. */
export const REFRESH_LEAD_DAYS = 14;

export type StoredInstagramToken = {
  token: string;
  /** Unix seconds. `Infinity` for a hand-pasted env-var token with no known expiry. */
  expiresAt: number;
};

/**
 * The current long-lived Instagram token.
 *
 * Production reads it from Vercel Edge Config, where the refresh cron
 * (`/api/cron/refresh-instagram-token`) writes each rotated value - a plain env
 * var can't be updated at runtime and a running deployment never picks up a
 * changed one (see docs/adr/0003-instagram-token-in-edge-config.md). Local dev
 * has no Edge Config, so it falls back to the `INSTAGRAM_ACCESS_TOKEN` env var.
 * Either source missing just means "no feed" - callers treat an empty result
 * as fail-soft and hide the section.
 */
export async function getInstagramToken(): Promise<StoredInstagramToken | null> {
  const stored = await readFromEdgeConfig();
  if (stored) return stored;

  const envToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (envToken) {
    return { token: envToken, expiresAt: Number.POSITIVE_INFINITY };
  }
  return null;
}

async function readFromEdgeConfig(): Promise<StoredInstagramToken | null> {
  if (!process.env.EDGE_CONFIG) return null;
  try {
    const client = createClient(process.env.EDGE_CONFIG);
    const value = await client.get<StoredInstagramToken>(EDGE_CONFIG_KEY);
    if (value && typeof value.token === "string" && typeof value.expiresAt === "number") {
      return value;
    }
    return null;
  } catch (error) {
    console.error("instagram-token: Edge Config read failed", error);
    return null;
  }
}

/**
 * Persist a rotated token back to Edge Config via the Vercel API. Only the
 * refresh cron calls this. Needs `VERCEL_API_TOKEN` + `EDGE_CONFIG_ID`, plus
 * `VERCEL_TEAM_ID` when the project lives under a team.
 */
export async function writeInstagramToken(next: StoredInstagramToken): Promise<void> {
  const apiToken = process.env.VERCEL_API_TOKEN;
  const edgeConfigId = process.env.EDGE_CONFIG_ID;
  if (!apiToken || !edgeConfigId) {
    throw new Error("instagram-token: VERCEL_API_TOKEN or EDGE_CONFIG_ID is not configured.");
  }

  const url = new URL(`https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`);
  const teamId = process.env.VERCEL_TEAM_ID;
  if (teamId) url.searchParams.set("teamId", teamId);

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [{ operation: "upsert", key: EDGE_CONFIG_KEY, value: next }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`instagram-token: Edge Config write failed (${res.status}) ${detail}`);
  }
}

/**
 * Whether a stored token is close enough to expiry to rotate now. A 60-day
 * token refreshed with 14 days still on the clock survives any daily-cron
 * hiccup, and that lead keeps every refresh well above Instagram's "token must
 * be at least 24 hours old" floor. An env-var token (no real expiry) is never
 * refreshed.
 */
export function shouldRefreshToken(expiresAt: number, nowSeconds: number): boolean {
  if (!Number.isFinite(expiresAt)) return false;
  const leadSeconds = REFRESH_LEAD_DAYS * 24 * 60 * 60;
  return expiresAt - nowSeconds <= leadSeconds;
}

import "server-only";

import { headers } from "next/headers";

/**
 * Turns a path into an absolute URL using the current request's own host —
 * shared by every place that has to hand someone a real link (a magic-link/
 * OAuth callback, a Slot Link, the Gmail OAuth callback), so each one works
 * unchanged on localhost, a Vercel preview, and production without its own
 * per-environment config.
 */
export async function absoluteAppUrl(path: string): Promise<string> {
  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}${path}`;
}

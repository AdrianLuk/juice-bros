import "server-only";

import { headers } from "next/headers";

/**
 * Turns a path into an absolute URL using the current request's own host, so a
 * link the Organizer copies works unchanged on localhost, a Vercel preview, a
 * LAN IP (a phone on the club Wi-Fi), and production — without per-environment
 * config.
 *
 * On Deck keeps its own copy rather than importing Booking Buddy's
 * `absoluteAppUrl` — the two contexts are deliberately independent
 * (CONTEXT-MAP.md), the same reason `env.ts` is duplicated. This one also
 * honours `x-forwarded-proto` (set by Vercel and most proxies) before falling
 * back to a scheme guess, so a `http://192.168.x.x` phone link isn't rewritten
 * to an unreachable `https://`.
 */
export async function onDeckAbsoluteUrl(path: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";

  const forwardedProto = h.get("x-forwarded-proto")?.split(",")[0].trim();
  const isLocal =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  const protocol = forwardedProto ?? (isLocal ? "http" : "https");

  return `${protocol}://${host}${path}`;
}

import "server-only";

import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

/**
 * The access gate for the dev console (issue #351).
 *
 * Two independent checks stack on the route: this key *and* an Organizer
 * session (`verifyOrganizer`). The key alone is what keeps the route inert on
 * every deploy that hasn't opted in — with `ON_DECK_DEV_KEY` unset the console
 * 404s for everyone, exactly like `api/e2e-preflight` without `E2E_WEB_SERVER`.
 *
 * The console drives real Organizer actions through the caller's own session,
 * so there is no service-role escalation here — the key only decides whether
 * the page renders at all.
 */

export const ON_DECK_DEV_COOKIE = "on_deck_dev";

/** The configured dev key, or null when the route should be inert. */
export function onDeckDevKey(): string | null {
  const value = process.env.ON_DECK_DEV_KEY?.trim();
  return value ? value : null;
}

/** Constant-time string compare — the key is a shared secret in a URL / cookie. */
export function devKeyMatches(candidate: string, key: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(key);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Does this request carry a valid dev-access cookie? */
export async function hasDevAccess(): Promise<boolean> {
  const key = onDeckDevKey();
  if (!key) return false;
  const cookie = (await cookies()).get(ON_DECK_DEV_COOKIE)?.value ?? "";
  return cookie.length > 0 && devKeyMatches(cookie, key);
}

/** 404 unless this request carries a valid dev-access cookie. */
export async function verifyDevAccess(): Promise<void> {
  if (!(await hasDevAccess())) {
    notFound();
  }
}

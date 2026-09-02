import "server-only";

import { readCalendarFeedAllowedHosts } from "./env.ts";
import { validateFeedUrl } from "./calendar-feed-url.ts";

/**
 * The one place an actual `fetch` to a User-pasted CourtReserve calendar-feed
 * URL happens (issue #294, ADR-0019's "Consequences"). Everything downstream —
 * `parseIcsFeed`, `parseCourtReserveFeed`, `reviewCalendarFeed` — is pure and
 * takes the fetched text as a string; this module is the SSRF-hardened
 * transport around it.
 *
 * Deliberately not unit tested: it is glue over a real network call, exercised
 * by Playwright against the local ICS mock (`e2e/support/calendar-feed-mock.ts`),
 * same seam posture as `google-places-client.ts` / the mail adapters.
 *
 * The SSRF guards, all enforced here:
 *
 *   - **Host re-validated at fetch time.** The save-time check
 *     (`validateFeedUrl`) is not trusted to still hold — the stored ciphertext
 *     could predate a tightened allowlist, or a bug elsewhere. The host is
 *     checked again here against the same allowlist (CourtReserve + the
 *     test-only `CALENDAR_FEED_ALLOWED_HOSTS` widening).
 *   - **`https:` only** — re-checked here too, not inferred from the earlier
 *     validation.
 *   - **Redirects rejected** (`redirect: "manual"`): a 3xx is treated as a
 *     failure rather than followed, so a CourtReserve URL cannot bounce the
 *     request to an internal host.
 *   - **Request timeout** (`AbortSignal.timeout`).
 *   - **Response-size cap** — the body is read in bounded chunks and the read
 *     aborted past the cap, so a hostile endpoint streaming gigabytes cannot
 *     exhaust memory.
 *   - **No cookies, no auth headers** — a bare GET with only `Accept`; the
 *     member token is already in the URL's path/query and CourtReserve needs
 *     nothing else.
 *   - **The URL never reaches a log or an error string.** Every `console.error`
 *     and every returned `reason` names the failure class only. The URL
 *     carries a private member token (spec #288, user stories 31/32).
 */

const FETCH_TIMEOUT_MS = 10_000;

/** 5 MiB. A real per-club member feed is a few hundred KiB at most. */
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export type FeedFetchOutcome =
  | { ok: true; text: string }
  /**
   * `blocked` — the URL failed the fetch-time host/scheme re-check (should be
   * unreachable for a URL that passed save-time validation, but the guard is
   * independent on purpose). `unreachable` — network error, timeout, non-2xx,
   * a redirect, or a body over the size cap. Neither carries the URL.
   */
  | { ok: false; reason: "blocked" | "unreachable" };

/**
 * Reads a `Response` body as text, aborting once `MAX_RESPONSE_BYTES` have
 * been seen. `response.text()` would buffer the whole thing first; this caps
 * it. Returns `null` when the cap is exceeded.
 */
async function readCappedText(response: Response): Promise<string | null> {
  const body = response.body;
  if (!body) {
    return "";
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(merged);
}

/**
 * Fetch one feed's raw `.ics` body. `rawUrl` is the decrypted stored URL.
 *
 * The decrypt itself is the caller's job (`syncFacilityFeed` in
 * `actions/calendar-feed.ts`) — this only takes the plaintext URL and does the
 * hardened GET.
 */
export async function fetchCalendarFeed(rawUrl: string): Promise<FeedFetchOutcome> {
  const validated = validateFeedUrl(rawUrl, readCalendarFeedAllowedHosts());
  if (!validated.ok) {
    // The save-time guard should have caught this; if we are here the stored
    // value is stale against a tightened allowlist, or was written around the
    // action. Fail closed, and say nothing about the URL.
    console.error("booking-buddy: a stored calendar-feed URL failed the fetch-time host check");
    return { ok: false, reason: "blocked" };
  }

  let response: Response;
  try {
    response = await fetch(validated.url, {
      method: "GET",
      headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.1" },
      // A 3xx is a failure, not a hop — a CourtReserve URL must not be able to
      // redirect the request onto an internal address.
      redirect: "manual",
      // Undici sends no cookies by default and there is no cookie jar here;
      // spelling it out as documentation of intent.
      credentials: "omit",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    console.error("booking-buddy: a calendar feed was unreachable (network error or timeout)");
    return { ok: false, reason: "unreachable" };
  }

  // `redirect: "manual"` surfaces a 3xx as an opaque-redirect response
  // (status 0) or a real 3xx status — either way, not something to follow.
  if (response.status >= 300 && response.status < 400) {
    console.error("booking-buddy: a calendar feed responded with a redirect; not following it");
    return { ok: false, reason: "unreachable" };
  }

  if (!response.ok) {
    console.error("booking-buddy: a calendar feed responded with a non-2xx status", response.status);
    return { ok: false, reason: "unreachable" };
  }

  const text = await readCappedText(response);
  if (text === null) {
    console.error("booking-buddy: a calendar feed response exceeded the size cap");
    return { ok: false, reason: "unreachable" };
  }

  return { ok: true, text };
}

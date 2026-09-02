/**
 * The one rule for what counts as a usable CourtReserve calendar-feed URL
 * (issue #294, ADR-0019) — checked at save time so a bad paste is rejected
 * with a reason, and again at fetch time as the SSRF host guard, off the same
 * function so the two can't drift.
 *
 * Pure and relative-import-only, same discipline as `import-candidate-shaping.ts`:
 * the env-var widening for tests (`CALENDAR_FEED_ALLOWED_HOSTS`) is read by the
 * caller and passed in as `extraAllowedHosts`, never reached for here.
 *
 * The URL carries a private member token, so nothing in here — no thrown
 * error, no return value — ever echoes the URL back. A rejection names the
 * rule that failed ("must be an https:// address", "must be a courtreserve.com
 * address"), not the offending value.
 */

/** CourtReserve's own domain. A feed URL's host must be this or a subdomain of it. */
const COURTRESERVE_DOMAIN = "courtreserve.com";

/**
 * Whether `host` is `courtreserve.com` or a subdomain of it — an exact suffix
 * match on a dot boundary, case-insensitive. `evilcourtreserve.com` and
 * `courtreserve.com.attacker.net` both fail; `app.courtreserve.com` passes.
 */
export function isCourtReserveHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === COURTRESERVE_DOMAIN ||
    normalized.endsWith(`.${COURTRESERVE_DOMAIN}`)
  );
}

/**
 * Whether `host` is allowed at all — a CourtReserve host, or one of the
 * `extraAllowedHosts` the caller widened the list with (the test-only
 * `CALENDAR_FEED_ALLOWED_HOSTS` mock override; empty in every real
 * environment). An extra host matches exactly, no subdomain logic — it names a
 * single mock server.
 */
export function isAllowedFeedHost(
  host: string,
  extraAllowedHosts: readonly string[] = [],
): boolean {
  const normalized = host.trim().toLowerCase();
  return isCourtReserveHost(normalized) || extraAllowedHosts.includes(normalized);
}

export type FeedUrlOutcome =
  | { ok: true; url: string; host: string }
  | { ok: false; reason: string };

/**
 * Parses and validates a pasted feed URL: a well-formed `https:` URL whose
 * host is on the allowlist. On success returns the normalized URL string and
 * its host (the host so a fetch-time re-check needs no second parse). Never
 * throws, and never puts the input in `reason`.
 */
export function validateFeedUrl(
  raw: string,
  extraAllowedHosts: readonly string[] = [],
): FeedUrlOutcome {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: false, reason: "Paste your CourtReserve calendar-feed link." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, reason: "That doesn't look like a web address. Copy the whole link." };
  }

  const normalizedHost = parsed.hostname.trim().toLowerCase();
  const isExtraHost = extraAllowedHosts.includes(normalizedHost);

  // `https:` only for a real CourtReserve URL. An extra host is the test-only
  // mock (`CALENDAR_FEED_ALLOWED_HOSTS`), which speaks plain HTTP on
  // 127.0.0.1 — same practical `https:`→`http:` downgrade `GMAIL_API_BASE_URL`
  // already carries for the Gmail mock, with the same accepted, test-only risk.
  if (parsed.protocol !== "https:" && !(isExtraHost && parsed.protocol === "http:")) {
    return { ok: false, reason: "The link has to be an https:// address." };
  }

  if (!isCourtReserveHost(normalizedHost) && !isExtraHost) {
    return {
      ok: false,
      reason: "That isn't a CourtReserve address. The link should be to courtreserve.com.",
    };
  }

  return { ok: true, url: parsed.toString(), host: normalizedHost };
}

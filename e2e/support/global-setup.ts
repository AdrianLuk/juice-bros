import type { FullConfig } from "@playwright/test";

/**
 * Runs once, after `webServer` is up and before any spec.
 *
 * Guards the one setup mistake that otherwise costs a confusing half-hour: the
 * fixture-mock env (`GOOGLE_PLACES_API_BASE_URL`, `GMAIL_API_BASE_URL`,
 * `MICROSOFT_API_BASE_URL`, `EMAIL_SYNC_ALLOWLIST`) is baked into
 * `webServer.env` and only applies when Playwright starts the server. If a
 * `next dev` is already on :3000, Playwright reuses it (`reuseExistingServer`)
 * without those overrides, and `places.spec.ts` / `email-sync.spec.ts` /
 * `outlook-*.spec.ts` quietly hit the real Google/Microsoft APIs — a dozen
 * opaque failures instead of one clear one.
 *
 * `/api/e2e-preflight` echoes the mock env, and 404s unless `E2E_WEB_SERVER=1`
 * (set only by `playwright.config.ts`). A 404 here means the server under test
 * isn't the one Playwright configured.
 *
 * Set `E2E_SKIP_PREFLIGHT=1` to bypass — for the rare deliberate run against a
 * hand-started server where the API-mocking specs aren't what you're after.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  if (process.env.E2E_SKIP_PREFLIGHT === "1") return;

  const baseURL =
    config.projects[0]?.use.baseURL ?? "http://localhost:3000";
  const url = new URL("/api/e2e-preflight", baseURL);

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (cause) {
    throw new Error(
      `e2e preflight: couldn't reach ${url} — is the app serving on ${baseURL}?`,
      { cause },
    );
  }

  if (!res.ok) {
    throw new Error(
      [
        `e2e preflight failed: ${url} returned ${res.status}.`,
        "",
        "Playwright is testing a server it didn't start — almost always a",
        "`next dev` you have open on :3000, which it reuses as-is. That server",
        "is missing the fixture-mock env (GOOGLE_PLACES_API_BASE_URL,",
        "GMAIL_API_BASE_URL, MICROSOFT_API_BASE_URL, EMAIL_SYNC_ALLOWLIST), so",
        "the API-mocking specs would run against the real Google/Microsoft APIs.",
        "",
        "Fix: stop that dev server and re-run `npm run test:e2e` (Playwright will",
        "build + start its own), or `PLAYWRIGHT_DEV_SERVER=1 npm run test:e2e` to",
        "have Playwright run the dev server itself. Set E2E_SKIP_PREFLIGHT=1 to",
        "bypass this check.",
      ].join("\n"),
    );
  }

  const env = (await res.json()) as Record<string, string | null>;
  const missing = Object.entries(env)
    .filter(([, value]) => value === null)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(
      `e2e preflight: the server is E2E_WEB_SERVER=1 but these mock env vars ` +
        `are unset: ${missing.join(", ")}. Check playwright.config.ts's webServer.env.`,
    );
  }
}

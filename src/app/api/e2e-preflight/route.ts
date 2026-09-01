import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A liveness probe for the e2e suite's `globalSetup` (`e2e/support/global-setup.ts`).
 *
 * `playwright.config.ts` bakes the fixture-mock base URLs
 * (`GOOGLE_PLACES_API_BASE_URL`, `GMAIL_API_BASE_URL`, `MICROSOFT_API_BASE_URL`,
 * `EMAIL_SYNC_ALLOWLIST`, …) into `webServer.env` — but only when Playwright
 * starts the server itself. If a `next dev` is already on :3000 it's reused
 * as-is (`reuseExistingServer: true`) and those overrides are absent, so
 * `places.spec.ts` / `email-sync.spec.ts` / `outlook-*.spec.ts` silently run
 * against the real Google/Microsoft APIs. `globalSetup` calls this route and
 * aborts the run with a clear message when the mock env isn't in effect.
 *
 * Inert everywhere else: it 404s unless `E2E_WEB_SERVER=1`, which nothing but
 * `playwright.config.ts`'s `webServer.env` ever sets — so it can't leak the
 * allowlist (a list of Usernames) from a real deploy.
 */
export function GET() {
  if (process.env.E2E_WEB_SERVER !== "1") {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.json({
    googlePlacesApiBaseUrl: process.env.GOOGLE_PLACES_API_BASE_URL ?? null,
    gmailApiBaseUrl: process.env.GMAIL_API_BASE_URL ?? null,
    microsoftApiBaseUrl: process.env.MICROSOFT_API_BASE_URL ?? null,
    emailSyncAllowlist: process.env.EMAIL_SYNC_ALLOWLIST ?? null,
  });
}

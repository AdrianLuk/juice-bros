import { defineConfig, devices } from "@playwright/test";

import { GOOGLE_PLACES_MOCK_URL } from "./e2e/support/google-places-mock.ts";
import { GMAIL_MOCK_URL } from "./e2e/support/gmail-mock.ts";
import { MICROSOFT_MOCK_URL } from "./e2e/support/microsoft-mock.ts";

/**
 * Browser tests, kept apart from `npm test`.
 *
 * `npm test` is `node --test` over `src/**` and must stay fast and
 * dependency-free; these need a running app *and* the local Supabase stack, so
 * they live in `e2e/` and run under `npm run test:e2e`. See
 * booking-buddy/docs/testing.md for what has to be up first.
 */
export default defineConfig({
  testDir: "./e2e",
  // Server Actions mutate shared rows in one local database, so two workers
  // racing on the same account would fight over each other's groups.
  workers: 1,
  fullyParallel: false,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    // Kept only for failures — a passing run shouldn't leave artefacts behind.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    // Reuses the dev server you already have open, rather than fighting it for
    // the port. Next refuses to start a second one anyway.
    reuseExistingServer: true,
    timeout: 120_000,
    // Only takes effect when Playwright starts the server itself — i.e.
    // always in CI, where nothing is already listening on :3000. A locally
    // reused dev server keeps whatever's in its own `.env` (the real Google
    // host by default), which is why e2e/places.spec.ts needs a dev server
    // that *wasn't* already running to get the mock — see testing.md.
    env: {
      GOOGLE_PLACES_API_BASE_URL: GOOGLE_PLACES_MOCK_URL,
      // The mock never validates this; a placeholder keeps CI from needing a
      // real key provisioned just to run tests that never call Google.
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY ?? "test-key-for-e2e",
      // Issue #62's Gmail sync (email-sync.spec.ts) — same collapsing-mock
      // shape as Places above, see gmail-mock.ts.
      GMAIL_API_BASE_URL: GMAIL_MOCK_URL,
      GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "test-client-id-for-e2e",
      GOOGLE_OAUTH_CLIENT_SECRET:
        process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "test-client-secret-for-e2e",
      // Spec #280's Outlook / Hotmail provider (outlook-connect.spec.ts) — same
      // collapsing-mock shape as Gmail above, see microsoft-mock.ts. Setting
      // MICROSOFT_OAUTH_CLIENT_ID is also what makes the "Connect Outlook"
      // button render at all.
      MICROSOFT_API_BASE_URL: MICROSOFT_MOCK_URL,
      MICROSOFT_OAUTH_CLIENT_ID:
        process.env.MICROSOFT_OAUTH_CLIENT_ID ?? "test-ms-client-id-for-e2e",
      MICROSOFT_OAUTH_CLIENT_SECRET:
        process.env.MICROSOFT_OAUTH_CLIENT_SECRET ?? "test-ms-client-secret-for-e2e",
      // A throwaway 32-byte key — real ones are generated per docs in
      // .env.example and never checked in.
      MAILBOX_LINK_ENCRYPTION_KEY:
        process.env.MAILBOX_LINK_ENCRYPTION_KEY ??
        "AQLUlv/74SRdU//nBKzF5XhSna1Vm6jEdcbt5AplNuQ=",
      // Only Ben is approved in this fixture list — email-sync.spec.ts relies
      // on Amy being unlisted to prove the section stays absent for her.
      EMAIL_SYNC_ALLOWLIST: process.env.EMAIL_SYNC_ALLOWLIST ?? "benbackhand",
    },
  },
});

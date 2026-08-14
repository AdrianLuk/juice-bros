import { defineConfig, devices } from "@playwright/test";

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
  },
});

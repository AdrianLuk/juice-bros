import { test as base } from "@playwright/test";

import {
  TEST_PASSWORD,
  TEST_WORKER_COUNT,
  workerAccountSet,
  type WorkerAccountSet,
} from "./account-sets.ts";

/**
 * One Playwright worker's private set of the four Booking Buddy accounts, so
 * `workers > 1` doesn't have two workers writing the same account's rows.
 *
 * Import `test` / `expect` from here instead of `@playwright/test` in any spec
 * that signs in as a seeded account, and reach for `accounts.amy.email` /
 * `accounts.ben2.username` rather than a hard-coded constant. Specs that only
 * use fresh throwaway signups (onboarding, on-deck, pickle-point-pal) don't
 * need this — their accounts are already unique per run.
 *
 * The sets are seeded by `npm run seed:users` (via `pretest:e2e`); keep
 * `E2E_WORKER_COUNT` >= `playwright.config.ts`'s `workers`.
 */
export type Accounts = WorkerAccountSet & { password: string };

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const test = base.extend<{}, { accounts: Accounts }>({
  accounts: [
    async ({}, use, workerInfo) => {
      if (workerInfo.parallelIndex >= TEST_WORKER_COUNT) {
        throw new Error(
          `Worker parallelIndex ${workerInfo.parallelIndex} has no seeded account set ` +
            `(E2E_WORKER_COUNT=${TEST_WORKER_COUNT}). Raise E2E_WORKER_COUNT and re-run ` +
            `\`npm run seed:users\`, or lower \`workers\` in playwright.config.ts.`,
        );
      }
      await use({
        ...workerAccountSet(workerInfo.parallelIndex),
        password: TEST_PASSWORD,
      });
    },
    { scope: "worker" },
  ],
});

export const expect = test.expect;

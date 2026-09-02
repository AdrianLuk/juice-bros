/**
 * The Booking Buddy local test accounts — the single source of truth shared by
 * the seed script (`scripts/seed-booking-buddy-users.mts`) and the Playwright
 * `accounts` fixture (`accounts.ts`). Pure data, no side effects, so the seed
 * script can import it without pulling in `@playwright/test`.
 *
 * Local-only: these addresses have no inbox and the password is public on
 * purpose. See `booking-buddy/docs/local-test-accounts.md`.
 */

export const TEST_PASSWORD = "pickleball123";

export type TestAccount = { email: string; displayName: string; username: string };

/**
 * The four hand-clickable accounts documented in local-test-accounts.md.
 * Their Usernames are trigger-derived (first "Amy Ace" → `amyace`, second →
 * `amyace2`), which is why creation order matters for these.
 */
export const LEGACY_ACCOUNTS: TestAccount[] = [
  { email: "amyace@example.com", displayName: "Amy Ace", username: "amyace" },
  { email: "benbackhand@example.com", displayName: "Ben Backhand", username: "benbackhand" },
  { email: "amyace2@example.com", displayName: "Amy Ace", username: "amyace2" },
  { email: "benbackhand2@example.com", displayName: "Ben Backhand", username: "benbackhand2" },
];

/**
 * How many per-worker account sets the seed script creates. Keep this >= the
 * `workers` in `playwright.config.ts` — the `accounts` fixture maps
 * `testInfo.parallelIndex` (0-based) onto `workerAccountSet(index)`.
 */
export const TEST_WORKER_COUNT = Number(process.env.E2E_WORKER_COUNT ?? 4);

export type WorkerAccountSet = {
  amy: TestAccount;
  ben: TestAccount;
  /** Seeded stranger to `ben2` — the two-sided friend-request journeys need a pair not yet connected. */
  amy2: TestAccount;
  ben2: TestAccount;
};

/**
 * Worker `index`'s copy of the four accounts. Display name stays "Amy Ace" /
 * "Ben Backhand" (specs assert on that literal, and two-of-each-name is the
 * deliberate ADR 0004 ambiguity), so the seed script PATCHes the Username to
 * the fixed value here rather than letting the trigger number the collisions.
 */
export function workerAccountSet(index: number): WorkerAccountSet {
  return {
    amy: { email: `amyace-w${index}@example.com`, displayName: "Amy Ace", username: `amyacew${index}` },
    ben: { email: `benbackhand-w${index}@example.com`, displayName: "Ben Backhand", username: `benbackhandw${index}` },
    amy2: { email: `amyace2-w${index}@example.com`, displayName: "Amy Ace", username: `amyace2w${index}` },
    ben2: { email: `benbackhand2-w${index}@example.com`, displayName: "Ben Backhand", username: `benbackhand2w${index}` },
  };
}

/** Every per-worker Ben, for `EMAIL_SYNC_ALLOWLIST` in playwright.config.ts. */
export function allWorkerBenHandles(): string[] {
  return Array.from({ length: TEST_WORKER_COUNT }, (_, i) => workerAccountSet(i).ben.username);
}

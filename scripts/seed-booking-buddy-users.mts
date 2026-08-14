/**
 * Creates the local Booking Buddy test accounts. Run against the local
 * Supabase stack only:
 *
 *   npm run seed:users
 *
 * Idempotent — re-run it after `supabase db reset` (which wipes auth.users)
 * or any time you're not sure the accounts are there.
 *
 * Goes through the Auth admin API rather than `supabase/seed.sql`, because
 * inserting into `auth.users` by hand means hand-rolling password hashes and
 * identity rows that GoTrue owns. The admin API is the supported door, and it
 * fires the same signup trigger real users do — so these accounts get their
 * profile and Username the normal way, rather than a fixture that drifts from
 * how signup actually behaves.
 *
 * Accounts and passwords are documented in
 * booking-buddy/docs/local-test-accounts.md.
 */

/** Local Docker stack only. These are Supabase's published demo keys. */
const API_URL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

export const TEST_PASSWORD = "pickleball123";

/**
 * Order matters. Usernames are derived from the display name at signup, so the
 * first "Amy Ace" takes `amyace` and the second falls through to `amyace2` —
 * which is what keeps each email's local part equal to that account's Username
 * across a reset. Reorder these and the numbering swaps.
 */
export const TEST_ACCOUNTS = [
  { email: "amyace@example.com", displayName: "Amy Ace" },
  { email: "benbackhand@example.com", displayName: "Ben Backhand" },
  { email: "amyace2@example.com", displayName: "Amy Ace" },
  { email: "benbackhand2@example.com", displayName: "Ben Backhand" },
];

if (!API_URL.includes("127.0.0.1")) {
  console.error("Refusing to run: this script is for the local stack only.");
  process.exit(1);
}

async function createUser({
  email,
  displayName,
}: {
  email: string;
  displayName: string;
}): Promise<"created" | "exists"> {
  const response = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password: TEST_PASSWORD,
      // Skips the confirmation email — there is no inbox to click through.
      email_confirm: true,
      user_metadata: { display_name: displayName },
    }),
  });

  if (response.ok) {
    return "created";
  }

  const body = await response.text();
  if (response.status === 422 && body.includes("already been registered")) {
    return "exists";
  }

  throw new Error(`Creating ${email} failed (${response.status}): ${body}`);
}

let created = 0;

for (const account of TEST_ACCOUNTS) {
  const result = await createUser(account);
  if (result === "created") created += 1;
  console.log(`${result === "created" ? "created" : "already there"}  ${account.email}`);
}

console.log(
  `\n${created} created, ${TEST_ACCOUNTS.length - created} already existed. Password for all: ${TEST_PASSWORD}`,
);

# Testing Booking Buddy

Three suites, deliberately separate because they need different things running.

| Command | What it covers | Needs |
| --- | --- | --- |
| `npm test` | Pure logic — visibility resolution, Connection grouping, routes, env | nothing |
| `npm run test:rls` | Schema, constraints, triggers and RLS policies (pgTAP) | Docker + `supabase start` |
| `npm run test:e2e` | The real pages in a real browser (Playwright) | Docker + `supabase start` + test accounts |

`npm test` is the one to run constantly — it is a second or two and has no
dependencies. The other two need the local stack up.

## Getting the local stack up

```
supabase start          # Docker must be running
npm run seed:users      # the four test accounts, idempotent
```

Accounts and passwords are in [local-test-accounts.md](local-test-accounts.md).
They only exist locally and none of it is secret.

If you've pulled new migrations, apply them without wiping your data:

```
supabase migration up --local
```

`supabase db reset` also works but destroys everything, including the test
accounts — re-run `npm run seed:users` afterwards.

## Clicking through it yourself

```
npm run dev
```

Then open <http://localhost:3000/booking-buddy/sign-in>, choose **Sign in with a
password**, and use one of the test accounts. Booking Buddy isn't linked from
the main nav yet, so navigate by URL:

- `/booking-buddy` — dashboard, with links to the two pages below
- `/booking-buddy/friends` — search, requests, your friends
- `/booking-buddy/groups` — friend groups and per-friend visibility

Signing in as a second account in the same browser will replace the first
session. Use a private window for the two-user flows (sending a request from
one account and accepting it from the other).

## The browser tests

```
npm run test:e2e                    # all of it, headless
npx playwright test --headed        # watch it happen
npx playwright test --ui            # pick tests, step through, time-travel
npx playwright test --debug         # pause on each action
npx playwright show-report          # after a failure
```

They reuse a dev server if one is already on port 3000, and start one if not.

Some things worth knowing before writing more of them:

- **They mutate the local database**, as any real click does. Each test deletes
  the group it made, and `afterEach` sweeps up anything a failed run left
  behind — without that, strays pile up one per broken run.
- **`workers: 1`, deliberately.** Two tests writing the same account's groups at
  once would fight over each other's rows.
- **Address friends by Username, never by display name.** The local data holds
  two "Ben Backhand"s on purpose (that ambiguity is why Usernames exist — see
  [adr/0004-user-search-is-not-a-directory.md](adr/0004-user-search-is-not-a-directory.md)),
  so a locator matching on the name will silently pick whichever it finds
  first. This is not hypothetical: it is how the first version of these tests
  failed, and how the group member picker was found showing bare display names
  with no way to tell the two apart.

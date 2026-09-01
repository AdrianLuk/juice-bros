# Testing Booking Buddy

Three suites, deliberately separate because they need different things running.

| Command | What it covers | Needs |
| --- | --- | --- |
| `npm test` | Pure logic — visibility resolution, username rules, form parsing, Connection grouping, routes | nothing |
| `npm run test:rls` | Schema, constraints, triggers and RLS policies (pgTAP) | Docker + `supabase start` |
| `npm run test:e2e` | The real pages in a real browser (Playwright) | Docker + `supabase start` + test accounts |

`npm test` is the one to run constantly — it is a second or two and has no
dependencies. The other two need the local stack up.

**Where a new test goes.** If it can be decided without a database, it belongs
in `npm test` — and if the logic is currently stuck inside a Server Action,
extract it rather than reaching for a heavier tool. If the rule is enforced by
a constraint, trigger or policy, it belongs in pgTAP. If it spans several
actions or two Users, it belongs in Playwright. See "Seams under test" in
[../PROGRESS.md](../PROGRESS.md) for why the plan changed to this.

## Getting the local stack up

```
supabase start          # Docker must be running
npm run seed:users      # the four test accounts and their friendships, idempotent
```

Accounts and passwords are in [local-test-accounts.md](local-test-accounts.md).
They only exist locally and none of it is secret. `seed:users` also restores the
two accepted Connections the browser tests assume — without them five of those
tests fail for reasons unrelated to the code under test.

If you've pulled new migrations, apply them without wiping your data:

```
supabase migration up --local
```

`supabase db reset` also works but destroys everything, including the test
accounts and their friendships — re-run `npm run seed:users` afterwards. A reset
is the right move when a migration has been **rewritten in place** rather than
added, since `migration up` has no way to undo the old version.

## Clicking through it yourself

```
npm run dev
```

Then open <http://localhost:3000/booking-buddy/sign-in>, choose **Sign in with a
password**, and use one of the test accounts. Booking Buddy isn't linked from
the main nav yet, so navigate by URL:

- `/booking-buddy` — dashboard, with links to the pages below
- `/booking-buddy/friends` — search, requests, your friends, and per-friend
  visibility
- `/booking-buddy/groups` — friend groups
- `/booking-buddy/orgs` — the places you play
- `/booking-buddy/bookings` — court reservations you've logged
- `/booking-buddy/slots` — post a slot, then open one to find its "Invite
  link" section — that's a Slot Link (issue #10). Paste the generated
  `/s/[token]` URL into a private/incognito window to try the Guest RSVP path
  with no account at all.
- `/booking-buddy/settings` — change your username

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

**The server they run against.** If something is already listening on port 3000
(a `next dev` you have open), they reuse it as-is. If nothing is, Playwright
builds the app and serves it with `next start` — a production build skips the
dev server's compile-on-first-request tax, which is most of a full run's wall
time. Set `PLAYWRIGHT_DEV_SERVER=1` to make Playwright run `next dev` itself
instead (HMR beats a rebuild when you're iterating on one spec with `--ui`).
Next 16 keeps dev output in `.next/dev` and prod in `.next`, so the two never
clash.

**Sign-in is cached.** `signIn()` drives the real form the first time it's
asked for an account, then replants that session's cookies on every later call
in the same run — a seeded-account sign-in costs one `goto`, not a form
round-trip. `signUp()` (fresh throwaway accounts) is untouched. See
`e2e/support/sign-in.ts` for why it's safe (the session's access token
outlives any single run).

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
- **Scope locators to a section, and end with `.last()`.** The same person
  appears in up to three places on the friends page at once — a search result,
  a pending request, and a friend — all carrying the same handle. Both specs
  have a `section(page, heading)` helper for this. `.last()` is load-bearing:
  the page's own wrapper `<section>` contains every heading too, so an
  unqualified filter matches the wrapper as well as the section you meant.
- **`getByRole("alert")` matches Next's route announcer.** Every navigation
  leaves a `role="alert"` div holding the page title, so an unscoped alert
  locator is ambiguous the moment a real error appears. Scope it —
  `page.locator("form").getByRole("alert")`.
- **After clicking, wait for the effect before navigating.** These forms post
  to Server Actions that `revalidatePath`; a `goto` fired straight after a
  click reads the page from before the write landed. Assert on something that
  changes (a section disappearing, a count going up) and let Playwright wait.
- **Two Users means two browser contexts.** Signing in as a second account on
  the same context replaces the first session rather than adding one. See
  `friends.spec.ts`.
- **A search-result row and its "Your places" row can both be on screen at
  once, with the same text.** The client-side search state doesn't clear
  itself just because a pick succeeded. A locator matching "any listitem with
  this text" is ambiguous the moment both exist — worse, it can make a
  `toBeVisible()` wait pass instantly against the *pre-existing* candidate
  row, before the pick's mutation has actually finished, which then races
  ahead of assertions that depend on it. `places.spec.ts`'s `orgRow`/
  `candidateRow` helpers disambiguate by which button the row has
  ("Remove" vs "Add this place").
- **`page.route()` can't mock a server-side `fetch`.** It only intercepts
  requests the *browser* makes; a Server Action's own `fetch` (Google Places,
  here) runs in the Next.js server process and never goes near the page's
  network stack. `e2e/places.spec.ts` mocks it with a real local HTTP server
  (`e2e/support/google-places-mock.ts`) and a `GOOGLE_PLACES_API_BASE_URL` env
  override baked into `playwright.config.ts`'s `webServer.env` — which only
  takes effect when Playwright starts the dev server itself. **If you already
  have `npm run dev` running on :3000, `e2e/places.spec.ts` will hit the real
  Google API against your own key instead of the mock** (reused per
  `reuseExistingServer: true`, same as any other spec). Stop your dev server
  first if you want that file mocked locally; CI always gets the override
  since nothing is already listening.
- **A test that writes real rows to `place_cache` has to clean them up
  itself.** The app has no action that evicts a cached Place (ADR 0005), so
  `place_cache` only ever grows through normal use — including through these
  tests, which write real committed rows via the mocked pick flow. Left
  alone, that breaks pgTAP's `orgs_and_bookings.test.sql`, which assumes the
  table starts empty. `places.spec.ts`'s `afterAll` deletes everything it
  cached, direct against Postgres with the same published local `service_role`
  key `scripts/seed-booking-buddy-users.mts` uses — the app's own "Remove
  place" only ever removes the Org, never the shared cached Place behind it,
  by design. If a future test caches a Place, give it the same cleanup or
  `npm run test:rls` will fail with a stale row count.

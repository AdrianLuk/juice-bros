# Booking Buddy — Implementation Plan

Built test-first, in vertical slices: one seam, one red test, one minimal green implementation, repeat. No horizontal slicing (no writing a batch of tests before any implementation). Refactoring happens at review time, not inside the red→green loop itself.

**Seams under test** — *revised after Phase 3, replacing the original plan. Read this before writing a test.*

The plan opened with "Server Actions are the primary seam: call the action, assert through another read action." Two phases shipped without a single test like that, because the actions kept turning out to have nothing testable in them — session check, parse the form, one Supabase call, map the error. Testing that needs a Next.js request context and a live database, and would mostly be testing Supabase. Rather than keep the rule and keep breaking it, the seams are now:

1. **Pure functions** — `node --test`, no dependencies, run constantly. Anything decidable without a database belongs here, and getting it here is a design job: input parsing and error-message mapping get *extracted out* of the actions (`friend-groups.ts`, `username.ts`, `visibility.ts`, `connections.ts`) rather than left inline and declared untestable. **If an action has interesting logic in it, that's the signal to pull the logic out, not to build a harness.**
2. **The database** — pgTAP, for anything the schema itself enforces: RLS (the ADR 0003 safety net), constraints, triggers. These query Postgres directly, on purpose.
3. **The browser** — Playwright, for journeys across several actions and both Users. This is what covers the actions end to end, and it earns its keep: it found the ambiguous member picker that two review passes missed.

What's left in a Server Action after that is glue, and glue is covered by 3.

**How to run any of this**: see [docs/testing.md](docs/testing.md) — what each suite needs running, and how to click through the app yourself.

**Test tooling**: `node --test` over `src/**/*.test.ts` for the pure functions; `supabase test db` (pgTAP) for the database; Playwright over `e2e/` for the browser. The last two need Docker and the local Supabase stack up.

**Proposed file layout** (extends the existing `src/components/apps/<slug>` convention):
- `src/app/booking-buddy/` — routes (auth-gated layout, per Q2)
- `src/lib/booking-buddy/actions/` — Server Actions (`connections.ts`, `friend-groups.ts`, `slots.ts`, `responses.ts`, `slot-links.ts`, `reminders.ts`), each colocated with its `.test.ts`
- `src/lib/booking-buddy/` — pure business-logic functions with no Next.js/DB dependency (`visibility.ts`, `capacity.ts`), colocated with tests
- `src/components/booking-buddy/` — components
- `supabase/migrations/` — schema + RLS policies (standard Supabase CLI convention)

---

## Phase 0 — Tooling & scaffolding

Not TDD (no behavior yet) — infra setup only. Tracked as issue #3.

- [x] 0.1 Install Supabase CLI, `supabase init`, confirm `supabase start` works locally (Docker required)
- [x] 0.2 Add `@supabase/supabase-js`, `@supabase/ssr`, `@tanstack/react-query` to `package.json`
- [x] 0.3 Scaffold `src/app/booking-buddy/` as its own top-level route group (Q2). Gating is **not** in `layout.tsx` — the sign-in page lives beneath that layout, so gating there would lock people out of the page they need. Instead: `src/proxy.ts` (optimistic, per Next.js 16 guidance) plus `verifySession` in each protected page/Server Action (authoritative).
- [x] 0.4 Add Supabase env vars to `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `SUPABASE_DB_URL`. `.env.example` is now git-tracked (a `!.env.example` negation in `.gitignore`) and holds placeholders only.
- [x] 0.5 Add `test:rls` script — uses the Supabase CLI's native pgTAP runner (`supabase test db`) against `supabase/tests/*.test.sql`, separate from the default `test` script so quick runs aren't blocked on Docker being up.

### Notes carried out of Phase 0

- **Middleware is called Proxy in Next.js 16.** The file is `src/proxy.ts`, not `middleware.ts`. Next's own docs are explicit that it must not be the only line of defence, which is why the DAL (`src/lib/booking-buddy/dal.ts`) sits beneath it and coarse RLS beneath that (ADR 0003).
- **`NEXT_PUBLIC_*` must be read as literals.** Next only inlines these into the browser bundle where `process.env.NEXT_PUBLIC_X` appears verbatim; a dynamic lookup or an alias of `process.env` yields `undefined` in the browser. `readPublicSupabaseEnv` handles this — don't "simplify" it back to a dynamic read.

### Hosted environment

- [x] Schema is current as of the orgs/bookings/place_cache migration (2026-08-14). `npx supabase migration list` compares local against remote and is the quickest way to check whether that is still true — do it before assuming a hosted bug is a code bug.

- [x] Hosted Supabase project `juice-bros` (ref `zhvhddzpgxtjdyrhgsqd`, region `ca-central-1`, Postgres 17), linked to this repo via `supabase link` — so `supabase db push` targets it.
- [x] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` set on the Vercel project for Production and Preview, the service-role key marked sensitive. Repo linked to Vercel (`lukabaseballs-projects/juice-bros`).

  **Deviation from issue #3 as written**: the ticket said to use Vercel's Supabase *marketplace* integration. We used a directly-owned Supabase account instead, with env vars pushed via `vercel env add`. Reason: nearly every ticket from Phase 2 on ships migrations, and `supabase link` + `db push` against a project we own directly is the cleaner loop; the marketplace's benefit was a one-time env-var convenience. Same end state, different ownership.

- Project security settings chosen at creation, both reinforcing ADR 0003:
  - **Automatic RLS enabled** — every new table gets RLS on by default, so a table can't ship unprotected by accident. Expect a brand-new table to return zero rows until policies exist; that's the safety net, not a bug.
  - **"Automatically expose new tables" disabled** — tables are not granted to the Data API roles by default; each migration grants explicitly.

    In practice this means **every migration must include its own `grant`s**, or the table is invisible to the API even with RLS policies in place. Confirmed on the hosted project: `profiles` returns `42501 permission denied` to `service_role`, which was deliberately not granted, while `authenticated` (the role the app actually runs as) works because the migration grants it. Grant `service_role` only where a job genuinely needs to bypass RLS — the reminders work in Phase 8 is the first likely case.

### Outstanding — needs a human (cannot be done by an agent)

- [x] **Google Maps Platform API key for Places**, restricted to the Places API and to the app's own origins/IPs, exposed to the app as a server-only env var (never `NEXT_PUBLIC_*`). Provisioned 2026-08-14 (billing enabled on the existing Google Cloud project) and consumed by #18 — `GOOGLE_MAPS_API_KEY` in `.env.example`.

- [x] Google Cloud OAuth credentials, wired into Supabase → Authentication → Providers → Google. Verified: `/auth/v1/authorize?provider=google` redirects to Google with a client id, the Supabase callback as `redirect_uri`, and `email profile` scopes.

  The Google consent screen is in **Testing** mode, so only addresses listed as test users in the Cloud Console can sign in with Google. Magic link and email/password have no such restriction. Publishing the consent screen triggers Google's verification review — worth doing before real users arrive, not before.

- [x] **Auth URL configuration on the hosted project.** Site URL set to `https://juice-bros.vercel.app`, with `https://juice-bros.vercel.app/**`, `https://*-lukabaseballs-projects.vercel.app/**`, `http://localhost:3000/**` and `http://127.0.0.1:3000/**` on the redirect allow-list.

  This is not optional and it fails quietly: Auth ignores any `redirect_to` that is not on the allow-list and silently falls back to Site URL, so an OAuth or magic-link sign-in lands on `/` with a bare `?code=` and no route to handle it. The preview wildcard matters because every PR preview gets a fresh hostname.

  Applied through the dashboard rather than `supabase config push`: `config.toml` carries no `[auth.external.google]` section, so pushing it risks disabling the Google provider. If auth config ever moves into `config.toml` wholesale, add that section first.

### Local vs hosted

`.env` points at the **local** Docker stack (`127.0.0.1:54321`) and should stay that way — `npm run test:rls` and day-to-day development run against local Postgres. The hosted project is only used by deployed environments.

### Deferred follow-up

- [ ] Booking Buddy is not listed in `src/data/apps.ts`, so it doesn't appear on `/tools` or in the sitemap. Deliberate for now — there's nothing usable to link to yet. Add the entry once sign-in and a real dashboard exist, so the Apps section doesn't advertise a dead end.

## Where to pick up

**Issues #5 (Friend Connections) and #6 (Friend Groups & Visibility) are both closed out.** #5 is closed on GitHub, all six criteria checked. #6's seven acceptance criteria are all met and checked off on GitHub, but **it is deliberately left open**: the ticket's "What to build" line asks for the resolved visibility to be "actually enforced elsewhere in the app," and nothing enforces it yet — `resolveVisibility` has exactly one caller, `getGroupsPageData`, which renders the level as text on the groups page. There is nothing to enforce it against until a Slot exists. Enforcement is Phase 5's Slot RLS and Phase 6's `respondToSlot` guard, i.e. issue #8, which already lists #6 as a blocker. See the comment thread on #6 for the fuller version.

Verified: 116 `node --test` tests, 57 pgTAP tests, and 24 Playwright browser tests all pass; typecheck, lint and `npm run build` are clean. Migrations are deployed — `supabase migration list` shows all six in sync between local and the hosted project.

Everything that was outstanding from #5 and #6 is now done:

- [x] Remove-friend confirmation dialog, verified in a browser including that cancelling leaves the Connection untouched (`e2e/friends.spec.ts`).
- [x] Two-User flows (send/see/accept, decline/re-send) have browser coverage using two separate contexts (`e2e/friends.spec.ts`).
- [x] Username changes: `/booking-buddy/settings`, format rules mirroring the database, uniqueness left to the index (`e2e/settings.spec.ts`).
- [x] `supabase db push` — done, confirmed against the hosted project.
- [x] Test seam decision — see "Seams under test" at the top of this file and the Phase 3 notes below: pure functions get `node --test`, the database gets pgTAP, cross-action journeys get Playwright.
- [ ] Booking Buddy still isn't in `src/data/apps.ts` (see "Deferred follow-up" above). The pages are only reachable via links on the dashboard, which is only reachable by typing the URL. Still deliberate — revisit once Slots give the Apps section something real to link to.

### Notes carried out of the friends page

- **TanStack Query earns its place in exactly one spot here**: the search box, where debounced, cached, per-term fetching is the whole job. Everything else on the page is a server component reading through `listConnections`, mutated by plain `<form action={…}>` Server Actions that call `revalidatePath` — so the lists re-render from the server in the same roundtrip and the page still works without JavaScript. Don't "unify" these onto one mechanism; they are different problems.
- **`connections` references `auth.users`, not `public.profiles`**, so PostgREST has no relationship to embed across and `listConnections` reads profiles in a second query. A `select("*, profiles(...)")` will fail here.
- **Grouping lives in `src/lib/booking-buddy/connections.ts`**, deliberately free of Next.js and Supabase imports so it is unit-testable. A Connection row means different things depending on who is looking at it; that asymmetry is the logic worth testing, and it is.

**Phase 4 (issue #7, Org + Booking) is shipped and merged** ([#19](https://github.com/AdrianLuk/juice-bros/pull/19)), after being redesigned partway through: an Org is no longer a free-text name, it points at a Google Place. [adr/0005](docs/adr/0005-orgs-identified-by-google-place-id.md) is why; [Phase 4](#phase-4--org--booking) below has the steps and the notes carried out of it.

Both open decisions were settled before any code: the Google Places integration is **split into [#18](https://github.com/AdrianLuk/juice-bros/issues/18)** and search there will be **server-side, not a client autocomplete**. Reasoning is under Phase 4; don't relitigate either.

What that means for what shipped: `orgs`, `bookings` and `place_cache` all landed with the ADR 0005 shape, and the UI covers the hand-named path end to end. **No User-facing path writes a `place_id` yet** — that arrives with #18, which is blocked on a Google Maps API key only a human can provision (see "Outstanding — needs a human").

Verified: 143 `node --test` tests, 86 pgTAP tests and 29 Playwright browser tests all pass; typecheck, lint and `npm run build` are clean. Migrations are deployed — `supabase migration list` shows all eight in sync between local and the hosted project.

Note that the orgs/bookings migration went **to the hosted project before #19 merged**. It is additive — three new tables, nothing existing altered, and no deployed code touches them — so it could not break what's live. But the "rewrite it in place" freedom this phase used up is gone, and it was spent within the hour: the review found `orgs` had no index its RLS filter could use and `bookings.org_id` none for its cascade, which had to land as `20260814183000_index_orgs_and_bookings.sql` rather than as an edit.

### What the review caught

Worth reading before Phase 5 repeats any of it:

- **`Intl.supportedValuesOf("timeZone")` is not the same list on the server as in the browser.** Node 24 here returns 418 zones with the *legacy* spellings only — `Asia/Calcutta`, `Europe/Kiev` — and no `UTC` at all, while browsers report the canonical ids. Matching the detected zone strictly against the server's list meant a Chrome user in India detected as `Asia/Kolkata` found no match, got the disabled placeholder, and was blocked by `required` from submitting a form whose list never held their zone under a name they'd look for. The select now *adds* the detected zone when the list lacks it, and the page prepends `UTC`. Postgres accepts every spelling involved, so passing the browser's through is safe. Note that `resolvedOptions().timeZone` does **not** canonicalise aliases in Node — that was the first fix tried, and it doesn't work.
- **`Intl` accepts bare UTC offsets (`+05:30`) and `pg_timezone_names` doesn't**, so `isKnownTimeZone` was green-lighting values the trigger then refused. It now requires a leading letter.
- **`23514` arrives from five different rules** — both branches of `assert_booking_coherent` and three check constraints — so mapping it all to "that isn't your place" told people with a time-zone problem to go looking at ownership. `bookingWriteMessage` reads the message now.
- **A write that RLS filtered away returns `200 []`, not an error.** The seed script accepted a pending Connection as whichever party it happened to have, and a row found in the reverse direction meant the *requester* tried to accept — filtered to zero rows, reported as "connected", pair still pending. The lesson is the one already written into the Phase 3 notes: check the row count, never the status code.

**#18 (Google Places lookup for Orgs) is done** — see its own notes under Phase 4 above.

**#20 (`time_zone` belongs on `orgs`, not `bookings`) is done too**, grabbed ahead of #8 since it was small and already unblocked. `orgs.time_zone` is `not null`; a Place-backed Org derives it from `place_cache`'s coordinates via [`geo-tz`](https://www.npmjs.com/package/geo-tz) (offline, no second Google API), asking nothing; a hand-named Org asks once at creation, defaulting to the browser's zone via the same `TimeZoneSelect` the Bookings form used to own (relocated to `src/components/booking-buddy/time-zone-select.tsx`). `bookings.time_zone` is gone — `createBooking` reads the Org's zone server-side (also doubling as the ownership check) and `getBookingsPageData` renders through it. Two migrations, additive then destructive, both shipped together since nothing is deployed to real users yet.

Two things worth carrying forward:

- **A bundler can rewrite `__dirname` out from under a package that reads its own data files via `fs`.** `geo-tz` ships timezone-boundary data it loads relative to its own package directory; Turbopack rewrote that to a synthetic path, so every lookup failed with a silent `ENOENT` — caught by the same try/catch meant for out-of-range coordinates, so it read as "coordinates too exotic to place" rather than the bundler bug it was. Fixed via `serverExternalPackages: ["geo-tz"]` in `next.config.ts`, which tells Next to `require()` it natively instead of bundling it. Worth checking first for any future native/fs-backed dependency that behaves correctly in a standalone `node -e` check but not inside the app.
- **A pure-logic file that's safe for `node --test` isn't automatically safe for the client bundle, and vice versa.** `isKnownTimeZone` needed to stay in `timezone.ts` because `orgs.tsx`/`bookings.tsx` import `orgs.ts`/`bookings.ts` directly for form constants — pulling `geo-tz` into that same file would drag `fs` into the browser bundle (`Module not found: Can't resolve 'fs'`). It also couldn't just move to a `server-only`-marked file instead: that package throws unconditionally outside Next's `react-server` bundler condition, including under plain `node --test`, so marking `derive-time-zone.ts` that way would have made its own logic untestable. Split into a separate file, kept out of the `server-only` marker, and relied on import hygiene (only ever imported from the Server Action) instead.

Also beyond the ticket: Booking start/end times became a `<select>` of half-hour slots rather than a free `<input type="time">`, since a hand-typed or click-dragged time picker could produce something like `6:23 PM` that no court is actually booked in.

Verified: 178 `node --test` tests, 90 pgTAP tests, and 34 Playwright browser tests all pass; typecheck, lint and `npm run build` are clean.

**Start the next session with #8** (Slot as a poll) — it's still the critical-path ticket everything else in the plan sits behind, #9/#10/#11 all build on Slots existing.

Confirm the local stack is current first: `supabase start` (Docker), `npx supabase migration up --local` if there are new migrations, `npm run seed:users`. See [docs/testing.md](docs/testing.md) for what each test suite needs.

**Work happens on a branch with a PR per ticket now**, not direct commits to `master`.

## Phase 1 — User + Auth

- [x] 1.1 Schema: `public.profiles` (id references `auth.users`, display_name) + trigger to auto-create a profile row on signup. Also carries `username` — see `add_username`.
- [x] 1.2 🔴 Test: inserting a row into `auth.users` results in a matching `profiles` row → 🟢 implemented as `handle_new_user()`
- [x] 1.3 Auth UI: sign-in page offering magic link, Google OAuth, and email/password. All three verified; Google's consent screen is in Testing mode, so only listed test users can use it.
- [x] 1.4 `/booking-buddy/settings`: change your Username. Signup assigns one so nobody has to think about it, but the handle you hand out shouldn't be one an algorithm picked. Rules in `src/lib/booking-buddy/username.ts` mirror the database's; uniqueness is the index's job, not a check-then-write.

## Phase 2 — Connection

- [x] 2.1 Schema: `connections` (requester_id, addressee_id, status: pending/accepted, created_at)
- [x] 2.2 🔴 Test: `sendConnectionRequest` creates a pending Connection between two Users → 🟢 implement
- [x] 2.3 🔴 Test: `acceptConnectionRequest` flips status to accepted; only the addressee can accept, requester attempting it is rejected → 🟢 implement
- [x] 2.4 🔴 Test: `sendConnectionRequest` rejects a duplicate pending request between the same pair → 🟢 implement
- [x] 2.5 🔴 RLS test: querying `connections` directly as a third User (not requester or addressee) returns no row → 🟢 implement coarse policy
- [x] 2.6 Discovery: `search_users` and Usernames (ADR 0004), plus `/booking-buddy/friends` — the search box, both pending-request lists and the accepted Connections list. Ahead of Phase 9's route work because issue #5 is only demonstrable with a UI.

## Phase 3 — Friend Group + Visibility

- [x] 3.1 Schema: `friend_groups` (owner_id, name, default_visibility), `friend_group_members` (group_id, connection_id), `visibility_overrides` (owner_id, connection_id, level)
- [x] 3.2 🔴 Test: `createFriendGroup` creates a group owned by the caller → 🟢 implement — **tested at the database seam, not the action seam** (see the deviation note below)
- [x] 3.3 🔴 Test: `assignToGroup` rejects a Connection that isn't `accepted` yet → 🟢 implement guard — shipped as `setGroupMembership`, since adding and removing are one control with two states. Same deviation.
- [x] 3.4 🔴 Test: `resolveVisibility` — a per-friend override always wins over any group default (pure function, no DB) → 🟢 implement
- [x] 3.5 🔴 Test: `resolveVisibility` — a friend in two groups with different levels resolves to the most permissive → 🟢 implement
- [x] 3.6 🔴 Test: `resolveVisibility` — a Connection with no group and no override defaults to no access → 🟢 implement
- [x] 3.7 🔴 RLS test: querying `friend_groups`/`visibility_overrides` directly as a non-owner returns no rows → 🟢 implement coarse policy

### Notes carried out of Phase 3

- **The agreed seam moved, deliberately — see "Seams under test" above.** 3.2 and 3.3 are not tested by calling the Server Action. Their rules live in a unique index and two triggers, asserted in `supabase/tests/friend_groups.test.sql`; the input handling that *is* decidable in TypeScript was pulled out into `src/lib/booking-buddy/friend-groups.ts` and unit tested there. Adrian chose this over building an action harness: the actions left behind are four lines of glue each, and a harness would exist mostly to test Supabase.
- **The two guards live in the database, not the actions.** "Only accepted Connections are groupable" and "only into your own groups" need subqueries, so they are `before insert or update` triggers rather than check constraints — and firing on update too is what stops a row being edited into a state the insert would have refused. `setGroupMembership` deliberately doesn't re-check either; adding a TypeScript copy would just be a second place to get it wrong.
- **Membership is keyed by Connection, not by the friend's user id.** Unfriending therefore cascades the grouping away with it. A grouping of someone you are no longer connected to would otherwise sit there still granting visibility.
- **`resolveVisibilityByConnection` is driven by the friends list, not by the membership rows**, so an ungrouped friend gets an explicit `none` rather than a missing key. A caller reading "absent" as "unknown" instead of "no access" is the failure mode worth designing out.
- **Level pickers are native `<select>`s** (`visibility-select.tsx`), not the shadcn one. Every form on the page posts to a Server Action and works with no JavaScript; a native control keeps that true.
- **Every write selects its row back** and treats zero rows as a failure. RLS turns "that isn't yours" into an empty result, not an error, so a delete or an update naming someone else's group otherwise returns a cheerful `{ ok: true }` for something that never happened. The one deliberate exception is clearing a visibility override, where no row is the state the User asked for.
- **The member picker shows `Name (@username)`, not just the name.** Found by the browser tests, not by review: with two "Ben Backhand"s in the local data, an `<option>` carrying only the display name gives no way to tell which friend you are adding. `personOptionLabel` exists for one-line contexts where `PersonName`'s second line doesn't fit.
- **Beyond the ticket, on purpose**: groups can be deleted (a group you can't get rid of is a trap), names are unique per owner case-insensitively and capped at 60 characters (two "Tuesday crew"s are indistinguishable in the member picker), and the three level names were coined here and written into [CONTEXT.md](CONTEXT.md) — the issue asked for "a default visibility level" without saying what the levels are.

## Phase 4 — Org + Booking

**Redesigned mid-session on 2026-08-14: an Org is Google Place-backed, not free text.** The reasoning, the alternatives rejected, and the consequences are in [adr/0005-orgs-identified-by-google-place-id.md](docs/adr/0005-orgs-identified-by-google-place-id.md); the vocabulary is in [CONTEXT.md](CONTEXT.md) under **Place** and **Org**. Read both before starting — the steps below are the shape, not the argument.

- [x] 4.1 Schema: `orgs` (owner_id, google_place_id nullable, name nullable, exactly one set), `bookings` (org_id, owner_id, court_label, starts_at, ends_at, time_zone), `place_cache` (place_id pk, name, formatted_address, latitude, longitude, fetched_at)
- [x] 4.2 🔴 Test: an Org is either Place-backed or hand-named, never both and never neither → 🟢 check constraint
- [x] 4.3 🔴 Test: the same owner cannot add the same Place twice → 🟢 unique index on `(owner_id, google_place_id)`
- [x] 4.4 🔴 Test: `createBooking` requires an existing Org owned by the caller → 🟢 implement (trigger — the rule needs a subquery, and RLS does not cover it: the insert is on `bookings`, a table the User may write, and nothing in that policy looks at whose Org they named)
- [x] 4.5 🔴 RLS test: querying `bookings` or `orgs` directly as a non-owner returns no rows — including as an *accepted Connection*, since a Booking reaches a friend only through an attached Slot → 🟢 implement coarse policy
- [x] 4.6 🔴 RLS test: `place_cache` is readable by any authenticated User and writable by none → 🟢 select-only grant, writes via `service_role`
- [x] 4.7 🔴 Test: Place lookup — search returns candidates, picking one caches it, a stale row is refreshed → 🟢 implement — shipped in [#18](https://github.com/AdrianLuk/juice-bros/issues/18), see its notes below
- [x] 4.8 "Powered by Google" attribution on the Org picker and anywhere a Place's address is shown. Required by Google's terms, not optional. — shipped in [#18](https://github.com/AdrianLuk/juice-bros/issues/18)

Beyond the numbered steps, #7 also shipped the UI its acceptance criteria ask for: `/booking-buddy/orgs` (add a hand-named place, see your places, remove one) and `/booking-buddy/bookings` (log a court reservation, see them soonest-first, remove one), both linked from the dashboard.

### Both decisions settled (2026-08-14)

1. **The Places integration is split out — #7 lands the schema, [#18](https://github.com/AdrianLuk/juice-bros/issues/18) brings the picker.** 4.1–4.6 plus the hand-named Org path ship in #7; 4.7–4.8 are #18. The schema is the expensive-to-change part and it's what unblocks Phase 5, and shipping the picker inside #7 would have blocked the whole ticket on a Google Maps API key that doesn't exist yet (see "Outstanding — needs a human"). The consequence is stated in #7 and worth repeating: until #18 ships, the only Orgs creatable through the UI are hand-named ones. `google_place_id`, its uniqueness rule and `place_cache` all land here and are pgTAP-covered, so the shape is settled — but no User-facing path writes a `place_id` yet.
2. **Place search runs server-side, not as a client autocomplete.** A Server Action calls Places Text Search, renders the candidates, and the User picks one in a second step. Every Booking Buddy form posts to a Server Action and works with JavaScript off — that property is why the visibility pickers are native `<select>`s — and a keystroke-driven autocomplete gives it up. It also keeps the API key server-side by construction rather than by discipline. Two steps instead of type-ahead is the accepted cost. Recorded on #18, which is where it gets built.

### Notes carried out of Phase 4

- **The migration and its pgTAP test were rewritten in place**, not stacked on with an `alter table` — they had been applied locally before the redesign but never pushed, so there was no history worth preserving. Most of the original survived: `bookings`, the `assert_booking_coherent` trigger, the `ends_at > starts_at` constraint, the coarse RLS policies and the explicit grants. What changed is `orgs` and the addition of `place_cache`. Rewriting in place is why the local database needed `supabase db reset` — `migration up` cannot undo a version of a migration that no longer exists on disk.

- **`orgs.google_place_id` is deliberately not a foreign key to `place_cache`.** The cache is a cache: a row can be missing or stale, and ADR 0005 names the cache miss as a failure mode the read path has to cope with anyway. An FK would make an Org uninsertable until the server had fetched the Place, coupling the table to the Places integration rather than to the Place itself. The consequence to know about: PostgREST has no relationship to embed across, so `listOrgs` reads the cache in a second query — a `select("*, place_cache(...)")` will fail here, the same way it does on `connections`.

- **A failed cache read is not a failed page.** `listOrgs` logs it and renders every Org without its Place's name, which is the degradation ADR 0005 asks for. `orgDisplayName` returns "Facility details unavailable" rather than a placeholder that reads like a real name. This is the one read in Booking Buddy that tolerates its own failure instead of throwing, and the reason is that the User's own rows are all still there.

- **`time_zone` on `bookings` was not in the original plan and earns its place.** `starts_at` is an instant; rendering it back as the wall-clock time on the facility's own booking screen needs to know which clock that was, and without it the server renders in its own zone — UTC, in production, which turns a 6pm court booking into 10pm. The form sends an IANA zone, Postgres does the DST-aware conversion itself (`'2026-08-20 18:00:00 America/Toronto'::timestamptz`), and the trigger rejects a zone Postgres doesn't recognise. `e2e/bookings.spec.ts` logs a booking in `Asia/Tokyo` and asserts it reads back as the same six o'clock.

- **The time zone is a visible control, not a hidden field.** A hidden input filled in by script would have been simpler and would have broken with JavaScript off, which every other Booking Buddy form survives. Instead the native `<select>` carries the full zone list, and script only *preselects* the browser's zone — read through `useSyncExternalStore` rather than `useEffect`, which the `react-hooks/set-state-in-effect` lint rule refuses. The list is passed down from the server so both renders agree on it: Node's ICU and the browser's are free to disagree about which zones exist, and that would be a hydration mismatch on a 600-option list.

- **`npm run seed:users` now seeds Connections too**, because it turned out not to be true that `db reset` + `seed:users` restores a working local environment — the friendships the browser tests assume were created by hand once and died with the reset, taking five unrelated tests with them. They are seeded as the Users themselves rather than with the service-role key: `connections` is granted to `authenticated` and nobody else, and widening a grant in production to make a local fixture convenient is the wrong trade. See [docs/local-test-accounts.md](docs/local-test-accounts.md) for which pairs and why.

- **Removing a place and removing a booking both sit behind a confirmation dialog**, and neither was in the ticket. Same reasoning as the Friend Group delete: an entry you cannot get rid of is a trap, and a mistyped one would sit in the Booking form's picker forever. The dialogs say plainly that this only changes what Booking Buddy knows — the actual court reservation is untouched.

**#18 (Google Places lookup for Orgs) is shipped**, PR opened against master from branch `google-places-org-lookup`. 4.7 and 4.8 above are it. No schema change and no new pgTAP — #7 already landed everything this ticket writes to.

### Notes carried out of #18

- **Places API (New)**, not the legacy `maps.googleapis.com/maps/api/place/*` surface — `POST /v1/places:searchText` for search, `GET /v1/places/{id}` for the Details refresh, both under `https://places.googleapis.com`. Google's current recommendation for a fresh key; if the wrong product turns out to have been enabled in Cloud Console, it's a one-file swap (`src/lib/booking-buddy/google-places-client.ts`).
- **One `PLACE_CACHE_TTL_DAYS` (30), for the whole `place_cache` row, not just coordinates.** ADR 0005 gives a hard number only for coordinates and no caching exception at all for name/address; using the stricter number everywhere means one staleness check instead of two that could drift apart.
- **Refresh happens at two touchpoints, never on every render** — the ADR 0005 constraint that a cache-miss page still has to render. `pickPlace` (`src/lib/booking-buddy/actions/places.ts`) refreshes synchronously, since the User is already waiting on a network round trip. `listOrgs` schedules a refresh for whatever's stale via `after()` (`next/server`) — runs after the response is already sent, so a Google outage can never slow down or fail the Orgs/Bookings pages. Both funnel through `ensureFreshPlaceCache` in `src/lib/booking-buddy/place-cache.ts`.
- **A failed refresh drops coordinates rather than leaving them stale past 30 days.** Satisfies "refreshed or dropped" literally: success overwrites the whole row; failure on a row already past the TTL nulls just `latitude`/`longitude` (via the new `service_role` admin client, `src/lib/booking-buddy/supabase/admin.ts` — the second use of that key, after `place_cache`'s own writes in #7). Name/address stay, since nothing renders coordinates yet (that's #20) and `orgDisplayName` still needs something to show.
- **A `place_id` that stops resolving (`not_found`) is handled differently depending on who's asking.** At pick time it's a blocking, actionable error ("search again") — the id came from a live search moments earlier, so a 404 is worth surfacing. In the background refresh of an existing Org it's silent: the last-known name/address stays, same as any other cache-miss degradation.
- **The trust boundary on the pick form is `place_id` only.** `place_cache` is shared across every User, so a candidate's name/address is never trusted back from a hidden field — the server re-derives it itself (cache or a fresh Details call), the same reasoning ADR 0005 gives for why the table isn't User-writable.
- **The hand-typed `CreateOrgForm` moved into a `<details>` disclosure** on the Orgs page ("Can't find your club?"), still reachable with JavaScript off — a native element rather than a client-side toggle, same posture as the rest of Booking Buddy's forms.
- **Mocking a server-side `fetch` in Playwright needs its own seam**, since `page.route()` only intercepts requests the *browser* makes. `GOOGLE_PLACES_API_BASE_URL` (server-only, optional, defaults to the real API) lets `playwright.config.ts`'s `webServer.env` point a freshly-started dev server at a local fixture (`e2e/support/google-places-mock.ts`, fixed port so the URL can be baked into config ahead of time). That `env` block only takes effect when Playwright starts the server itself — `reuseExistingServer: true` means a dev server already running on :3000 keeps its own `.env` (the real Google host). CI always gets the override since nothing is already listening; a local run of `e2e/places.spec.ts` only gets it if `npm run dev` wasn't already up when `npm run test:e2e` started.
- **The mock's writes to `place_cache` are real, committed rows in the local database** — and that broke a pgTAP assertion (`orgs_and_bookings.test.sql`, "a User with nothing of their own can still read the Place cache") that assumed the table was otherwise empty, since nothing had ever populated it before this ticket. `e2e/places.spec.ts` now sweeps every `place_id` its mock cached via a direct `service_role` delete (`deleteCachedPlaces` in the mock support file) in its own `afterAll`, using the same published local demo key `scripts/seed-booking-buddy-users.mts` already uses — the app itself has no such action (ADR 0005: nothing evicts a cached Place on purpose), so this is test-only cleanup, not a UI path. Worth remembering for any future ticket that writes real `place_cache` rows from a browser test.

Verified: 171 `node --test` tests, 86 pgTAP tests, and 33 Playwright browser tests all pass; typecheck, lint and `npm run build` are clean.

## Phase 5 — Slot (poll → confirmed lifecycle, ADR 0001)

- [ ] 5.1 Schema: `slots` (owner_id, proposed_start, proposed_end, rotation_buffer default 0), `slot_bookings` (slot_id, booking_id) join table for multi-Booking Slots (Q5d)
- [ ] 5.2 🔴 Test: `createSlot` with no Booking creates a bare proposal → 🟢 implement
- [ ] 5.3 🔴 Test: `attachBookingToSlot` links a Booking; only the Slot owner can attach → 🟢 implement
- [ ] 5.4 🔴 Test: `computeCapacity` — base capacity sums attached Bookings' court capacities, plus rotation buffer (pure function) → 🟢 implement
- [ ] 5.5 🔴 Test: `computeCapacity` — a Slot with zero Bookings returns unbounded/null (nothing to enforce yet) → 🟢 implement
- [ ] 5.6 🔴 RLS test: querying `slots` directly as a User with no Connection to the owner and no valid Slot Link token returns no rows → 🟢 implement coarse policy (nuanced precedence stays app-layer per ADR 0003 — this only proves the coarse boundary)

## Phase 6 — Response

- [ ] 6.1 Schema: `responses` (slot_id, user_id nullable, guest_name nullable, answer: yes/no/maybe, created_at) with a check constraint requiring exactly one of user_id/guest_name
- [ ] 6.2 🔴 Test: `respondToSlot` records yes/no/maybe for a Connection with resolved visibility into the Slot → 🟢 implement, calling `resolveVisibility` from Phase 3 as a guard
- [ ] 6.3 🔴 Test: `respondToSlot` rejects a User with no visibility into the Slot → 🟢 implement
- [ ] 6.4 🔴 Test: `respondToSlot` succeeds even when confirmed "yes" Responses already exceed Capacity — no hard block (documents the ADR 0001 consequence explicitly) → 🟢 implement (no blocking logic needed, but the test proves it)
- [ ] 6.5 🔴 Test: `isOverCapacity` returns true once "yes" Responses exceed `computeCapacity`'s result (pure function, drives the organizer-facing warning) → 🟢 implement

## Phase 7 — Slot Link + Guest

- [ ] 7.1 Schema: `slot_links` (slot_id, token unique, created_at)
- [ ] 7.2 🔴 Test: `generateSlotLink` creates an unguessable token tied to one Slot → 🟢 implement (crypto-random token)
- [ ] 7.3 🔴 Test: `guestRespondViaLink` records a Response keyed by `guest_name`, bypassing the Connection/visibility check when a valid token is presented → 🟢 implement
- [ ] 7.4 🔴 Test: `guestRespondViaLink` logs ip/user-agent/timestamp for the abuse-detection audit trail (Q7) → 🟢 implement
- [ ] 7.5 🔴 Test: `guestRespondViaLink` does not create a Connection row → 🟢 implement (assert no row added)
- [ ] 7.6 🔴 Test: repeated guest RSVPs from the same IP against one Slot Link past a soft threshold get flagged/logged, not blocked (Q7) → 🟢 implement

## Phase 8 — Reminder

- [ ] 8.1 Schema: `notification_preferences` (user_id, email_enabled default true, push_enabled default false), `push_subscriptions` (user_id, endpoint, keys), `reminder_sends` (slot_id, user_id, channel, sent_at) for idempotency
- [ ] 8.2 🔴 Test: `getReminderRecipients` returns Users with a "yes" Response on a confirmed Slot only (has ≥1 Booking) — excludes bare proposals and Guests → 🟢 implement, matching `CONTEXT.md`'s Reminder definition exactly
- [ ] 8.3 🔴 Test: `sendReminder` skips the push channel for a User with `push_enabled: false` → 🟢 implement, respecting preferences
- [ ] 8.4 🔴 Test: `sendReminder` is idempotent — calling it twice for the same Slot+User+channel sends once → 🟢 implement using `reminder_sends` as a dedupe log
- [ ] 8.5 Wire actual delivery: Resend for email (reuse existing integration from the marketing site), `web-push` npm package + VAPID keys for push. Scheduling via Supabase `pg_cron` → Edge Function, or a Vercel Cron Job hitting a route handler, firing at each Slot's configured reminder offset.

## Phase 9 — UI wiring (scoped per agreement — business logic already covered above)

- [ ] 9.1 Routes: `/booking-buddy` (dashboard/calendar), `/booking-buddy/friends`, `/booking-buddy/slots/[id]`, `/booking-buddy/settings`, and the public guest route `/s/[token]` (outside the auth-gated layout)
- [ ] 9.2 TanStack Query hooks wrapping each Server Action, with mutation-driven query-key invalidation; initial data fetched server-side and hydrated (Q5)
- [ ] 9.3 🔴 The one agreed high-stakes UI test: tapping "Yes" on a Slot shows an optimistic "yes" state immediately, before the server responds → 🟢 implement (tooling for this — RTL/jsdom vs. Playwright — to be decided when we reach this step)
- [ ] 9.4 PWA: `manifest.json`, service worker, install prompt/nudge tied to enabling push notifications (Q8)

## Phase 10 — Hardening pass

- [ ] 10.1 Cross-check every table introduced in Phases 1-8 has at least the coarse default-deny RLS policy its phase specified
- [ ] 10.2 Confirm the guest-abuse soft-threshold logging (7.6) is actually wired into the production `guestRespondViaLink` path, not just the test

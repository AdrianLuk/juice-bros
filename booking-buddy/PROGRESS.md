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

## Phase 0 — Tooling & scaffolding (#3)

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

**#20 (`time_zone` belongs on `orgs`, not `bookings`) is done too**, grabbed ahead of #8 since it was small and already unblocked. `orgs.time_zone` is `not null`; a Place-backed Org derives it from `place_cache`'s coordinates via [`geo-tz`](https://www.npmjs.com/package/geo-tz) (offline, no second Google API), asking nothing. `bookings.time_zone` is gone — `createBooking` reads the Org's zone server-side (also doubling as the ownership check) and `getBookingsPageData` renders through it. Two migrations, additive then destructive, both shipped together since nothing is deployed to real users yet.

**The hand-named path's picker was pulled back out the same session, by request**: every early User (and everyone testing with them) is in Toronto, and a time-zone question stacked on top of "I couldn't even find my club on Google" read as an unrelated speed bump for a problem that doesn't exist yet. `CreateOrgForm` no longer renders one; `parseHandNamedOrg` defaults to `DEFAULT_HAND_NAMED_TIME_ZONE` (`America/Toronto`, in `orgs.ts`) when the form sends no `time_zone` field, but still honours and validates one if a caller does send it. `TimeZoneSelect` (`src/components/booking-buddy/time-zone-select.tsx`) is kept in place, unimported, for exactly this: bringing the picker back is wiring it into `CreateOrgForm` and passing the Orgs page's `zones` list again (the pattern is still in `bookings/page.tsx`'s git history if it's easier to copy than re-derive), not rebuilding anything.

Two things worth carrying forward:

- **A bundler can rewrite `__dirname` out from under a package that reads its own data files via `fs`.** `geo-tz` ships timezone-boundary data it loads relative to its own package directory; Turbopack rewrote that to a synthetic path, so every lookup failed with a silent `ENOENT` — caught by the same try/catch meant for out-of-range coordinates, so it read as "coordinates too exotic to place" rather than the bundler bug it was. Fixed via `serverExternalPackages: ["geo-tz"]` in `next.config.ts`, which tells Next to `require()` it natively instead of bundling it. Worth checking first for any future native/fs-backed dependency that behaves correctly in a standalone `node -e` check but not inside the app.
- **A pure-logic file that's safe for `node --test` isn't automatically safe for the client bundle, and vice versa.** `isKnownTimeZone` needed to stay in `timezone.ts` because `orgs.tsx`/`bookings.tsx` import `orgs.ts`/`bookings.ts` directly for form constants — pulling `geo-tz` into that same file would drag `fs` into the browser bundle (`Module not found: Can't resolve 'fs'`). It also couldn't just move to a `server-only`-marked file instead: that package throws unconditionally outside Next's `react-server` bundler condition, including under plain `node --test`, so marking `derive-time-zone.ts` that way would have made its own logic untestable. Split into a separate file, kept out of the `server-only` marker, and relied on import hygiene (only ever imported from the Server Action) instead.

Also beyond the ticket: Booking start/end times became a `<select>` of half-hour slots rather than a free `<input type="time">`, since a hand-typed or click-dragged time picker could produce something like `6:23 PM` that no court is actually booked in.

Verified: 179 `node --test` tests, 90 pgTAP tests, and 33 Playwright browser tests all pass; typecheck, lint and `npm run build` are clean.

**#28 (Phase 4.5, Availability Window: schema + `resolveAvailability` + RLS) is shipped.** See "Notes carried out of Phase 4.5" above.

**#8 (Slot as a poll, with Responses) is shipped too.** See "Notes carried out of #8" above, under Phase 6.

**#9 (Confirm a Slot — attaching Booking(s), Capacity, over-capacity signal) is shipped**, closing Phases 5 and 6. See "Notes carried out of #9" above, under Phase 6.

**#10 (Slot Link & Guest RSVP) is implemented too** — see "Notes carried out of #10" under Phase 7 below, including the one thing left to do before merging: this session had no Docker, so the new pgTAP and Playwright coverage is unverified. **Start the next session with [#11](https://github.com/AdrianLuk/juice-bros/issues/11)** (Email Reminders), now unblocked — #23 (dashboard calendar) remains independent of both.

Verified for #8: 204 `node --test` tests, 114 pgTAP tests pass; typecheck, lint and `npm run build` are clean. 32 of Booking Buddy's Playwright specs pass, including the new `e2e/slots.spec.ts` (4 tests) — `e2e/places.spec.ts`'s 5 tests are excluded from that count for a pre-existing, documented reason unrelated to this ticket: they need a dev server Playwright starts itself to pick up the Google Places mock env var, and this session reused an already-running one (see docs/testing.md's "If you already have `npm run dev` running on :3000" note).

`supabase db push` is done for #8's migration — and it turned out not to be the only one pending. `supabase migration list` showed the hosted project was three migrations behind `master` already, from #20 and #28 (both merged, neither ever pushed): `20260815090000`/`20260815090100` (Move Booking time_zone to Org) and `20260815100000` (Availability Windows). All four went up together in one `db push`; `migration list` now shows local and remote in sync across all twelve. Worth a beat before starting #9: **check `supabase migration list` at the start of every session**, not just after writing a new migration — this drift sat unnoticed across at least one full session.

Rendering Availability on a calendar is folded into [#23](https://github.com/AdrianLuk/juice-bros/issues/23) instead of a separate UI step — #23's body now covers both Bookings and Availability, and lists #28 as a blocker (now closed).

[#23](https://github.com/AdrianLuk/juice-bros/issues/23) (Dashboard calendar + upcoming bookings list, fka Phase 9.1's placeholder) is fully spec'd and ticketed, but deliberately queued **after** #18 and #8 — it only needs Bookings, which already ship, so it isn't blocked, but the existing #18-then-#8 order was a deliberate choice and this ticket doesn't unblock anything else in the graph.

Confirm the local stack is current first: `supabase start` (Docker), `npx supabase migration up --local` if there are new migrations, `npm run seed:users`. See [docs/testing.md](docs/testing.md) for what each test suite needs.

**Work happens on a branch with a PR per ticket now**, not direct commits to `master`.

## Phase 1 — User + Auth ([#4](https://github.com/AdrianLuk/juice-bros/issues/4))

- [x] 1.1 Schema: `public.profiles` (id references `auth.users`, display_name) + trigger to auto-create a profile row on signup. Also carries `username` — see `add_username`.
- [x] 1.2 🔴 Test: inserting a row into `auth.users` results in a matching `profiles` row → 🟢 implemented as `handle_new_user()`
- [x] 1.3 Auth UI: sign-in page offering magic link, Google OAuth, and email/password. All three verified; Google's consent screen is in Testing mode, so only listed test users can use it.
- [x] 1.4 `/booking-buddy/settings`: change your Username. Signup assigns one so nobody has to think about it, but the handle you hand out shouldn't be one an algorithm picked. Rules in `src/lib/booking-buddy/username.ts` mirror the database's; uniqueness is the index's job, not a check-then-write.

## Phase 2 — Connection ([#5](https://github.com/AdrianLuk/juice-bros/issues/5))

- [x] 2.1 Schema: `connections` (requester_id, addressee_id, status: pending/accepted, created_at)
- [x] 2.2 🔴 Test: `sendConnectionRequest` creates a pending Connection between two Users → 🟢 implement
- [x] 2.3 🔴 Test: `acceptConnectionRequest` flips status to accepted; only the addressee can accept, requester attempting it is rejected → 🟢 implement
- [x] 2.4 🔴 Test: `sendConnectionRequest` rejects a duplicate pending request between the same pair → 🟢 implement
- [x] 2.5 🔴 RLS test: querying `connections` directly as a third User (not requester or addressee) returns no row → 🟢 implement coarse policy
- [x] 2.6 Discovery: `search_users` and Usernames (ADR 0004), plus `/booking-buddy/friends` — the search box, both pending-request lists and the accepted Connections list. Ahead of Phase 9's route work because issue #5 is only demonstrable with a UI.

## Phase 3 — Friend Group + Visibility ([#6](https://github.com/AdrianLuk/juice-bros/issues/6))

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

## Phase 4 — Org + Booking ([#7](https://github.com/AdrianLuk/juice-bros/issues/7), [#18](https://github.com/AdrianLuk/juice-bros/issues/18))

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

## Phase 4.5 — Availability Window

Inserted ahead of Slot so Slot's `calendar`-visibility RLS (5.6) enforces against real data instead of a stub. See [adr/0006-availability-layered-precedence.md](docs/adr/0006-availability-layered-precedence.md) and [CONTEXT.md](CONTEXT.md) under **Availability Window**. Numbered 4.5 rather than renumbering every phase after it.

- [x] 4.5.1 Schema: `availability_windows` (owner_id, type: open|busy, starts_at, ends_at) — no uniqueness/overlap constraint (ADR 0006)
- [x] 4.5.2 🔴 Test: `resolveAvailability(ownerId, at)` — a Booking or confirmed Slot covering `at` returns busy regardless of any Availability Window (pure function over pre-fetched rows) → 🟢 implement
- [x] 4.5.3 🔴 Test: `resolveAvailability` — with no covering Booking/confirmed Slot, the most recently *created* Availability Window covering `at` wins → 🟢 implement
- [x] 4.5.4 🔴 Test: `resolveAvailability` — a moment covered by neither returns unspecified → 🟢 implement
- [x] 4.5.5 🔴 Test: creation order, not edit order, decides precedence — editing an older window's time range/type doesn't change which window wins an overlap it didn't already win → 🟢 implement
- [x] 4.5.6 🔴 RLS test: querying `availability_windows` directly as a User with less than `calendar` Visibility into the owner (including no Connection at all) returns no rows → 🟢 implement coarse policy (nuanced precedence stays app-layer per ADR 0003, same as Slot)

Rendering the User's own resolved Availability on a calendar grid is **not** built here — it's folded into [#23](https://github.com/AdrianLuk/juice-bros/issues/23) (Dashboard calendar + upcoming bookings list), which already builds that grid for Bookings. Viewing a *friend's* resolved Availability (through `calendar` Visibility) has no surface at all yet and no ticket — deferred until scoped.

4.5.1–4.5.6 are filed as [#28](https://github.com/AdrianLuk/juice-bros/issues/28), now shipped.

### Notes carried out of Phase 4.5

- **This is the first table whose read policy isn't pure ownership.** Every RLS policy through Phase 4 was "yours and nobody else's" (ADR 0003's example verbatim); `availability_windows` is gated on `calendar`-level Visibility specifically, per CONTEXT.md's Availability Window entry, so the coarse policy has to know the resolved level, not just who owns the row. `has_calendar_visibility(owner_user, viewer_user)` (the migration) replicates the override-then-group-default precedence `visibility.ts` already implements — but only as far as answering "is it `calendar`", since `calendar` is the top of `visibility_level`'s order and there's nothing more permissive to reduce over. The `resolveAvailability` pure function still owns the actual layered read (Booking/Slot busy-wins, then most-recently-created window); nothing about *that* moved into SQL.
- **`throws_ok` is the wrong assertion for an RLS-filtered write.** An `update`/`insert` that RLS blocks matches zero rows rather than raising — the same lesson Phase 4's notes already recorded for reads. First draft of the pgTAP test asserted a calendar-visible friend's `update` with `throws_ok` and it failed for the right reason (no exception, because the row was just silently unmatched); fixed by asserting the row's value is unchanged instead.
- **No `resolveAvailability` caller exists yet.** There's no Booking/confirmed-Slot data source wired to it (Slot doesn't exist until #8) and no UI (that's #23). The function takes pre-fetched `busyIntervals`/`windows` arrays rather than an `ownerId` — matching `resolveVisibility`'s shape, where the owner-scoping is the caller's query, not the pure function's job.

Verified: 183 `node --test` tests, 100 pgTAP tests pass; typecheck, lint and `npm run build` are clean.

## Phase 5 — Slot (poll → confirmed lifecycle, ADR 0001)

*Split across two issues, not a clean 1:1*: 5.1 (the `slots` half)/5.2/5.6 are [#8](https://github.com/AdrianLuk/juice-bros/issues/8) (bare-proposal Slot creation + Slot RLS); 5.1 (the `slot_bookings` half)/5.3/5.4/5.5 are [#9](https://github.com/AdrianLuk/juice-bros/issues/9) (attaching Booking(s) + Capacity).

- [x] 5.1 Schema: `slots` (owner_id, proposed_start, proposed_end, rotation_buffer default 0), `slot_bookings` (slot_id, booking_id) join table for multi-Booking Slots (Q5d) — the `slots` half only; `slot_bookings` is #9's
- [x] 5.2 🔴 Test: `createSlot` with no Booking creates a bare proposal → 🟢 implement
- [x] 5.3 🔴 Test: `attachBookingToSlot` links a Booking; only the Slot owner can attach → 🟢 implement — covered at the database seam (`slot_bookings.test.sql`) and the browser seam (`slots.spec.ts`), not as a pure-function test; the action itself is glue
- [x] 5.4 🔴 Test: `computeCapacity` — base capacity sums attached Bookings' court capacities, plus rotation buffer (pure function) → 🟢 implement
- [x] 5.5 🔴 Test: `computeCapacity` — a Slot with zero Bookings returns unbounded/null (nothing to enforce yet) → 🟢 implement
- [x] 5.6 🔴 RLS test: querying `slots` directly as a User with no Connection to the owner and no valid Slot Link token returns no rows → 🟢 implement coarse policy (nuanced precedence stays app-layer per ADR 0003 — this only proves the coarse boundary). Shipped as `has_slot_visibility` + `can_access_slot` — the Slot Link token half of this test doesn't exist yet (#10); today's boundary is Connection-and-Visibility only.

## Phase 6 — Response

*Also split*: 6.1/6.2/6.3 are [#8](https://github.com/AdrianLuk/juice-bros/issues/8) (Responses on a bare-proposal Slot); 6.4/6.5 are [#9](https://github.com/AdrianLuk/juice-bros/issues/9) (the over-capacity signal, since it needs Capacity from that ticket).

- [x] 6.1 Schema: `responses` (slot_id, user_id nullable, guest_name nullable, answer: yes/no/maybe, created_at) with a check constraint requiring exactly one of user_id/guest_name
- [x] 6.2 🔴 Test: `respondToSlot` records yes/no/maybe for a Connection with resolved visibility into the Slot → 🟢 implement — **deviation from "calling `resolveVisibility` as a guard"**, see the notes below
- [x] 6.3 🔴 Test: `respondToSlot` rejects a User with no visibility into the Slot → 🟢 implement
- [x] 6.4 🔴 Test: `respondToSlot` succeeds even when confirmed "yes" Responses already exceed Capacity — no hard block (documents the ADR 0001 consequence explicitly) → 🟢 implement (no blocking logic needed, but the test proves it) — see the notes below: there is no such test, because there is nowhere for one to fail
- [x] 6.5 🔴 Test: `isOverCapacity` returns true once "yes" Responses exceed `computeCapacity`'s result (pure function, drives the organizer-facing warning) → 🟢 implement

### Notes carried out of #8

**Issue #8 (Slot as a poll, with Responses) is shipped.** All six of its acceptance criteria are met: a bare-proposal Slot can be created with no Booking; a visible Connection can respond and change their response; a Connection without visibility is rejected; Responses are visible to the owner and other visible Connections; the `slots` RLS boundary is pgTAP-tested; and the one dedicated UI-seam test (tapping a response shows an optimistic state before the server confirms it) is in `e2e/slots.spec.ts`, built on TanStack Query per CLAUDE.md's "Slot Responses" carve-out.

- **`respondToSlot` doesn't call `resolveVisibility` in TypeScript, and can't.** The plan's 6.2 line assumed it would, but `resolveVisibility` needs the Slot owner's Friend Group memberships and overrides, and those tables are owner-only per Phase 3's own RLS (`visibility_overrides`/`friend_groups` are readable only by their owner) — the *responder* can never read them to compute the answer themselves. What actually enforces "no visibility, no response" is `can_access_slot`, a SQL mirror of `resolveVisibility`'s override-then-group precedence exposed as a `security definer` function (the same pattern Phase 4.5 already established for `has_calendar_visibility`, extended here to "at least `slots`" via `has_slot_visibility`). `respondToSlot` relies on the `responses` insert/update policies gating on it, and reads an RLS-filtered zero-row write as "no permission" — the same convention every other write in this app already follows.
- **A Slot's own RLS is not pure ownership**, same exception `availability_windows` set for `calendar` Visibility in Phase 4.5. `has_slot_visibility` is the "at least `slots`" version — `slots` isn't the top of `visibility_level`'s order the way `calendar` is, so it checks the override/group level is `in ('slots', 'calendar')` rather than equals a single value.
- **A bare-proposal Slot has no Org to read a clock off**, unlike a Booking (issue #20). It carries its own `time_zone` column instead — the same shape `bookings.time_zone` used to have before that ticket moved it to `orgs` — and, like every hand-named path in this app, defaults silently to `America/Toronto` rather than asking (`DEFAULT_HAND_NAMED_TIME_ZONE`, reused from `orgs.ts`) per the precedent set when the picker came back out of `CreateOrgForm`. No time-zone field appears anywhere in the Slot form.
- **Date/half-hour-time parsing moved out of `bookings.ts` into a new `datetime.ts`** the moment a second caller (Slots) needed the identical rules — `isRealDate`, `isHalfHourTime`, `HALF_HOUR_TIMES`, `formatTimeLabel`. `bookings.ts` re-exports `HALF_HOUR_TIMES`/`formatTimeLabel` so nothing importing from it had to change.
- **The `responses` unique index on `(slot_id, user_id)` is deliberately not partial** (not `where user_id is not null`, even though only non-null rows need the uniqueness — Guest rows via issue #10 don't). Postgres treats every `null` as distinct for uniqueness, so a plain index already imposes no limit on Guest rows for free, and staying plain is what lets `respondToSlot`'s `upsert(...).onConflict("slot_id,user_id")` name it as the arbiter — a partial index's predicate isn't expressible through supabase-js's upsert, and referencing one at all raises "no unique or exclusion constraint matching the ON CONFLICT specification" at runtime.
- **An INSERT that fails `with check` raises; an UPDATE filtered by `using` doesn't.** `slots.test.sql` needed both flavors in the same file: Ben inserting a Response on Amy's behalf, or Cal inserting one at all with no Visibility, are `throws_ok` (42501) — but Ben changing his own existing Response is silent, ordinary `is()`. The Phase 4/4.5 lesson ("check the row, never the status") is about the second case, not the first; conflating them was the first draft's bug.
- **`e2e/support/slot-cleanup.ts` signs in as Amy rather than using the service-role key** the way `deleteCachedPlaces` does for `place_cache`. `service_role` has no grant on `slots` at all — only `authenticated` does — and every Slot the spec creates is Amy's, so her own RLS delete policy is enough; there is no genuine production need to bypass RLS here, unlike the Places refresh job. First draft used the service-role key anyway, out of habit copied from `google-places-mock.ts`, and failed silently (`deleteSlots` didn't check the response), leaving stray rows that broke a later run's locator with a strict-mode "resolved to 2 elements" failure — worth remembering: an un-checked cleanup `fetch` can pass its own test while quietly not doing its job.
- **`getSlotResponses` is split out of `getSlotDetail`** as its own exported function/query key, not folded into one page-data call — `ResponseButtons`' optimistic mutation refetches and cache-patches just the responses half, per CLAUDE.md's "Slot Responses" TanStack Query carve-out. `getSlotDetail` composes it rather than duplicating the query.
- **Beyond the ticket's acceptance criteria**: `/booking-buddy/slots` lists both the caller's own Slots and every friend's they can see (RLS alone decides which rows come back — there's no separate "visible friends" filter in application code), and the dashboard links to it now that there's something real to link to.

**#8 is not "Slots done"** — Phase 5's `slot_bookings`/`attachBookingToSlot`/`computeCapacity` (5.3–5.5) and Phase 6's over-capacity signal (6.4–6.5) are issue #9's, which already lists #8 as a blocker (now closed). #10 (Slot Link + Guest) and #11 (Email Reminders) both build on Slots existing too.

### Follow-up: no past Slots or Bookings

Not part of #8's acceptance criteria, added afterward by request: a Slot cannot be proposed, and a Booking cannot be logged, for a date/time that's already passed. Both a Slot and a Booking represent something happening going forward — the same reasoning ADR 0002 already gives for why a Booking has no "intended" state, extended one step further to "and not a past one either."

- **Two layers, same shape as every other rule in this app**: a `before insert` trigger on each table (`slots_not_in_the_past`, `bookings_not_in_the_past`) is the authority, comparing the already-converted `timestamptz` instant against `now()` — no time-zone math needed there, Postgres already did it. A coarse, calendar-day-only pre-check (`isPastDate`/`todayInZone`, `datetime.ts`) catches the obvious case in JS first, for a friendlier error without the round trip; a same-day-but-already-passed-hour proposal slips past that pre-check on purpose and is caught by the trigger instead, translated back into the same friendly message by `slotWriteMessage`/`bookingWriteMessage` reading the exception text (`error.message?.includes("in the past")`) — the same "message says which rule fired" pattern `bookingWriteMessage` already used for org-ownership failures.
- **Scoped to `insert`, not `insert or update`, on purpose.** Neither table has an edit path in the app today, and a rule meant to stop someone *posting* something in the past has no business retroactively blocking some unrelated future update to a row whose start time has since passed (attaching a Booking to a Slot in #9, for instance, is an insert into the separate `slot_bookings` join table, not an update of `slots` itself — so this doesn't even brush up against that).
- **Where the JS pre-check runs differs between the two, and has to.** `parseNewSlotProposal` (pure function) resolves its own `timeZone` before this check ever runs, since a bare-proposal Slot has no Org to borrow one from — so the check lives right there. `parseNewBooking` has no zone available to it at all (the Org's zone isn't known until `createBooking` reads it from the database), so the equivalent check runs in the action, right after that read, not in the pure parser. Not an inconsistency — the zone genuinely isn't known in the same place for both.
- **Code review caught a real bug before it shipped**: both triggers apply to the *existing* pgTAP fixtures too, and `orgs_and_bookings.test.sql`/`slots.test.sql` had hardcoded Booking/Slot dates only 5–7 days out from "today" (2026-08-15). Nothing enforced "not in the past" before this, so those dates were fine; adding the trigger turned them into a near-term time bomb that would've started failing within the week, for every future session, on shed unrelated to this feature — the DST wall-clock instant check in particular, which depends on one of those exact rows. Fixed by moving the threatened fixture dates out to 2031, matching the distance `e2e/slots.spec.ts` already uses for its own fixtures. Worth remembering for the next rule that adds a `now()`-relative constraint to an existing table: **grep the test fixtures for dates that rule would now touch, not just the ones in the diff.**

Verified: 211 `node --test` tests, 116 pgTAP tests pass; typecheck, lint and `npm run build` are clean. `e2e/slots.spec.ts` and `e2e/bookings.spec.ts` each cover the friendly-error path.

### Notes carried out of #9

**Issue #9 (Confirm a Slot) is shipped.** All five acceptance criteria are met: the Slot owner can attach one or more of their Bookings; Capacity is the courts plus the rotation buffer; a Slot with no Bookings has no Capacity; "yes" Responses are never blocked; and the organizer sees an over-capacity signal once they exceed Capacity. This closes Phase 5 (5.3–5.5) and Phase 6 (6.4–6.5).

- **Capacity is per-Booking data, not a flat constant** — [ADR 0008](docs/adr/0008-court-capacity-is-per-booking-data.md), revised mid-ticket before shipping. The first draft made "a court holds four" a constant and left singles unrepresented; revisited on request, because singles and informal drilling (a court shared by 3+ players rotating through drills, more spots than a strict doubles reading would show) are common enough that folding them entirely into the organizer's manual read of the rotation buffer was the wrong simplification. `bookings.format` (`singles` | `doubles`, defaulting to `doubles`) now drives each attached court's own share; `computeCapacity` sums the list rather than multiplying a count.
- **`slot_bookings.format` is a deliberate copy of `bookings.format`, not a fresh read on every query.** A friend can read `slot_bookings` (gated on `can_access_slot`) but not `bookings` (owner-only), so without the copy a friend's Capacity would silently omit whatever singles courts are attached. `assert_slot_booking_coherent` writes the copy from the Booking itself — never from what the client's insert claims — the same trigger that already checked ownership; pgTAP proves a tampered `format` in the insert gets overwritten. Safe against drift only because Bookings have no edit path today; an editable Booking would need this revisited.
- **The Capacity a friend sees is the same number the organizer sees, and RLS is what makes that safe.** `slot_bookings` is readable by anyone who can read the Slot (`can_access_slot`), so the court count and formats travel; `bookings` stays owner-only, so where and which court do not. `getSlotCapacity` doesn't branch on the viewer for that — it asks for the Booking details and a friend simply gets none back, which is a harder thing to get wrong than a filter someone could forget.
- **The over-capacity signal reads the same query cache the response buttons write to.** `SlotCapacityPanel` and `ResponseButtons` share one `useQuery` key (`slotResponsesQuery`), so an optimistic "yes" moves the count and the signal together. Two independent reads of the same thing would have let the count and the ceiling disagree for a beat, which is exactly the moment the signal matters.
- **6.4 asks for a test that `respondToSlot` succeeds over Capacity — the honest place for it turned out to be pgTAP, not the action.** The action never reads Capacity, so a test at that seam proves nothing about code that doesn't exist. What can regress is the database: someone adding a "helpful" trigger later. `slot_bookings.test.sql` therefore has five Users each RSVPing "yes" to a one-court Slot and asserts all five rows land.
- **The Booking-side ownership check cannot live in RLS.** The insert is on `slot_bookings`, and the insert policy only sees the Slot; nothing in it looks at whose Booking was named. `assert_slot_booking_coherent` (security definer) is what closes that, the exact shape `assert_booking_coherent` already uses for Org ownership — and the reason attaching someone else's Booking raises `23514` rather than being silently filtered.
- **A code-review pass caught a real gap before shipping**: the first `attachable` list offered every Booking the owner had ever logged, with no relation to the Slot's own date — attaching a wildly unrelated reservation would misreport Capacity with nothing to catch it. `bookingOverlapsSlot` now filters the picker to Bookings whose window actually overlaps the Slot's proposed one; not a hard block (nothing in this app hard-blocks attach/detach), just the picker not offering nonsense. The same pass also caught `slot_bookings`' primary key permitting one Booking to back two different Slots at once (double-counted Capacity) — closed with `slot_bookings_booking_unique` — and an e2e test that submitted a Booking-creation form without waiting for it to land before navigating away, which could leave the next step with nothing to select.
- **`addPlace`/`logBooking`/`removePlace` moved out of `bookings.spec.ts` into `e2e/support/places.ts`** the moment the Slots spec needed a real Booking as a fixture — the same "extract when the second caller appears" move `datetime.ts` was in #8. `logBooking` grew an optional `format` param for the same reason.

Verified: 234 `node --test` tests, 134 pgTAP tests pass; the full Playwright suite (40 tests, including `e2e/slots.spec.ts` and `e2e/bookings.spec.ts`) passes; typecheck, lint and `npm run build` are clean.

## Phase 7 — Slot Link + Guest ([#10](https://github.com/AdrianLuk/juice-bros/issues/10))

- [x] 7.1 Schema: `slot_links` (slot_id, token unique, created_at)
- [x] 7.2 🔴 Test: `generateSlotLink` creates an unguessable token tied to one Slot → 🟢 implement (crypto-random token)
- [x] 7.3 🔴 Test: `guestRespondViaLink` records a Response keyed by `guest_name`, bypassing the Connection/visibility check when a valid token is presented → 🟢 implement
- [x] 7.4 🔴 Test: `guestRespondViaLink` logs ip/user-agent/timestamp for the abuse-detection audit trail (Q7) → 🟢 implement
- [x] 7.5 🔴 Test: `guestRespondViaLink` does not create a Connection row → 🟢 implement (assert no row added)
- [x] 7.6 🔴 Test: repeated guest RSVPs from the same IP against one Slot Link past a soft threshold get flagged/logged, not blocked (Q7) → 🟢 implement

### Notes carried out of #10

**Issue #10 (Slot Link & Guest RSVP) is implemented.** All five acceptance criteria are met: the Slot owner can generate a unique, unguessable Slot Link (`/booking-buddy/slots/[id]`'s new "Invite link" section); anyone holding it can view the Slot at `/s/[token]` with no sign-in; a Guest RSVPs by name alone and no Connection is created; every Guest RSVP is logged with IP, user agent and timestamp in `guest_rsvp_log`; and repeated attempts from the same IP past `GUEST_RSVP_SOFT_THRESHOLD` (3) are flagged in that log, not blocked.

- **The Guest path runs entirely through the admin (`service_role`) client, not a new `anon`-role RLS policy.** A Guest never gets a Supabase session, so there is no `auth.uid()` for a policy to gate on — the alternative (an `anon`-callable RPC keyed by a token read from a header or claim) would make `slot_links` a surface an attacker could hammer directly against Postgres, bypassing whatever logging or threshold the app wants to enforce. Instead `getSlotByToken`/`guestRespondViaLink` (`src/lib/booking-buddy/actions/guest-rsvp.ts`) do the token lookup themselves via `createAdminClient()` — the exact `service_role` precedent `place_cache` already set (ADR 0003) — before touching `slots`, `slot_bookings`, `responses` or `profiles`, each of which needed its own new `service_role` grant in this ticket's migration (table grants and RLS bypass are independent checks, the same lesson the `place_cache` migration's comment already carries). `slot_links` itself and the new `guest_rsvp_log` audit table stay `authenticated`-only (owner-managed) and `service_role`-only respectively — no User, including a Slot's own owner, has a read path to another Guest's IP today.
- **One Slot Link per Slot**, not one per invite. `slot_links_one_per_slot` is a unique index on `slot_id`, and `generateSlotLink` reuses the existing row rather than minting a second — CONTEXT.md already speaks of "its Slot Link", singular, and a second live token per Slot would just be a second thing to remember was shared.
- **`getSlotResponses` (Phase 6, issue #8) had been filtering Guest rows out on purpose**, with a comment pointing straight at this ticket (`user_id !== null`). That filter is gone: `SlotResponse` gained an `id` (the response row's own, since a Guest response has no `userId` to key React's list on) and `displayName` now falls back to `guest_name` when `userId` is null. `ResponseButtons`' optimistic-update path (`withResponse`) got the same `id` field, using the signed-in responder's own `viewerId` as a stand-in until the next refetch replaces it — nothing else about that TanStack Query carve-out changed.
- **The soft threshold counts all-time prior attempts from the same IP against the same link**, not a rolling window — CLAUDE.md's Guest RSVP abuse-handling decision asks for logging and soft-threshold flagging, not a rate limiter with real time semantics, so the simpler count is the honest read of what was actually specified. A missing/unparseable `X-Forwarded-For` (`clientIp` returns `null`) skips the threshold check entirely rather than guessing — an RSVP still gets logged and still succeeds, just unflagged, since there's nothing to attribute a "repeat" to.
- **A failed audit-log write does not fail the Guest's RSVP.** The `responses` insert is the one write that must succeed for the acceptance criteria to hold; `guest_rsvp_log`'s insert (and the count read before it) are best-effort, logged to the server console on failure — the same posture `listOrgs` already takes toward a failed `place_cache` read: the User-facing action succeeded, and a logging hiccup shouldn't read to a Guest as their RSVP having failed.
- **`/s/[token]` needed no proxy or layout change.** `routes.ts`'s `requiresSession` only gates paths under `BOOKING_BUDDY_ROOT`, and `/s` was never nested under it — confirmed by a test already sitting in `routes.test.ts` before this ticket started (`"the public Slot Link route is reachable without a session"`), which suggests the route's placement was decided back when Phase 9 was originally scoped. The page carries its own `robots: { index: false }`, since a Slot Link is meant for whoever holds it, not for search engines.
- **No Guest RSVP update path.** A Guest resubmitting the form inserts a second `responses` row rather than changing their first — there is no unique constraint on `(slot_id, guest_name)` the way signed-in Users get on `(slot_id, user_id)`, deliberately: two different Guests can share a name, so that constraint would either block a legitimate second Guest or require a mechanism (a per-Guest token, a browser-stored id) nothing in the ticket asked for. Out of scope here, not forgotten.
- **pgTAP (`slot_links.test.sql`) covers the `slot_links` RLS boundary — owner-only, and not reachable even through the most permissive Visibility level — and confirms `guest_rsvp_log` is unreachable through `authenticated` at all**, but doesn't (and can't usefully) exercise `service_role` itself: it bypasses RLS by Supabase's own platform guarantee, the same reason `place_cache`'s writes were never pgTAP-covered either.
- **Verified in full review, Docker available this time.** `npm run test:rls` passes (144 pgTAP tests, up from 134, across 11 files — `slot_links.test.sql`'s 10 assertions included); `npm run test:e2e` passes (43 Playwright tests, up from 40 — `e2e/slot-links.spec.ts`'s 3 specs included, no regressions elsewhere). `npm test` (245 pure-function tests), `npm run lint`, `npx tsc --noEmit`, and `npm run build` all clean too. Nothing needed fixing.

**#11 (Email Reminders) is done too** — see "Notes carried out of #11" below, under Phase 8.

**Start the next session with [#12](https://github.com/AdrianLuk/juice-bros/issues/12)** (Web push + PWA installability) or [#13](https://github.com/AdrianLuk/juice-bros/issues/13) (Hardening pass) — both are unblocked. #23 (dashboard calendar) remains independent of either and still fully spec'd and ready whenever it's picked up instead.

## Phase 8 — Reminder

*Split by channel*: 8.1 (`notification_preferences`/`reminder_sends`)/8.2/8.4/8.5 (email half) are [#11](https://github.com/AdrianLuk/juice-bros/issues/11); 8.1 (`push_subscriptions`)/8.3/8.5 (push half) are [#12](https://github.com/AdrianLuk/juice-bros/issues/12), alongside PWA installability.

- [x] 8.1 Schema: `notification_preferences` (user_id, email_enabled default true, push_enabled default false), `push_subscriptions` (user_id, endpoint, keys), `reminder_sends` (slot_id, user_id, channel, sent_at) for idempotency — `notification_preferences`/`reminder_sends` only; `push_subscriptions` is #12's
- [x] 8.2 🔴 Test: `getReminderRecipients` returns Users with a "yes" Response on a confirmed Slot only (has ≥1 Booking) — excludes bare proposals and Guests → 🟢 implement, matching `CONTEXT.md`'s Reminder definition exactly
- [x] 8.3 🔴 Test: `sendReminder` skips the push channel for a User with `push_enabled: false` → 🟢 implement, respecting preferences — proven as `shouldSendReminder`, a pure decision function; push delivery itself is #12's
- [x] 8.4 🔴 Test: `sendReminder` is idempotent — calling it twice for the same Slot+User+channel sends once → 🟢 implement using `reminder_sends` as a dedupe log
- [x] 8.5 Wire actual delivery: Resend for email (reuse existing integration from the marketing site), `web-push` npm package + VAPID keys for push. Scheduling via Supabase `pg_cron` → Edge Function, or a Vercel Cron Job hitting a route handler, firing at each Slot's configured reminder offset. — email half only; push (`web-push`/VAPID) is #12's

### Notes carried out of #11

**Issue #11 (Email Reminders) is shipped.** All four acceptance criteria are met: a Slot owner sets a reminder offset (minutes before start, defaulting to 60) right on the Slot's own detail page; only Users with a "yes" Response on a *confirmed* Slot (≥1 Booking attached) ever get one — bare proposals and Guests get nothing; delivery goes through the existing Resend integration; and `reminder_sends`' unique `(slot_id, user_id, channel)` index makes a repeat send a no-op, not a duplicate.

- **The send job (`/api/booking-buddy/send-reminders`) runs entirely through `service_role`, not a User's own session** — the same posture issue #10's Guest RSVP path established, and the one `env.ts`'s own comment predicted back in Phase 0 ("PROGRESS.md expected Phase 8's Reminder job to need this first, but writing the Place cache beat it there"). It reads across every User's Slots, Responses and preferences at once, which no single User's RLS grant would ever allow. Fired by a **Vercel Cron Job** hitting that route on a schedule (`vercel.json`), not Supabase `pg_cron` → Edge Function — this repo has no Supabase Edge Functions infrastructure yet, and staying inside the Next.js app keeps the whole feature testable the same way everything else here is (`node --test`, pgTAP, Playwright), with nothing to deploy or debug in a second runtime.
- **`isReminderDue`'s window is deliberately wide, not a narrow "this exact minute" check.** It's due from the moment `now` reaches the configured offset before `proposedStart`, and stays due all the way up to the Slot's own start. That width is what makes the job tolerate *any* cron cadence without a code change — `reminder_sends` is what actually prevents a duplicate send, not the window's width.
- **`vercel.json` is set to `"0 13 * * *"` (once daily), because that's the actual constraint**: Vercel's Hobby plan allows at most 2 Cron Jobs, each invoked at most once a day — confirmed against the account this ships to, not assumed. Corrected after first shipping this at `*/15 * * * *`, which Hobby cannot run as configured. **Upgrading later is a one-line change** — edit the schedule string back to something like `*/15 * * * *`; nothing in the route or `reminders.ts` needs to change, since the due-window design above already tolerates it. Documented in the route's own header comment, so the instruction lives next to the code it applies to.
- **Daily-only cron has a real, not merely cosmetic, consequence for short offsets.** A Reminder's due-window is only as wide as its own configured offset (as narrow as 15 minutes, per `REMINDER_OFFSET_PRESETS`). If that window opens and fully closes between two daily runs, the Reminder is silently never sent — not late, *missed*, since `isReminderDue` requires `now < proposedStart` and there's no retroactive send once a Slot has started. Worth knowing before picking a short offset today: a 1-day or 2-day offset is the only reliably-delivered choice until the cron itself runs more often than the offset being configured.
- **`shouldSendReminder` already branches on a `push` channel that sends nothing yet** (8.3's acceptance test). `notification_preferences.push_enabled` and the channel parameter both exist now so issue #12 only has to wire up delivery, not revisit this decision function.
- **A missing `notification_preferences` row means the defaults, not a signup trigger.** Unlike `profiles`, there's no `handle_new_user`-style insert wired to `auth.users` for this table — `getNotificationPreferences` (the User's own read) and the send job's batch read both resolve a missing row to `email_enabled: true` themselves. One fewer trigger to keep in sync with the signup flow, at the cost of every reader needing to know the default — worth revisiting if a third reader ever needs it independently.
- **Recipient email addresses come from the GoTrue Admin API (`service_role`'s `auth.admin.getUserById`), not a table column.** No table in this schema — `profiles` included — has ever carried a User's email; granting `service_role` a new column just for this job would duplicate what Auth already owns. Fetched per recipient rather than in bulk, since a Slot's own attendee list is small.
- **The email template (`formatReminderEmail`) is pure and unit-tested** — HTML-escaped, same discipline the contact form's `renderContactEmail` already established — but the send itself (the actual Resend call, and the cron trigger end to end) has the same coverage gap `guest_rsvp_log`'s `service_role` writes and the contact form's own Resend integration already carry: nothing here is Playwright-tested, since that would mean either mocking a third-party mail API this codebase has no fixture for, or sending a real email on every CI run. Verified instead with a manual smoke test against the real route: unauthenticated and wrong-secret requests both 401, and an authenticated request runs the full query pipeline (admin client, `slots`/`slot_bookings`/`responses`/`notification_preferences`/`reminder_sends` reads) cleanly against the local stack, returning `{ ok: true, checked: 0, sent: 0, failed: 0 }` since no near-term confirmed Slot existed in the seed data to trigger an actual send.
- **`CRON_SECRET` and `REMINDER_FROM_EMAIL` are new required env vars**, documented in `.env.example`. Neither is set on Vercel yet — **needs a human**: generate a `CRON_SECRET` and set it (plus `REMINDER_FROM_EMAIL`, reusing the already-verified Resend domain or a new `reminders@` address) on the Vercel project for Production, the same way `RESEND_API_KEY`/`CONTACT_*` already are. Until then the deployed cron job 500s safely rather than sending anything — it refuses to run unconfigured rather than falling back to an open, unauthenticated endpoint.

- **The reminder-timing control is a preset `<select>`, not a free-typed number of minutes** — changed after the first pass shipped, by request. Nobody thinks in minutes past an hour or two, so `REMINDER_OFFSET_PRESETS` (15/30 min, 1/2/4 hr, 1/2 days) and `reminderOffsetLabel` (renders any whole-minute value in the largest clean unit it divides into) replace the raw number field. The column and `parseReminderOffsetMinutes` still accept any value in `[0, 10080]` — `ReminderOffsetForm` adds the Slot's current value to the option list when it isn't one of the presets, the same "don't discard what's already there" move `TimeZoneSelect` makes for a detected zone the list doesn't carry, so a value set before this list existed still renders correctly rather than silently jumping to the nearest preset.

Verified: 261 `node --test` tests, 155 pgTAP tests pass; the full Playwright suite (46 tests, including the two new reminder specs in `slots.spec.ts`/`settings.spec.ts`) passes; typecheck, lint and `npm run build` are clean. `supabase migration up --local` applied cleanly; `supabase db push` to the hosted project is still pending — do it before considering this fully deployed.

## Phase 9 — UI wiring (scoped per agreement — business logic already covered above)

- [ ] 9.1 Routes: `/booking-buddy` (dashboard/calendar — spec'd and ticketed as [#23](https://github.com/AdrianLuk/juice-bros/issues/23), Booking-only for now since Slots don't exist yet), `/booking-buddy/friends`, `/booking-buddy/slots/[id]`, `/booking-buddy/settings`, and the public guest route `/s/[token]` (outside the auth-gated layout)
- [ ] 9.2 TanStack Query hooks wrapping each Server Action, with mutation-driven query-key invalidation; initial data fetched server-side and hydrated (Q5)
- [ ] 9.3 🔴 The one agreed high-stakes UI test: tapping "Yes" on a Slot shows an optimistic "yes" state immediately, before the server responds → 🟢 implement (tooling for this — RTL/jsdom vs. Playwright — to be decided when we reach this step)
- [ ] 9.4 PWA: `manifest.json`, service worker, install prompt/nudge tied to enabling push notifications (Q8) — see [#12](https://github.com/AdrianLuk/juice-bros/issues/12)

## Phase 10 — Hardening pass ([#13](https://github.com/AdrianLuk/juice-bros/issues/13))

- [ ] 10.1 Cross-check every table introduced in Phases 1-8 has at least the coarse default-deny RLS policy its phase specified
- [ ] 10.2 Confirm the guest-abuse soft-threshold logging (7.6) is actually wired into the production `guestRespondViaLink` path, not just the test

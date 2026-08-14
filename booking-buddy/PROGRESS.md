# Booking Buddy — Implementation Plan

Built test-first, in vertical slices: one seam, one red test, one minimal green implementation, repeat. No horizontal slicing (no writing a batch of tests before any implementation). Refactoring happens at review time, not inside the red→green loop itself.

**Seams under test** (agreed in planning — see [docs/adr/](docs/adr/) and [CONTEXT.md](CONTEXT.md) for the vocabulary these tests should use):
1. **Server Actions / business-logic functions** — the primary seam. Tests call the action and assert through another read action or return value, never by querying the database directly as a side channel.
2. **RLS policies** — a deliberate database-level seam, since the coarse safety net (ADR 0003) exists specifically to catch access that bypasses application code. These tests query Postgres directly, on purpose.
3. **UI/hooks** — scoped down. One high-stakes interaction test (Slot Response), not broad component coverage.

**Test tooling**: business-logic tests use the existing `node --test` setup (`src/**/*.test.ts`, already configured in `package.json`) — Server Actions and the pure functions they call are plain async/sync functions, importable and callable directly without spinning up a Next.js server. RLS tests need a real Postgres instance: **requires the Supabase CLI and Docker Desktop running locally** (`supabase start` spins up local Postgres + Auth). Flagging this now since it's a new local dependency — say if Docker isn't available and we'll adjust (e.g. testing RLS against a hosted Supabase dev project instead).

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

- [x] Hosted Supabase project `juice-bros` (ref `zhvhddzpgxtjdyrhgsqd`, region `ca-central-1`, Postgres 17), linked to this repo via `supabase link` — so `supabase db push` targets it.
- [x] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` set on the Vercel project for Production and Preview, the service-role key marked sensitive. Repo linked to Vercel (`lukabaseballs-projects/juice-bros`).

  **Deviation from issue #3 as written**: the ticket said to use Vercel's Supabase *marketplace* integration. We used a directly-owned Supabase account instead, with env vars pushed via `vercel env add`. Reason: nearly every ticket from Phase 2 on ships migrations, and `supabase link` + `db push` against a project we own directly is the cleaner loop; the marketplace's benefit was a one-time env-var convenience. Same end state, different ownership.

- Project security settings chosen at creation, both reinforcing ADR 0003:
  - **Automatic RLS enabled** — every new table gets RLS on by default, so a table can't ship unprotected by accident. Expect a brand-new table to return zero rows until policies exist; that's the safety net, not a bug.
  - **"Automatically expose new tables" disabled** — tables are not granted to the Data API roles by default; each migration grants explicitly.

### Outstanding — needs a human (cannot be done by an agent)

- [ ] Google Cloud OAuth credentials, needed by Phase 1 / issue #4 (sign-in).

### Local vs hosted

`.env` points at the **local** Docker stack (`127.0.0.1:54321`) and should stay that way — `npm run test:rls` and day-to-day development run against local Postgres. The hosted project is only used by deployed environments.

### Deferred follow-up

- [ ] Booking Buddy is not listed in `src/data/apps.ts`, so it doesn't appear on `/tools` or in the sitemap. Deliberate for now — there's nothing usable to link to yet. Add the entry once sign-in and a real dashboard exist, so the Apps section doesn't advertise a dead end.

## Phase 1 — User + Auth

- [ ] 1.1 Schema: `public.profiles` (id references `auth.users`, display_name) + trigger to auto-create a profile row on signup
- [ ] 1.2 🔴 Test: inserting a row into `auth.users` results in a matching `profiles` row → 🟢 implement `handle_new_user()` trigger
- [ ] 1.3 Auth UI: sign-in page offering magic link (primary), Google OAuth, and email/password (Q3) — no dedicated seam test, manual verification (UI scoped down)

## Phase 2 — Connection

- [ ] 2.1 Schema: `connections` (requester_id, addressee_id, status: pending/accepted, created_at)
- [ ] 2.2 🔴 Test: `sendConnectionRequest` creates a pending Connection between two Users → 🟢 implement
- [ ] 2.3 🔴 Test: `acceptConnectionRequest` flips status to accepted; only the addressee can accept, requester attempting it is rejected → 🟢 implement
- [ ] 2.4 🔴 Test: `sendConnectionRequest` rejects a duplicate pending request between the same pair → 🟢 implement
- [ ] 2.5 🔴 RLS test: querying `connections` directly as a third User (not requester or addressee) returns no row → 🟢 implement coarse policy

## Phase 3 — Friend Group + Visibility

- [ ] 3.1 Schema: `friend_groups` (owner_id, name), `friend_group_members` (group_id, connection_id), `visibility_overrides` (owner_id, connection_id, level)
- [ ] 3.2 🔴 Test: `createFriendGroup` creates a group owned by the caller → 🟢 implement
- [ ] 3.3 🔴 Test: `assignToGroup` rejects a Connection that isn't `accepted` yet → 🟢 implement guard
- [ ] 3.4 🔴 Test: `resolveVisibility` — a per-friend override always wins over any group default (pure function, no DB) → 🟢 implement
- [ ] 3.5 🔴 Test: `resolveVisibility` — a friend in two groups with different levels resolves to the most permissive → 🟢 implement
- [ ] 3.6 🔴 Test: `resolveVisibility` — a Connection with no group and no override defaults to no access → 🟢 implement
- [ ] 3.7 🔴 RLS test: querying `friend_groups`/`visibility_overrides` directly as a non-owner returns no rows → 🟢 implement coarse policy

## Phase 4 — Org + Booking

- [ ] 4.1 Schema: `orgs` (owner_id, name), `bookings` (org_id, owner_id, court_label, starts_at, ends_at)
- [ ] 4.2 🔴 Test: `createOrg` creates an Org owned by the caller → 🟢 implement
- [ ] 4.3 🔴 Test: `createBooking` requires an existing Org owned by the caller → 🟢 implement
- [ ] 4.4 🔴 RLS test: querying `bookings` directly as a non-owner returns no rows (Bookings are only friend-visible indirectly, via an attached Slot) → 🟢 implement coarse policy

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

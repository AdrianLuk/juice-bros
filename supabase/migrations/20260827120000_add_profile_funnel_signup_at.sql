-- Onboarding-funnel analytics (issue #179): the moment we first saw an
-- authenticated session for this account. Stamped once by the app (see
-- `trackSignupOnce` in `src/lib/booking-buddy/analytics.ts`) from every auth
-- entry point, and used only as the `bb_signup` dedupe guard and the t0 for
-- "time to first Facility / Booking / Slot" reads in the Vercel Analytics
-- console.
--
-- Not a security boundary and not load-bearing for any feature: nothing reads
-- it back at request time, and a User clearing or spoofing it via the Data
-- API only skews their own funnel row. Nullable, no default — an account that
-- predates this column backfills it (and emits one late `bb_signup`) on its
-- next sign-in.

alter table public.profiles
  add column funnel_signup_at timestamptz;

comment on column public.profiles.funnel_signup_at is
  'Analytics only (issue #179): first authenticated session seen for this account. App-set once; the bb_signup dedupe guard. Not a security boundary.';

-- No RLS/grant changes: the existing owner-only select/update policies on
-- profiles already cover this column, same as the gender column
-- (20260818160000_add_profile_gender.sql).

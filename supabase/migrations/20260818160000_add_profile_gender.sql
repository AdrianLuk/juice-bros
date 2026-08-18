-- A User's own Gender (issue #79) — the prerequisite for a gender-aware
-- Capacity signal on mixed/men's/women's Slots (a follow-up ticket, #80).
-- Nullable and optional by design: leaving it unset is a fully supported
-- state, not an error, and nothing here nags a User to fill it in.

alter table public.profiles
  add column gender text check (gender in ('male', 'female'));

comment on column public.profiles.gender is
  'Optional, self-reported (issue #79). Null means unset, not "prefer not to say" as a distinct value.';

-- No RLS/grant changes: the existing owner-only select/update policies on
-- profiles already cover this column like every other one on the table.

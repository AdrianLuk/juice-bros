-- A default facility (issue #47): which Org the Booking form's picker should
-- pre-select, so logging a booking at the place a User plays most doesn't
-- need an explicit pick every time.

alter table public.orgs
  add column is_default boolean not null default false;

comment on column public.orgs.is_default is
  'Pre-selects this Org in the Booking form. At most one true row per owner — see orgs_one_default_per_owner.';

-- At most one default per owner, enforced here rather than only on the write
-- path, matching this schema's usual preference for a database invariant
-- over a promise the app code has to keep on every write (see
-- orgs_unique_name_per_owner above for the same shape of index).
create unique index orgs_one_default_per_owner
  on public.orgs (owner_id)
  where is_default;

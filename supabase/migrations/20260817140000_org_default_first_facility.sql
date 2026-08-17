-- The first facility a User adds becomes their default automatically
-- (issue #55, a follow-up to #47): with nothing marked yet, "the one you
-- just added" is the only sensible pre-select for the Booking form's picker,
-- and asking a brand-new User to flip an explicit "make this my default"
-- toggle before they've even added a second venue is a step nobody would
-- expect to need.

-- Backfill first: any owner who added Orgs before this trigger existed and
-- never set a default gets their oldest one marked, matching what the
-- trigger below would have done had it existed at insert time. `distinct on`
-- picks one row per owner, so this can never mark two Orgs for the same
-- owner and trip `orgs_one_default_per_owner`.
update public.orgs o
set is_default = true
from (
  select distinct on (owner_id) id, owner_id
  from public.orgs
  order by owner_id, created_at asc
) first_org
where o.id = first_org.id
  and not exists (
    select 1 from public.orgs d
    where d.owner_id = first_org.owner_id and d.is_default
  );

-- A trigger rather than an app-level check, matching this schema's usual
-- preference for a database invariant over a promise the app code has to
-- keep on every write (see `orgs_one_default_per_owner`'s own comment for
-- the same reasoning): two Org-creation paths already write to this table
-- (`createOrg`, `pickPlace`), and a third would just need the same logic
-- copied a third time.
create function public.orgs_default_first_facility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.orgs where owner_id = new.owner_id
  ) then
    new.is_default := true;
  end if;

  return new;
end;
$$;

create trigger orgs_default_first_facility
  before insert on public.orgs
  for each row execute function public.orgs_default_first_facility();

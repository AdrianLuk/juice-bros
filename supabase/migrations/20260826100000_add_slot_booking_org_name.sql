-- `slot_bookings` deliberately kept "where and which court" private to a
-- friend (the table's own creation migration) — but Product now wants the
-- facility itself on a Slot's title even for a friend, same breadth as the
-- court count they already see. `org_name` is a resolved-display-name
-- snapshot, not a foreign key to `orgs`: a friend's RLS can read
-- `slot_bookings` but not `orgs` or `bookings`, so there is nothing on their
-- side to join against. Copying the resolved text — the same "copy at
-- attach, re-sync on edit" shape `format` already uses — is what lets them
-- read it without `orgs` or `bookings` ever having to open up. The exact
-- court label and the Booking itself stay owner-only, unchanged.

alter table public.slot_bookings add column org_name text;

-- Backfill for whatever is already attached. Mirrors `orgDisplayName`
-- (src/lib/booking-buddy/orgs.ts): the owner's own typed name first, the
-- cached Place's name second, and the same fallback string third.
update public.slot_bookings sb
set org_name = coalesce(
  nullif(btrim(o.name), ''),
  nullif(btrim(pc.name), ''),
  'Facility details unavailable'
)
from public.bookings b
join public.orgs o on o.id = b.org_id
left join public.place_cache pc on pc.place_id = o.google_place_id
where b.id = sb.booking_id;

alter table public.slot_bookings alter column org_name set not null;

comment on column public.slot_bookings.org_name is
  'The attached booking''s facility, resolved to display text at attach time (mirrors orgDisplayName) and re-synced whenever the booking''s own org_id changes. Friend-visible, unlike court_label or the booking itself.';

-- Re-derive `assert_slot_booking_coherent` to also stamp `org_name` at
-- attach time, same "trust the Booking, not whatever the insert claimed"
-- posture it already takes for `format`.
create or replace function public.assert_slot_booking_coherent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  slot_owner uuid;
  booking_owner uuid;
  booking_format public.booking_format;
  resolved_org_name text;
begin
  select s.owner_id into slot_owner from public.slots s where s.id = new.slot_id;
  select b.owner_id, b.format into booking_owner, booking_format
    from public.bookings b where b.id = new.booking_id;

  if slot_owner is null or booking_owner is null or slot_owner <> booking_owner then
    raise exception 'a booking can only be attached to its own owner''s slot'
      using errcode = 'check_violation';
  end if;

  select coalesce(nullif(btrim(o.name), ''), nullif(btrim(pc.name), ''), 'Facility details unavailable')
    into resolved_org_name
    from public.bookings b
    join public.orgs o on o.id = b.org_id
    left join public.place_cache pc on pc.place_id = o.google_place_id
    where b.id = new.booking_id;

  new.format := booking_format;
  new.org_name := resolved_org_name;

  return new;
end;
$$;

/**
 * Reassigning an already-attached Booking's facility (issue #97's Facility
 * field on the edit form) has to re-derive the friend-visible copy
 * immediately, not just at attach time — the same gap `sync_slot_booking_format`
 * closed for `format`. Fires only when `org_id` actually changes, and only
 * `security definer` reaches `slot_bookings`: it deliberately has no UPDATE
 * grant for `authenticated` (re-pointing a row by hand is a detach-and-attach,
 * not an edit), and this system-driven sync is the one exception to that.
 */
create function public.sync_slot_booking_org_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_org_name text;
begin
  if new.org_id is distinct from old.org_id then
    select coalesce(nullif(btrim(o.name), ''), nullif(btrim(pc.name), ''), 'Facility details unavailable')
      into resolved_org_name
      from public.orgs o
      left join public.place_cache pc on pc.place_id = o.google_place_id
      where o.id = new.org_id;

    update public.slot_bookings
    set org_name = resolved_org_name
    where booking_id = new.id;
  end if;

  return new;
end;
$$;

create trigger bookings_sync_slot_booking_org_name
  after update on public.bookings
  for each row execute function public.sync_slot_booking_org_name();

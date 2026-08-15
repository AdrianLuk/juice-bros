-- time_zone belongs to the Org (the facility's clock), not the Booking
-- (issue #20). Every Booking at one Org is on the same clock — per-Booking
-- storage let two Bookings at one place disagree, which is meaningless — and
-- it defaulted to the browser's zone at entry time: log a Toronto booking
-- while travelling in Tokyo and the stored instant is four hours out, silently.
--
-- Additive here: add orgs.time_zone, backfill it, and move the zone-validity
-- check off bookings and onto orgs. The destructive drop of bookings.time_zone
-- is a separate migration, per the project's "additive first, destructive
-- second" discipline for anything already pushed to the hosted project.

alter table public.orgs add column time_zone text;

-- Backfilled from each Org's own Bookings, before NOT NULL is enforced. Picks
-- the most recently created Booking's zone as a single answer for an Org that
-- (pre-#20) could in principle have disagreeing rows across its Bookings. An
-- Org with no Bookings yet has nothing to derive from — 'UTC' is a stopgap for
-- that case, not a real default: the app itself never lets an Org be created
-- without a zone from this point on.
with backfill as (
  select distinct on (b.org_id) b.org_id, b.time_zone
  from public.bookings b
  order by b.org_id, b.created_at desc
)
update public.orgs o
set time_zone = backfill.time_zone
from backfill
where backfill.org_id = o.id;

update public.orgs set time_zone = 'UTC' where time_zone is null;

alter table public.orgs alter column time_zone set not null;

comment on column public.orgs.time_zone is
  'The facility''s own clock. Every Booking under this Org renders on it, regardless of who is viewing or where they are.';

-- Bookings stop carrying their own zone as of this deploy — the column stays
-- for now (dropped in the next migration) but the app stops writing to it
-- immediately, so it has to become nullable here, ahead of the drop.
alter table public.bookings alter column time_zone drop not null;

/**
 * An Org's time zone has to be one Postgres itself recognises — otherwise
 * every Booking under it renders unrenderable later, discovered at Reminder
 * time rather than at the door. Same rule `assert_booking_coherent` used to
 * enforce on `bookings.time_zone`; it moves here with the column.
 *
 * Skips a null `time_zone` rather than reporting it as "unknown" — BEFORE ROW
 * triggers run ahead of NOT NULL enforcement in Postgres, so without this
 * guard a missing zone would surface as this trigger's `check_violation`
 * instead of the clearer `not_null_violation` the column constraint raises.
 */
create function public.assert_org_time_zone_known()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.time_zone is not null and not exists (
    select 1 from pg_catalog.pg_timezone_names t where t.name = new.time_zone
  ) then
    raise exception 'unknown time zone %', new.time_zone
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger orgs_time_zone_known
  before insert or update on public.orgs
  for each row execute function public.assert_org_time_zone_known();

-- assert_booking_coherent, replaced: the org-ownership check stays; the
-- zone-validity branch is gone, since there is no longer a per-Booking zone to
-- validate — the trigger above guards it on orgs instead.
create or replace function public.assert_booking_coherent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.orgs o
    where o.id = new.org_id
      and o.owner_id = new.owner_id
  ) then
    raise exception 'a booking can only sit under one of your own orgs'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- No new grants: orgs is already granted select/insert/update/delete to
-- authenticated (20260814160000_create_orgs_and_bookings.sql); adding a
-- column and a trigger doesn't change that.

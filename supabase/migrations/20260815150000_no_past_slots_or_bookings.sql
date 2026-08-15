-- A Slot proposal or a Booking dated before right now isn't a real one — both
-- represent something a User is doing going forward, not a record of
-- something that already happened (that distinction is what separates a
-- Booking from a diary entry). Scoped to INSERT only, not UPDATE: neither
-- table has an edit path today, and a rule meant to stop someone *posting*
-- something in the past has no business retroactively blocking an unrelated
-- future update to a row whose start time has since passed.
--
-- `starts_at`/`proposed_start` are already instants (`timestamptz`) by the
-- time either trigger runs, so this is a direct comparison against `now()` —
-- no time-zone math needed here the way the JS-side pre-checks
-- (`isPastDate` in datetime.ts) have to approximate; Postgres already did
-- the zone-aware conversion at the value's own construction.

create function public.assert_slot_not_in_the_past()
returns trigger
language plpgsql
as $$
begin
  if new.proposed_start <= now() then
    raise exception 'a slot cannot be proposed in the past'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger slots_not_in_the_past
  before insert on public.slots
  for each row execute function public.assert_slot_not_in_the_past();

create function public.assert_booking_not_in_the_past()
returns trigger
language plpgsql
as $$
begin
  if new.starts_at <= now() then
    raise exception 'a booking cannot start in the past'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger bookings_not_in_the_past
  before insert on public.bookings
  for each row execute function public.assert_booking_not_in_the_past();

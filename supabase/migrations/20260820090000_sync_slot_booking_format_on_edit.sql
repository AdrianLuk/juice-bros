-- ADR 0008's copy-on-attach `slot_bookings.format` could not drift only
-- because a Booking's own `format` had no edit path — Bookings became fully
-- editable (issue #97), so that protection is gone. Nothing yet re-derives an
-- already-attached `slot_bookings` row's `format` when the Booking it mirrors
-- is edited, leaving a friend's Capacity view stale the moment an organizer
-- fixes a booking they logged as the wrong format (issue #102, closing the
-- gap ADR 0008 itself flags).
--
-- A trigger on `bookings`, not a retarget of `assert_slot_booking_coherent`:
-- that function's contract is "validate and stamp `NEW` on the `slot_bookings`
-- row being inserted", which has nothing to read or write when the write is
-- an UPDATE on `bookings` instead. `after`, not `before`, since this trigger
-- has no `NEW` of its own to hand back — its only job is a side-effect write
-- to a different table — and `security definer` for the same reason
-- `seed_visibility_overrides_on_accept` needs it: `slot_bookings` deliberately
-- has no UPDATE policy for `authenticated` (re-pointing a row by hand is a
-- detach-and-attach, not an edit), and this system-driven sync is the one
-- exception to that, not a new hole in it.

create function public.sync_slot_booking_format()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.format is distinct from old.format then
    update public.slot_bookings
    set format = new.format
    where booking_id = new.id;
  end if;

  return new;
end;
$$;

create trigger bookings_sync_slot_booking_format
  after update on public.bookings
  for each row execute function public.sync_slot_booking_format();

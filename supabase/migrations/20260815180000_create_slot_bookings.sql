-- Attaching Bookings to a Slot: the second half of Phase 5's schema (issue
-- #9), the part `20260815130000_create_slots_and_responses.sql` deliberately
-- left out. A Slot with at least one Booking attached is a confirmed Slot; one
-- with none is still a bare proposal (ADR 0001).
--
-- A join table rather than a `slot_id` column on `bookings`, because a
-- gathering that spans several court reservations is one Slot with several
-- Bookings (CONTEXT.md's Booking entry) — and because a Booking exists in its
-- own right whether or not it was ever proposed to anyone.
--
-- Not a place where Capacity lives: Capacity is derived from each attached
-- Booking's own `format` plus the Slot's own `rotation_buffer`, computed by
-- `computeCapacity` in application code, and never stored.

create table public.slot_bookings (
  slot_id uuid not null references public.slots (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  -- Copied from the Booking at attach time (by the trigger below), not read
  -- fresh from `bookings` on every query. That's what lets a friend who can
  -- see the Slot compute the same Capacity the organizer does — `bookings` is
  -- owner-only, `slot_bookings` isn't — and it can't drift, because a
  -- Booking's own `format` has no edit path once created.
  format public.booking_format not null,
  created_at timestamptz not null default now(),

  -- One row per pairing, and the natural read is "which Bookings does this
  -- Slot have", so the Slot leads the key. Attaching the same Booking twice
  -- raises `23505`, which `slotBookingWriteMessage` translates.
  primary key (slot_id, booking_id),

  -- A Booking is one physical court reservation; it cannot be the multi-court
  -- game's second court for two different Slots at once, or the same four
  -- seats would be counted into two Capacities. `unique` rather than a plain
  -- index also gives detaching-and-reattaching-elsewhere the cascade-lookup
  -- index it would otherwise need separately.
  constraint slot_bookings_booking_unique unique (booking_id)
);

comment on table public.slot_bookings is
  'Which Bookings are attached to a Slot. One or more turns a bare proposal into a confirmed Slot with real Capacity; zero rows is the proposal state, not a Slot with no room. A Booking can back at most one Slot.';

/**
 * A Booking can only be attached to a Slot by the User who owns both, and its
 * `format` is copied onto this row as the one point of truth — never taken
 * from whatever the insert itself supplied, so a client can't attach as
 * "doubles" a court it logged as singles.
 *
 * A trigger rather than a check constraint for the same reason
 * `assert_booking_coherent` is one: the rule needs subqueries. `security
 * definer` so it sees both rows regardless of the caller's own RLS — an
 * attach naming a Booking the caller cannot read should fail as
 * "not yours", not as "no such Booking".
 *
 * RLS below covers the Slot half of this too (the `with check` clause). The
 * Booking half is the part it cannot cover: the insert is on
 * `slot_bookings`, and nothing in that policy looks at whose Booking was
 * named.
 */
create function public.assert_slot_booking_coherent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  slot_owner uuid;
  booking_owner uuid;
  booking_format public.booking_format;
begin
  select s.owner_id into slot_owner from public.slots s where s.id = new.slot_id;
  select b.owner_id, b.format into booking_owner, booking_format
    from public.bookings b where b.id = new.booking_id;

  if slot_owner is null or booking_owner is null or slot_owner <> booking_owner then
    raise exception 'a booking can only be attached to its own owner''s slot'
      using errcode = 'check_violation';
  end if;

  new.format := booking_format;

  return new;
end;
$$;

create trigger slot_bookings_coherent
  before insert on public.slot_bookings
  for each row execute function public.assert_slot_booking_coherent();

alter table public.slot_bookings enable row level security;

-- Reads are as broad as the Slot itself, and no broader: a friend who can see
-- the Slot can count its courts — which is what makes the Capacity on their
-- screen the same number the organizer sees — but `bookings` stays owner-only,
-- so where and which court remain private. Nothing here widens that; this
-- table holds ids and a timestamp.
create policy "attached bookings are visible to whoever can see the slot"
  on public.slot_bookings for select
  to authenticated
  using (public.can_access_slot(slot_id, (select auth.uid())));

create policy "a User attaches bookings only to their own slot"
  on public.slot_bookings for insert
  to authenticated
  with check (
    exists (
      select 1 from public.slots s
      where s.id = slot_id and s.owner_id = (select auth.uid())
    )
  );

create policy "a User detaches bookings only from their own slot"
  on public.slot_bookings for delete
  to authenticated
  using (
    exists (
      select 1 from public.slots s
      where s.id = slot_id and s.owner_id = (select auth.uid())
    )
  );

-- No update policy on purpose: re-pointing a row at another Slot or Booking is
-- a detach and an attach, each of which is already checked.
grant select, insert, delete on public.slot_bookings to authenticated;

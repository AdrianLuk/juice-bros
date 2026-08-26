-- Attaching a Booking to a Slot is what turns a bare proposal into a confirmed
-- Slot with real Capacity (issue #9, ADR 0001). Four rules live at this layer:
--
--   * only the Slot's owner can attach or detach;
--   * the Booking attached has to be that same owner's — the half RLS cannot
--     see, enforced by `assert_slot_booking_coherent`;
--   * a friend who can see the Slot can count its courts (so the Capacity on
--     their screen matches the organizer's) without `bookings` itself becoming
--     friend-visible;
--   * a Booking backs at most one Slot — the same physical court can't be
--     counted into two Capacities at once;
--   * a Booking's `format` (singles/doubles, ADR 0008) is copied onto this row
--     by the coherence trigger, from the Booking itself — never from whatever
--     the insert supplied, so a tampered attach can't claim a singles court as
--     doubles;
--   * Capacity is not a ceiling anything enforces — "yes" Responses past it are
--     accepted, and the organizer gets a signal instead (ADR 0001). Asserted
--     here rather than left implicit, so a later "helpful" trigger that starts
--     refusing them fails a test instead of silently changing the product.

begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

select has_table('public', 'slot_bookings', 'slot_bookings table exists');
select has_column('public', 'slot_bookings', 'format', 'slot_bookings carries the attached booking''s format (ADR 0008)');
select has_column('public', 'slot_bookings', 'org_name', 'slot_bookings carries the attached booking''s resolved facility name, friend-visible unlike the booking itself');

-- Doubles as the referencing side of the `bookings` cascade, which Postgres
-- does not index for you — same reasoning as `bookings_org_id`.
select col_is_unique(
  'public', 'slot_bookings', array['booking_id'],
  'a booking can back at most one slot'
);

-- Amy owns the Slot and the Bookings. Ben is in a Friend Group of Amy's
-- defaulting to `slots` — he can see the Slot. Cal is an accepted Connection
-- with no group and no override, so he sees neither.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy-attach@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben-attach@example.com'),
  ('cccccccc-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal-attach@example.com');

insert into public.connections (id, requester_id, addressee_id, status) values
  ('44444444-0000-0000-0000-000000000041', 'aaaaaaaa-0000-0000-0000-000000000041', 'bbbbbbbb-0000-0000-0000-000000000042', 'accepted'),
  ('55555555-0000-0000-0000-000000000042', 'aaaaaaaa-0000-0000-0000-000000000041', 'cccccccc-0000-0000-0000-000000000043', 'accepted');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000041", "role": "authenticated"}';

insert into public.friend_groups (id, owner_id, name, default_visibility)
values ('66666666-0000-0000-0000-000000000041', 'aaaaaaaa-0000-0000-0000-000000000041', 'Attach crew', 'slots');

insert into public.friend_group_members (group_id, connection_id)
values ('66666666-0000-0000-0000-000000000041', '44444444-0000-0000-0000-000000000041');

insert into public.orgs (id, owner_id, name, time_zone)
values ('99999999-0000-0000-0000-000000000041', 'aaaaaaaa-0000-0000-0000-000000000041', 'Amy''s gym', 'America/Toronto');

-- Dated well out, so the `not in the past` triggers don't turn these fixtures
-- into a time bomb — the lesson from the #8 follow-up.
-- a1111111/a2222222 are the default format (doubles); a3333333 is explicitly
-- singles, for the format-copy test below.
insert into public.bookings (id, org_id, owner_id, court_label, starts_at, ends_at) values
  ('a1111111-0000-0000-0000-000000000041', '99999999-0000-0000-0000-000000000041', 'aaaaaaaa-0000-0000-0000-000000000041', 'Court 1', '2031-09-20 13:00:00+00', '2031-09-20 14:30:00+00'),
  ('a2222222-0000-0000-0000-000000000042', '99999999-0000-0000-0000-000000000041', 'aaaaaaaa-0000-0000-0000-000000000041', 'Court 2', '2031-09-20 13:00:00+00', '2031-09-20 14:30:00+00');

insert into public.bookings (id, org_id, owner_id, court_label, starts_at, ends_at, format) values
  ('a3333333-0000-0000-0000-000000000043', '99999999-0000-0000-0000-000000000041', 'aaaaaaaa-0000-0000-0000-000000000041', 'Court 3', '2031-09-20 13:00:00+00', '2031-09-20 14:30:00+00', 'singles');

insert into public.slots (id, owner_id, proposed_start, proposed_end, time_zone)
values (
  '77777777-0000-0000-0000-000000000041',
  'aaaaaaaa-0000-0000-0000-000000000041',
  '2031-09-20 13:00:00+00',
  '2031-09-20 14:30:00+00',
  'America/Toronto'
);

insert into public.slot_bookings (slot_id, booking_id)
values ('77777777-0000-0000-0000-000000000041', 'a1111111-0000-0000-0000-000000000041');

select is(
  (select count(*)::int from public.slot_bookings
   where slot_id = '77777777-0000-0000-0000-000000000041'),
  1,
  'the owner can attach their own booking to their own slot'
);

select is(
  (select org_name from public.slot_bookings
   where slot_id = '77777777-0000-0000-0000-000000000041'
     and booking_id = 'a1111111-0000-0000-0000-000000000041'),
  'Amy''s gym',
  'the attached facility name is resolved and copied from the booking''s own org at attach time'
);

select throws_ok(
  $$insert into public.slot_bookings (slot_id, booking_id)
    values ('77777777-0000-0000-0000-000000000041', 'a1111111-0000-0000-0000-000000000041')$$,
  '23505',
  null,
  'the same booking cannot be attached to the same slot twice'
);

-- Multi-court games are the reason this is a join table at all (CONTEXT.md's
-- Booking entry): two reservations, one Slot, combined Capacity.
insert into public.slot_bookings (slot_id, booking_id)
values ('77777777-0000-0000-0000-000000000041', 'a2222222-0000-0000-0000-000000000042');

select is(
  (select count(*)::int from public.slot_bookings
   where slot_id = '77777777-0000-0000-0000-000000000041'),
  2,
  'a slot can carry several bookings, which is what a multi-court game is'
);

-- Ben: can see the Slot, so he can count its courts — but the Bookings
-- themselves stay Amy's alone.
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000042", "role": "authenticated"}';

select is(
  (select count(*)::int from public.slot_bookings
   where slot_id = '77777777-0000-0000-0000-000000000041'),
  2,
  'a friend who can see the slot can count its courts, which is what Capacity is derived from'
);

select is(
  (select count(*)::int from public.bookings
   where owner_id = 'aaaaaaaa-0000-0000-0000-000000000041'),
  0,
  'attaching a booking to a visible slot does not make the booking itself friend-visible'
);

select throws_ok(
  $$insert into public.slot_bookings (slot_id, booking_id)
    values ('77777777-0000-0000-0000-000000000041', 'a1111111-0000-0000-0000-000000000041')$$,
  '42501',
  null,
  'a friend who can see the slot still cannot attach to it'
);

-- An RLS-filtered delete matches zero rows rather than raising (the Phase 4
-- lesson) — so this asserts the row is still there, not that anything threw.
delete from public.slot_bookings
  where slot_id = '77777777-0000-0000-0000-000000000041';

select is(
  (select count(*)::int from public.slot_bookings
   where slot_id = '77777777-0000-0000-0000-000000000041'),
  2,
  'a friend cannot detach a booking from someone else''s slot'
);

-- Cal: no Visibility into Amy at all, so the Slot and its courts are both
-- invisible — the count, not just the details.
set local request.jwt.claims = '{"sub": "cccccccc-0000-0000-0000-000000000043", "role": "authenticated"}';

select is(
  (select count(*)::int from public.slot_bookings
   where slot_id = '77777777-0000-0000-0000-000000000041'),
  0,
  'a User with no visibility into the slot cannot see its courts either'
);

-- Ben owns a Slot and a Booking of his own. Attaching Amy's Booking to his own
-- Slot passes RLS — it is his Slot — and is stopped by the coherence trigger
-- instead. This is the half RLS cannot see.
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000042", "role": "authenticated"}';

insert into public.slots (id, owner_id, proposed_start, proposed_end, time_zone)
values (
  '88888888-0000-0000-0000-000000000042',
  'bbbbbbbb-0000-0000-0000-000000000042',
  '2031-09-21 13:00:00+00',
  '2031-09-21 14:30:00+00',
  'America/Toronto'
);

select throws_ok(
  $$insert into public.slot_bookings (slot_id, booking_id)
    values ('88888888-0000-0000-0000-000000000042', 'a1111111-0000-0000-0000-000000000041')$$,
  '23514',
  null,
  'a User cannot attach someone else''s booking to their own slot'
);

-- Amy owns a second Slot too. Attaching a1111111 there fails on the unique
-- constraint, not the coherence trigger — it's already spoken for by
-- 77777777, and ownership isn't the problem this time.
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000041", "role": "authenticated"}';

insert into public.slots (id, owner_id, proposed_start, proposed_end, time_zone)
values (
  '99999999-0000-0000-0000-000000000045',
  'aaaaaaaa-0000-0000-0000-000000000041',
  '2031-09-22 13:00:00+00',
  '2031-09-22 14:30:00+00',
  'America/Toronto'
);

select throws_ok(
  $$insert into public.slot_bookings (slot_id, booking_id)
    values ('99999999-0000-0000-0000-000000000045', 'a1111111-0000-0000-0000-000000000041')$$,
  '23505',
  null,
  'the same booking cannot back two different slots at once'
);

-- Amy detaches: her Slot, her Booking, so both halves are satisfied.
delete from public.slot_bookings
  where slot_id = '77777777-0000-0000-0000-000000000041'
    and booking_id = 'a2222222-0000-0000-0000-000000000042';

select is(
  (select count(*)::int from public.slot_bookings
   where slot_id = '77777777-0000-0000-0000-000000000041'),
  1,
  'the owner can detach a booking, dropping the slot back to one court'
);

-- Issue #102: `format` could only drift out of sync while a Booking had no
-- edit path at all. Editing the already-attached a1111111's own format
-- (still doubles, its default) has to re-derive the copy on its
-- slot_bookings row immediately, not just at attach time (ADR 0008's gap).
update public.bookings set format = 'singles' where id = 'a1111111-0000-0000-0000-000000000041';

select is(
  (select format::text from public.slot_bookings
   where slot_id = '77777777-0000-0000-0000-000000000041'
     and booking_id = 'a1111111-0000-0000-0000-000000000041'),
  'singles',
  'editing an already-attached booking''s format re-derives the slot_bookings row''s own copy immediately'
);

-- Restored to its original format so the capacity test further down still
-- counts a1111111 as the ordinary doubles court it actually is.
update public.bookings set format = 'doubles' where id = 'a1111111-0000-0000-0000-000000000041';

-- Same gap, for the Facility field on that same edit form (issue #97):
-- reassigning an already-attached booking to a different Org has to
-- re-derive the friend-visible org_name immediately too.
insert into public.orgs (id, owner_id, name, time_zone)
values ('99999999-0000-0000-0000-000000000042', 'aaaaaaaa-0000-0000-0000-000000000041', 'Amy''s second gym', 'America/Toronto');

update public.bookings set org_id = '99999999-0000-0000-0000-000000000042' where id = 'a1111111-0000-0000-0000-000000000041';

select is(
  (select org_name from public.slot_bookings
   where slot_id = '77777777-0000-0000-0000-000000000041'
     and booking_id = 'a1111111-0000-0000-0000-000000000041'),
  'Amy''s second gym',
  'reassigning an already-attached booking''s org re-derives the slot_bookings row''s own facility name copy immediately'
);

-- Restored to its original org so nothing further down depends on the
-- reassignment above.
update public.bookings set org_id = '99999999-0000-0000-0000-000000000041' where id = 'a1111111-0000-0000-0000-000000000041';

-- Attach the singles booking, deliberately claiming "doubles" in the insert
-- itself — the trigger has to overwrite that with the Booking's true format,
-- not trust the value the client sent.
insert into public.slot_bookings (slot_id, booking_id, format)
values ('77777777-0000-0000-0000-000000000041', 'a3333333-0000-0000-0000-000000000043', 'doubles');

select is(
  (select format::text from public.slot_bookings
   where slot_id = '77777777-0000-0000-0000-000000000041'
     and booking_id = 'a3333333-0000-0000-0000-000000000043'),
  'singles',
  'the attached format is copied from the booking itself, not from whatever the insert claimed'
);

delete from public.slot_bookings
  where slot_id = '77777777-0000-0000-0000-000000000041'
    and booking_id = 'a3333333-0000-0000-0000-000000000043';

-- One court is four spots (ADR 0008) and the buffer is zero, so the fifth
-- "yes" is one past Capacity. It goes in like any other: over-capacity is a
-- signal the organizer reads, not a rule the database keeps.
set local role postgres;

insert into auth.users (id, instance_id, aud, role, email)
select
  ('f000000' || n || '-0000-0000-0000-000000000041')::uuid,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'yes-' || n || '-attach@example.com'
from generate_series(1, 5) as n;

insert into public.connections (id, requester_id, addressee_id, status)
select
  ('e000000' || n || '-0000-0000-0000-000000000041')::uuid,
  'aaaaaaaa-0000-0000-0000-000000000041',
  ('f000000' || n || '-0000-0000-0000-000000000041')::uuid,
  'accepted'
from generate_series(1, 5) as n;

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000041", "role": "authenticated"}';

insert into public.friend_group_members (group_id, connection_id)
select
  '66666666-0000-0000-0000-000000000041',
  ('e000000' || n || '-0000-0000-0000-000000000041')::uuid
from generate_series(1, 5) as n;

-- Each responds for themselves — the only way `responses`' own policy allows
-- it, so this is five real RSVPs rather than five rows planted as the owner.
set local request.jwt.claims = '{"sub": "f0000001-0000-0000-0000-000000000041", "role": "authenticated"}';
insert into public.responses (slot_id, user_id, answer)
values ('77777777-0000-0000-0000-000000000041', 'f0000001-0000-0000-0000-000000000041', 'yes');

set local request.jwt.claims = '{"sub": "f0000002-0000-0000-0000-000000000041", "role": "authenticated"}';
insert into public.responses (slot_id, user_id, answer)
values ('77777777-0000-0000-0000-000000000041', 'f0000002-0000-0000-0000-000000000041', 'yes');

set local request.jwt.claims = '{"sub": "f0000003-0000-0000-0000-000000000041", "role": "authenticated"}';
insert into public.responses (slot_id, user_id, answer)
values ('77777777-0000-0000-0000-000000000041', 'f0000003-0000-0000-0000-000000000041', 'yes');

set local request.jwt.claims = '{"sub": "f0000004-0000-0000-0000-000000000041", "role": "authenticated"}';
insert into public.responses (slot_id, user_id, answer)
values ('77777777-0000-0000-0000-000000000041', 'f0000004-0000-0000-0000-000000000041', 'yes');

set local request.jwt.claims = '{"sub": "f0000005-0000-0000-0000-000000000041", "role": "authenticated"}';
insert into public.responses (slot_id, user_id, answer)
values ('77777777-0000-0000-0000-000000000041', 'f0000005-0000-0000-0000-000000000041', 'yes');

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000041", "role": "authenticated"}';

select is(
  (select count(*)::int from public.responses
   where slot_id = '77777777-0000-0000-0000-000000000041'
     and answer = 'yes'),
  5,
  'a yes past Capacity is accepted — over-capacity is a signal, not a block'
);

select * from finish();

rollback;

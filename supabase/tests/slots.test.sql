-- A Slot is the friend-facing proposal/game unit (see CONTEXT.md, ADR 0001).
-- Like `availability_windows`, its read policy is not pure ownership: it is
-- gated on at least `slots`-level Visibility (`has_slot_visibility`). This
-- proves that boundary, and the `responses` table's boundary alongside it
-- (`can_access_slot`, reused by both) — not the override/group precedence
-- chain itself, which visibility.test.ts already covers.

begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select has_table('public', 'slots', 'slots table exists');
select has_table('public', 'responses', 'responses table exists');

-- Amy owns the Slot under test. Ben is in a Friend Group of Amy's defaulting
-- to `slots` — visible. Cal is an accepted Connection with no group and no
-- override — not visible, `slots` is not the default. Dave has no Connection
-- to Amy at all — not visible either.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy-slot@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben-slot@example.com'),
  ('cccccccc-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal-slot@example.com'),
  ('dddddddd-0000-0000-0000-000000000034', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dave-slot@example.com');

insert into public.connections (id, requester_id, addressee_id, status) values
  ('44444444-0000-0000-0000-000000000031', 'aaaaaaaa-0000-0000-0000-000000000031', 'bbbbbbbb-0000-0000-0000-000000000032', 'accepted'),
  ('55555555-0000-0000-0000-000000000032', 'aaaaaaaa-0000-0000-0000-000000000031', 'cccccccc-0000-0000-0000-000000000033', 'accepted');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000031", "role": "authenticated"}';

insert into public.friend_groups (id, owner_id, name, default_visibility)
values ('66666666-0000-0000-0000-000000000031', 'aaaaaaaa-0000-0000-0000-000000000031', 'Slots crew', 'slots');

insert into public.friend_group_members (group_id, connection_id)
values ('66666666-0000-0000-0000-000000000031', '44444444-0000-0000-0000-000000000031');

-- Dated a comfortable distance out (not merely "later than 2026-08-15,
-- today") so the `slots_not_in_the_past` trigger doesn't turn this fixture
-- into a ticking time bomb that starts failing once the date arrives.
insert into public.slots (id, owner_id, proposed_start, proposed_end, time_zone)
values (
  '77777777-0000-0000-0000-000000000031',
  'aaaaaaaa-0000-0000-0000-000000000031',
  '2031-08-22 13:00:00+00',
  '2031-08-22 14:30:00+00',
  'America/Toronto'
);

select is(
  (select count(*)::int from public.slots
   where id = '77777777-0000-0000-0000-000000000031'),
  1,
  'the owner can create and read their own slot'
);

select throws_ok(
  $$insert into public.slots (owner_id, proposed_start, proposed_end, time_zone)
    values ('bbbbbbbb-0000-0000-0000-000000000032', '2031-08-22 13:00:00+00', '2031-08-22 14:30:00+00', 'America/Toronto')$$,
  '42501',
  null,
  'a User cannot create a slot owned by someone else'
);

-- A Slot represents something going forward, not a record of something that
-- already happened — unambiguously past, so this holds regardless of when
-- the suite actually runs.
select throws_ok(
  $$insert into public.slots (owner_id, proposed_start, proposed_end, time_zone)
    values ('aaaaaaaa-0000-0000-0000-000000000031', '2020-01-01 13:00:00+00', '2020-01-01 14:30:00+00', 'America/Toronto')$$,
  '23514',
  null,
  'a slot cannot be proposed in the past'
);

-- Ben: accepted Connection, slots-visible via the group he's in.
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000032", "role": "authenticated"}';

select is(
  (select count(*)::int from public.slots
   where owner_id = 'aaaaaaaa-0000-0000-0000-000000000031'),
  1,
  'a friend with slots Visibility into the owner can read their slot'
);

-- Ben can respond: he can see the slot, so can_access_slot admits his insert.
insert into public.responses (slot_id, user_id, answer)
values ('77777777-0000-0000-0000-000000000031', 'bbbbbbbb-0000-0000-0000-000000000032', 'yes');

select is(
  (select answer::text from public.responses
   where slot_id = '77777777-0000-0000-0000-000000000031'
     and user_id = 'bbbbbbbb-0000-0000-0000-000000000032'),
  'yes',
  'a slots-visible friend can respond to the slot'
);

-- An RLS-filtered write matches zero rows rather than raising (Phase 4's
-- lesson) — Ben cannot record a response as anyone but himself.
select throws_ok(
  $$insert into public.responses (slot_id, user_id, answer)
    values ('77777777-0000-0000-0000-000000000031', 'aaaaaaaa-0000-0000-0000-000000000031', 'yes')$$,
  '42501',
  null,
  'a User cannot record a response on behalf of someone else'
);

-- Cal: accepted Connection, but no group and no override — no slots Visibility.
set local request.jwt.claims = '{"sub": "cccccccc-0000-0000-0000-000000000033", "role": "authenticated"}';

select is(
  (select count(*)::int from public.slots
   where owner_id = 'aaaaaaaa-0000-0000-0000-000000000031'),
  0,
  'an accepted Connection with no slots Visibility sees no slots'
);

select is(
  (select count(*)::int from public.responses
   where slot_id = '77777777-0000-0000-0000-000000000031'),
  0,
  'a User with no visibility into the slot cannot even see who responded'
);

-- Unlike an update filtered by USING, an INSERT that fails WITH CHECK raises
-- rather than silently doing nothing — there is no existing row to fall back
-- to reporting as "unchanged".
select throws_ok(
  $$insert into public.responses (slot_id, user_id, answer)
    values ('77777777-0000-0000-0000-000000000031', 'cccccccc-0000-0000-0000-000000000033', 'yes')$$,
  '42501',
  null,
  'a User with no visibility into the slot cannot respond to it'
);

-- Dave: no Connection to the owner at all.
set local request.jwt.claims = '{"sub": "dddddddd-0000-0000-0000-000000000034", "role": "authenticated"}';

select is(
  (select count(*)::int from public.slots
   where owner_id = 'aaaaaaaa-0000-0000-0000-000000000031'),
  0,
  'a User with no Connection at all sees no slots'
);

-- Amy (the owner) sees every response on her own slot, including Ben's.
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000031", "role": "authenticated"}';

select is(
  (select count(*)::int from public.responses
   where slot_id = '77777777-0000-0000-0000-000000000031'),
  1,
  'the owner sees every response on their own slot'
);

-- Ben changes his own response — an update, not a second row (the unique
-- index on (slot_id, user_id) plus `respondToSlot`'s upsert is what makes
-- this the normal path, but the RLS boundary matters independent of that).
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000032", "role": "authenticated"}';

update public.responses set answer = 'no'
  where slot_id = '77777777-0000-0000-0000-000000000031'
    and user_id = 'bbbbbbbb-0000-0000-0000-000000000032';

select is(
  (select answer::text from public.responses
   where slot_id = '77777777-0000-0000-0000-000000000031'
     and user_id = 'bbbbbbbb-0000-0000-0000-000000000032'),
  'no',
  'a User can change their own response'
);

-- An explicit override closes Ben back out, same lesson as availability_windows.test.sql.
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000031", "role": "authenticated"}';

insert into public.visibility_overrides (owner_id, connection_id, level)
values ('aaaaaaaa-0000-0000-0000-000000000031', '44444444-0000-0000-0000-000000000031', 'none');

set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000032", "role": "authenticated"}';

select is(
  (select count(*)::int from public.slots
   where owner_id = 'aaaaaaaa-0000-0000-0000-000000000031'),
  0,
  'a per-friend override below slots wins over the group default, closing the slot back off'
);

select * from finish();

rollback;

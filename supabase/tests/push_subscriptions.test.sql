-- Web push (issue #12). One thing to prove at this layer: `push_subscriptions`
-- is owner-managed the same shape every other Booking Buddy table starts
-- from (ADR 0003) — a User can create and read their own device
-- subscriptions, and nobody else's Connection status or Visibility level
-- opens a door into them, matching `notification_preferences.test.sql`'s
-- (folded into `reminders.test.sql`) reasoning for the table it sits beside.

begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select has_table('public', 'push_subscriptions', 'push_subscriptions table exists');
select has_column('public', 'push_subscriptions', 'endpoint', 'push_subscriptions.endpoint exists');

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000081', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy-push@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000082', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben-push@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000081", "role": "authenticated"}';

-- Amy can subscribe a device of her own.
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
values (
  'aaaaaaaa-0000-0000-0000-000000000081',
  'https://push.example.com/amy-device-1',
  'amy-p256dh',
  'amy-auth'
);

select is(
  (select count(*)::int from public.push_subscriptions
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000081'),
  1,
  'the owner can create and read their own push subscription'
);

select throws_ok(
  $$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values ('bbbbbbbb-0000-0000-0000-000000000082', 'https://push.example.com/spoofed', 'x', 'y')$$,
  '42501',
  null,
  'a User cannot create a push subscription on someone else''s behalf'
);

-- Ben: no Connection at all here, and this table isn't part of what
-- Visibility opens up in the first place — same posture reminders.test.sql
-- already proves for notification_preferences.
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000082", "role": "authenticated"}';

select is(
  (select count(*)::int from public.push_subscriptions
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000081'),
  0,
  'another User cannot read someone else''s push subscriptions'
);

-- A DELETE filtered by `using` matches zero rows rather than raising (the
-- same lesson every other RLS test file in this suite already carries).
delete from public.push_subscriptions
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000081';

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000081", "role": "authenticated"}';

select is(
  (select count(*)::int from public.push_subscriptions
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000081'),
  1,
  'another User''s attempted delete is silently filtered, not applied'
);

-- The owner can remove their own device.
delete from public.push_subscriptions
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000081';

select is(
  (select count(*)::int from public.push_subscriptions
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000081'),
  0,
  'the owner can remove their own push subscription'
);

-- No `authenticated` grant allows an UPDATE at all (subscribing again is
-- always an insert-or-delete, never an in-place edit through the app) — the
-- table's own `for all` policy still means Postgres checks privilege first,
-- so this is refused before RLS even runs.
select throws_ok(
  $$update public.push_subscriptions set endpoint = 'anything' where true$$,
  '42501',
  null,
  'no authenticated User has UPDATE privilege on push_subscriptions'
);

select * from finish();

rollback;

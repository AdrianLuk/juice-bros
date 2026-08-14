-- A User (see CONTEXT.md) is an auth.users row plus a public profile holding
-- the display name other Users see. The profile must appear automatically on
-- signup — nothing in the app should have to remember to create one.

begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

-- Shape first: the app reads these columns, so their absence is a failure.
select has_table('public', 'profiles', 'profiles table exists');
select has_column('public', 'profiles', 'id', 'profiles.id exists');
select has_column('public', 'profiles', 'display_name', 'profiles.display_name exists');

-- Signing up creates the profile.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'newuser@example.com',
  '{"display_name": "Amy Ace"}'::jsonb
);

select is(
  (select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  1,
  'signing up creates exactly one profile'
);

select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Amy Ace',
  'the display name supplied at signup is carried onto the profile'
);

-- Someone signing up by magic link supplies no metadata, so the profile must
-- still be created rather than failing a not-null constraint.
insert into auth.users (id, instance_id, aud, role, email)
values (
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'nometadata@example.com'
);

select is(
  (select count(*)::int from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  1,
  'a signup with no display name still gets a profile'
);

-- Both test Users are visible to the table owner, who bypasses RLS. Scoped to
-- this test's own ids rather than counting the whole table, so a database with
-- other rows in it doesn't fail the test. It makes the contrast below load-
-- bearing: if RLS silently stopped filtering, the next assertion would see 2.
select is(
  (select count(*)::int from public.profiles
   where id in ('11111111-1111-1111-1111-111111111111',
                '22222222-2222-2222-2222-222222222222')),
  2,
  'both test profiles are visible to the table owner, who bypasses RLS'
);

-- Row Level Security, exercised the way a real request arrives: as the
-- `authenticated` role carrying a JWT whose `sub` is the acting User.
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(
  (select count(*)::int from public.profiles
   where id in ('11111111-1111-1111-1111-111111111111',
                '22222222-2222-2222-2222-222222222222')),
  1,
  'a signed-in User sees only their own profile, not the other test User''s'
);

-- Unscoped on purpose: RLS should hide *every* other profile in the database,
-- not merely the one this test happened to create.
select is(
  (select count(*)::int from public.profiles),
  1,
  'and no other profile in the database is visible either'
);

select is(
  (select id::text from public.profiles),
  '11111111-1111-1111-1111-111111111111',
  'the single visible row is their own'
);

reset role;

select * from finish();

rollback;

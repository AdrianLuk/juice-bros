-- A Username is the handle a User shares so friends can find them, without
-- handing out an email address. Unlike the email it is safe to show in search
-- results, so it is the discovery key the UI leans on.

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select has_column('public', 'profiles', 'username', 'profiles has a username');

-- Everyone gets one at signup: a User who never opens settings must still be
-- findable, so this cannot be left for them to fill in later.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy@example.com', '{"display_name": "Amy Pgtap"}'::jsonb);

select is(
  (select username from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'amypgtap',
  'a username is derived from the display name at signup'
);

-- Magic-link signups supply no name at all.
insert into auth.users (id, instance_id, aud, role, email) values
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben.pgtap@example.com');

select is(
  (select username from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  'benpgtap',
  'with no display name it falls back to the email local part'
);

-- Two Amy Aces must not collide.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy2@example.com', '{"display_name": "Amy Pgtap"}'::jsonb);

select isnt(
  (select username from public.profiles where id = 'cccccccc-0000-0000-0000-000000000003'),
  'amypgtap',
  'a colliding username is made unique rather than failing the signup'
);

-- Stated as the invariant rather than a row count, so it holds whatever else
-- is in the local database — and it now asserts what the unique index actually
-- enforces, which is case-insensitive uniqueness.
select is(
  (select count(distinct lower(username))::int from public.profiles),
  (select count(username)::int from public.profiles),
  'every username is distinct, ignoring case'
);

-- Chosen usernames are constrained: they appear in URLs and get typed by
-- people reading them off a phone screen.
select throws_ok(
  $$update public.profiles set username = 'no spaces'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  null, null,
  'a username cannot contain spaces'
);

select throws_ok(
  $$update public.profiles set username = 'ab'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  null, null,
  'a username cannot be shorter than three characters'
);

select throws_ok(
  $$update public.profiles set username = 'benpgtap'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  null, null,
  'a username already taken cannot be claimed'
);

-- The point of the whole thing: findable by handle, without knowing an email.
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000001", "role": "authenticated"}';

select is(
  (select count(*)::int from public.search_users('benpgtap')),
  1,
  'a User can be found by their exact username'
);

reset role;

select * from finish();

rollback;

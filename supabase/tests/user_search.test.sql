-- Finding someone to befriend is a chicken-and-egg problem: profiles are only
-- readable once you are connected, but you must find someone before you can
-- ask. Search resolves it deliberately — you can look someone up if you
-- already know who you are looking for, but you cannot browse the membership.

begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

-- Names carry a "Pgtap" surname so the assertions below hold whatever else is
-- in the local database. `search_users` searches globally by design, so a
-- fixture called plain "Ben" would have its count thrown off by any real Ben —
-- the seeded dev accounts did exactly that.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy@example.com',   '{"display_name": "Amy Pgtap"}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben@example.com',   '{"display_name": "Ben Pgtap"}'::jsonb),
  ('cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal@example.com',   '{"display_name": "Cal Pgtap"}'::jsonb);

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000001", "role": "authenticated"}';

select is(
  (select count(*)::int from public.search_users('Ben Pgtap')),
  1,
  'a User can be found by name without being connected first'
);

select is(
  (select display_name from public.search_users('Ben Pgtap')),
  'Ben Pgtap',
  'search returns the display name, so the result is recognisable'
);

select is(
  (select count(*)::int from public.search_users('ben@example.com')),
  1,
  'a User can be found by their exact email address'
);

-- Email is a lookup key, never an output: otherwise search becomes a way to
-- harvest the address of everyone whose name you can guess.
select is(
  (select count(*)::int
   from pg_attribute a
   join pg_type t on t.typrelid = a.attrelid
   where t.typname = 'user_search_result'
     and a.attnum > 0
     and a.attname = 'email'),
  0,
  'the search result has no email column, so addresses cannot be harvested'
);

select is(
  (select count(*)::int from public.search_users('example.com')),
  0,
  'a partial email matches nothing, so addresses cannot be enumerated'
);

select is(
  (select count(*)::int from public.search_users('a')),
  0,
  'a too-short query returns nothing rather than listing the membership'
);

select is(
  (select count(*)::int from public.search_users('Amy Pgtap')),
  0,
  'a User never finds themselves in search results'
);

-- Knowing whether you already asked keeps the UI honest.
insert into public.connections (requester_id, addressee_id)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');

select is(
  (select connection_status::text from public.search_users('Ben Pgtap')),
  'pending',
  'search reports an existing Connection so the UI can show its state'
);

reset role;

select * from finish();

rollback;

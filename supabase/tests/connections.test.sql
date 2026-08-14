-- A Connection (see CONTEXT.md) is a mutual, two-sided friendship: one User
-- sends a request, the other accepts. It is symmetric, so A→B and B→A are the
-- same relationship, not two — the schema has to enforce that rather than
-- trusting callers to check first.

begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

select has_table('public', 'connections', 'connections table exists');

-- Three Users: two who will connect, and a third who must never see them.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben@example.com'),
  ('cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal@example.com');

-- A request starts pending.
insert into public.connections (requester_id, addressee_id)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');

select is(
  (select status::text from public.connections
   where requester_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'pending',
  'a new request starts out pending'
);

-- Nobody is their own friend.
select throws_ok(
  $$insert into public.connections (requester_id, addressee_id)
    values ('cccccccc-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000003')$$,
  null,
  null,
  'a User cannot connect to themselves'
);

-- The same request twice is not two relationships.
select throws_ok(
  $$insert into public.connections (requester_id, addressee_id)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002')$$,
  null,
  null,
  'the same request cannot be sent twice'
);

-- And neither is the mirror image of it: a Connection is symmetric, so B
-- requesting A while A→B already exists must be refused rather than creating a
-- second, contradictory row for the same pair.
select throws_ok(
  $$insert into public.connections (requester_id, addressee_id)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001')$$,
  null,
  null,
  'the reverse request is refused while one already exists for the pair'
);

update public.connections set status = 'accepted'
where requester_id = 'aaaaaaaa-0000-0000-0000-000000000001';

select is(
  (select status::text from public.connections
   where requester_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'accepted',
  'a request can be accepted'
);

-- Row Level Security, as a real request arrives.
set local role authenticated;
set local request.jwt.claims = '{"sub": "cccccccc-0000-0000-0000-000000000003", "role": "authenticated"}';

select is(
  (select count(*)::int from public.connections),
  0,
  'an unrelated User sees no Connection they are not part of'
);

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000001", "role": "authenticated"}';

select is(
  (select count(*)::int from public.connections),
  1,
  'the requester sees their own Connection'
);

set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000002", "role": "authenticated"}';

select is(
  (select count(*)::int from public.connections),
  1,
  'the addressee sees it too — a Connection belongs to both Users'
);

-- Only the addressee decides. Letting the requester accept would make the
-- "mutual" in mutual-accept meaningless.
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000001", "role": "authenticated"}';

update public.connections set status = 'pending'
where requester_id = 'aaaaaaaa-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.connections where status = 'pending'),
  0,
  'the requester cannot move the Connection back to pending'
);

reset role;

-- The profile of someone you are connected to becomes readable; that is the
-- whole point of connecting.
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000001", "role": "authenticated"}';

select is(
  (select count(*)::int from public.profiles
   where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  1,
  'an accepted Connection makes the other User''s profile readable'
);

select is(
  (select count(*)::int from public.profiles
   where id = 'cccccccc-0000-0000-0000-000000000003'),
  0,
  'a stranger''s profile stays hidden'
);

reset role;

select * from finish();

rollback;

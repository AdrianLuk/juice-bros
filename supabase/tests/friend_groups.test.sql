-- A Friend Group (see CONTEXT.md) is private to its owner and holds only that
-- owner's own accepted Connections. Those two rules are the whole of what the
-- database enforces here — the precedence chain that turns groups into a
-- resolved Visibility level lives in application code, per ADR 0003, and is
-- tested in src/lib/booking-buddy/visibility.test.ts.

begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select has_table('public', 'friend_groups', 'friend_groups table exists');
select has_table('public', 'friend_group_members', 'friend_group_members table exists');
select has_table('public', 'visibility_overrides', 'visibility_overrides table exists');

-- Amy and Ben are friends. Amy also has a pending request out to Cal.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben@example.com'),
  ('cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal@example.com');

insert into public.connections (id, requester_id, addressee_id, status) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'accepted'),
  ('22222222-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003', 'pending');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000001", "role": "authenticated"}';

insert into public.friend_groups (id, owner_id, name, default_visibility)
values ('99999999-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Tuesday crew', 'calendar');

select is(
  (select default_visibility::text from public.friend_groups
   where id = '99999999-0000-0000-0000-000000000001'),
  'calendar',
  'a group carries the default visibility it was created with'
);

-- The same name twice would be two indistinguishable entries in a picker.
select throws_ok(
  $$insert into public.friend_groups (owner_id, name)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'tuesday CREW')$$,
  null,
  null,
  'one owner cannot have two groups with the same name, whatever the casing'
);

-- Groups belong to whoever made them, and only to them.
select throws_ok(
  $$insert into public.friend_groups (owner_id, name)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 'Amy pretending to be Ben')$$,
  '42501',
  null,
  'a User cannot create a group owned by someone else'
);

-- An accepted Connection is groupable.
insert into public.friend_group_members (group_id, connection_id)
values ('99999999-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001');

select is(
  (select count(*)::int from public.friend_group_members),
  1,
  'an accepted Connection can be assigned to a group'
);

-- A pending one is not: grouping someone who has not agreed to be your friend
-- would let visibility be granted before the Connection exists.
select throws_ok(
  $$insert into public.friend_group_members (group_id, connection_id)
    values ('99999999-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002')$$,
  null,
  null,
  'a Connection that is still pending cannot be assigned to a group'
);

-- Overrides follow the same rule.
insert into public.visibility_overrides (owner_id, connection_id, level)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'none');

select is(
  (select level::text from public.visibility_overrides
   where connection_id = '11111111-0000-0000-0000-000000000001'),
  'none',
  'an override can be set on an accepted Connection'
);

select throws_ok(
  $$insert into public.visibility_overrides (owner_id, connection_id, level)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', 'slots')$$,
  null,
  null,
  'a pending Connection cannot have a visibility override'
);

-- Ben is in Amy's group, but a group is a one-way, private grouping: he must
-- not be able to see it, nor the level Amy set for him.
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000002", "role": "authenticated"}';

select is(
  (select count(*)::int from public.friend_groups),
  0,
  'a friend cannot see the groups they have been put in'
);

select is(
  (select count(*)::int from public.friend_group_members),
  0,
  'a friend cannot see their own group memberships'
);

select is(
  (select count(*)::int from public.visibility_overrides),
  0,
  'a friend cannot see the visibility level set for them'
);

-- Nor can a stranger.
set local request.jwt.claims = '{"sub": "cccccccc-0000-0000-0000-000000000003", "role": "authenticated"}';

select is(
  (select count(*)::int from public.friend_groups),
  0,
  'an unrelated User sees no groups at all'
);

-- Unfriending takes the grouping with it: a stale membership for someone you
-- are no longer connected to would keep granting visibility.
reset role;

delete from public.connections where id = '11111111-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.friend_group_members),
  0,
  'removing a Connection removes it from every group'
);

select * from finish();

rollback;

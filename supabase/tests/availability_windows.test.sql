-- An Availability Window is a User's own dated looking-to-play/busy declaration
-- (see CONTEXT.md). Unlike every table before it, its read policy is not pure
-- ownership: it is gated on `calendar`-level Visibility (ADR 0003's coarse
-- net, applied here to the one relationship CONTEXT.md actually names —
-- see the migration comment for why that's not a contradiction). The
-- precedence chain this reuses (override beats most-permissive Friend Group
-- default) is Phase 3's; this test only proves the calendar-visibility
-- boundary, not that chain itself (visibility.test.ts already does).

begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select has_table('public', 'availability_windows', 'availability_windows table exists');

select has_index(
  'public', 'availability_windows', 'availability_windows_owner_created_at',
  'availability_windows is indexed by owner and creation order, which is how resolveAvailability reads it'
);

-- Amy owns the windows under test. Ben is in a Friend Group of Amy's
-- defaulting to `calendar` — visible. Cal is an accepted Connection with no
-- group and no override — not visible, `calendar` is not the default. Dave
-- has no Connection to Amy at all — not visible either.
-- Eve (added for #31): a Friend Group of Amy's defaulting to `open_time` —
-- also visible, but on the open_time grant rather than calendar's.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy-avail@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben-avail@example.com'),
  ('cccccccc-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal-avail@example.com'),
  ('dddddddd-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dave-avail@example.com'),
  ('eeeeeeee-0000-0000-0000-000000000025', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eve-avail@example.com');

insert into public.connections (id, requester_id, addressee_id, status) values
  ('44444444-0000-0000-0000-000000000021', 'aaaaaaaa-0000-0000-0000-000000000021', 'bbbbbbbb-0000-0000-0000-000000000022', 'accepted'),
  ('55555555-0000-0000-0000-000000000022', 'aaaaaaaa-0000-0000-0000-000000000021', 'cccccccc-0000-0000-0000-000000000023', 'accepted'),
  ('88888888-0000-0000-0000-000000000023', 'aaaaaaaa-0000-0000-0000-000000000021', 'eeeeeeee-0000-0000-0000-000000000025', 'accepted');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000021", "role": "authenticated"}';

-- Amy's own default is pinned to `none` for the body of this file so every
-- assertion below stays a statement about Friend Groups and overrides, the
-- thing it was written to prove. The `calendar` default that ships out of the
-- box (ADR 0021) gets its own block at the end.
update public.profiles set default_friend_visibility = 'none'
  where id = 'aaaaaaaa-0000-0000-0000-000000000021';

insert into public.friend_groups (id, owner_id, name, default_visibility)
values ('66666666-0000-0000-0000-000000000021', 'aaaaaaaa-0000-0000-0000-000000000021', 'Calendar crew', 'calendar');

insert into public.friend_group_members (group_id, connection_id)
values ('66666666-0000-0000-0000-000000000021', '44444444-0000-0000-0000-000000000021');

insert into public.availability_windows (id, owner_id, type, starts_at, ends_at)
values (
  '77777777-0000-0000-0000-000000000021',
  'aaaaaaaa-0000-0000-0000-000000000021',
  'looking',
  '2026-08-20 09:00:00+00',
  '2026-08-20 17:00:00+00'
);

select is(
  (select type::text from public.availability_windows
   where id = '77777777-0000-0000-0000-000000000021'),
  'looking',
  'the owner can create and read their own Availability Window'
);

select throws_ok(
  $$insert into public.availability_windows (owner_id, type, starts_at, ends_at)
    values ('bbbbbbbb-0000-0000-0000-000000000022', 'looking', '2026-08-20 09:00:00+00', '2026-08-20 17:00:00+00')$$,
  '42501',
  null,
  'a User cannot create an Availability Window owned by someone else'
);

-- Overlap is allowed outright — ADR 0006's whole point — so a second window
-- covering the same span is not an error.
insert into public.availability_windows (owner_id, type, starts_at, ends_at)
values (
  'aaaaaaaa-0000-0000-0000-000000000021',
  'busy',
  '2026-08-20 12:00:00+00',
  '2026-08-20 13:00:00+00'
);

select is(
  (select count(*)::int from public.availability_windows
   where owner_id = 'aaaaaaaa-0000-0000-0000-000000000021'),
  2,
  'overlapping Availability Windows are both allowed to exist at once'
);

-- Ben: accepted Connection, calendar-visible via the group he's in.
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000022", "role": "authenticated"}';

select is(
  (select count(*)::int from public.availability_windows
   where owner_id = 'aaaaaaaa-0000-0000-0000-000000000021'),
  2,
  'a friend with calendar Visibility into the owner can read their Availability Windows'
);

-- An RLS-filtered write matches zero rows rather than raising, so the proof
-- is that nothing changed, not that anything threw (Phase 4's notes cover the
-- same lesson: check the row, never the status).
update public.availability_windows set type = 'busy'
  where id = '77777777-0000-0000-0000-000000000021';

select is(
  (select type::text from public.availability_windows
   where id = '77777777-0000-0000-0000-000000000021'),
  'looking',
  'read access does not carry write access — a calendar-visible friend''s update matches no rows'
);

-- Cal: accepted Connection, but no group and no override — `slots` is as far
-- as an ungrouped friend gets, and that's less than `calendar`.
set local request.jwt.claims = '{"sub": "cccccccc-0000-0000-0000-000000000023", "role": "authenticated"}';

select is(
  (select count(*)::int from public.availability_windows
   where owner_id = 'aaaaaaaa-0000-0000-0000-000000000021'),
  0,
  'an accepted Connection with less than calendar Visibility sees no Availability Windows'
);

-- Dave: no Connection to the owner at all.
set local request.jwt.claims = '{"sub": "dddddddd-0000-0000-0000-000000000024", "role": "authenticated"}';

select is(
  (select count(*)::int from public.availability_windows
   where owner_id = 'aaaaaaaa-0000-0000-0000-000000000021'),
  0,
  'a User with no Connection at all sees no Availability Windows'
);

-- An explicit override closes Ben back out, same as it does for the group
-- chain itself (visibility.test.ts) — proving the RLS function reads
-- overrides too, not just group membership.
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000021", "role": "authenticated"}';

insert into public.visibility_overrides (owner_id, connection_id, level)
values ('aaaaaaaa-0000-0000-0000-000000000021', '44444444-0000-0000-0000-000000000021', 'none');

set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000022", "role": "authenticated"}';

select is(
  (select count(*)::int from public.availability_windows
   where owner_id = 'aaaaaaaa-0000-0000-0000-000000000021'),
  0,
  'a per-friend override below calendar wins over the group default, closing the Availability Windows back off'
);

-- Eve: a Friend Group defaulting to `open_time` — the level that grants
-- Availability Windows without Slots (#31). This proves `open_time` is not
-- just "less than calendar" but grants the same Availability Window access
-- `calendar` does, on its own.
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000021", "role": "authenticated"}';

insert into public.friend_groups (id, owner_id, name, default_visibility)
values ('66666666-0000-0000-0000-000000000026', 'aaaaaaaa-0000-0000-0000-000000000021', 'Open time crew', 'open_time');

insert into public.friend_group_members (group_id, connection_id)
values ('66666666-0000-0000-0000-000000000026', '88888888-0000-0000-0000-000000000023');

set local request.jwt.claims = '{"sub": "eeeeeeee-0000-0000-0000-000000000025", "role": "authenticated"}';

select is(
  (select count(*)::int from public.availability_windows
   where owner_id = 'aaaaaaaa-0000-0000-0000-000000000021'),
  2,
  'a friend with open_time Visibility into the owner can read their Availability Windows, same as calendar'
);

-- The owner's `default_friend_visibility` (ADR 0021) is the floor the whole
-- chain above starts from. Cal is still what he has been all file — an
-- accepted Connection in no group with no override — so he is the one who
-- moves when the floor does.
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000021", "role": "authenticated"}';

update public.profiles set default_friend_visibility = 'calendar'
  where id = 'aaaaaaaa-0000-0000-0000-000000000021';

set local request.jwt.claims = '{"sub": "cccccccc-0000-0000-0000-000000000023", "role": "authenticated"}';

select is(
  (select count(*)::int from public.availability_windows
   where owner_id = 'aaaaaaaa-0000-0000-0000-000000000021'),
  2,
  'an accepted Connection with no group and no override reads the owner''s Availability Windows on the calendar default'
);

-- Ben still carries the `none` override set above: the explicit per-friend
-- exception beats the default in the same direction it beats a group.
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000022", "role": "authenticated"}';

select is(
  (select count(*)::int from public.availability_windows
   where owner_id = 'aaaaaaaa-0000-0000-0000-000000000021'),
  0,
  'an override of none still closes a friend the calendar default would have opened'
);

-- Lowered to `slots`, which grants the other slice of the lattice entirely —
-- not a rung above or below `open_time`, so Cal loses the windows again.
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000021", "role": "authenticated"}';

update public.profiles set default_friend_visibility = 'slots'
  where id = 'aaaaaaaa-0000-0000-0000-000000000021';

set local request.jwt.claims = '{"sub": "cccccccc-0000-0000-0000-000000000023", "role": "authenticated"}';

select is(
  (select count(*)::int from public.availability_windows
   where owner_id = 'aaaaaaaa-0000-0000-0000-000000000021'),
  0,
  'a default lowered past the open-time slice closes an ungrouped friend back off'
);

-- Eve's `Open time crew` membership raises her above that lowered default,
-- which is the whole reason Friend Groups survive this change.
set local request.jwt.claims = '{"sub": "eeeeeeee-0000-0000-0000-000000000025", "role": "authenticated"}';

select is(
  (select count(*)::int from public.availability_windows
   where owner_id = 'aaaaaaaa-0000-0000-0000-000000000021'),
  2,
  'a Friend Group still opens a friend the owner''s lowered default would close'
);

select * from finish();

rollback;

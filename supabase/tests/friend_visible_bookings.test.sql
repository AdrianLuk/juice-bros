-- Friend calendar view (issue #61): `friend_visible_bookings` is the first
-- read path that lets a friend learn a Booking's facility — Phase 4's own
-- migration comment says "a Booking reaches a friend only through an
-- attached Slot," and even `slot_bookings` never copies over which facility.
-- See adr/0010-friend-calendar-reads-bookings-through-a-view.md.
--
-- Reuses `has_open_time_visibility` (already proven against the full
-- override/group precedence chain by availability_windows.test.sql) rather
-- than re-testing that chain here — this file only proves the view's own
-- shape (which columns, which rows) and that `open_time_visible_owners`
-- answers the same question in batch.

begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select has_view('public', 'friend_visible_bookings', 'friend_visible_bookings view exists');

select columns_are(
  'public', 'friend_visible_bookings',
  array['booking_id', 'owner_id', 'starts_at', 'ends_at', 'facility_name'],
  'the view exposes only booking_id/owner_id/starts_at/ends_at/facility_name — never court_label, never a raw bookings/orgs column'
);

-- Amy owns the Bookings under test. Ben is in a Friend Group of Amy's
-- defaulting to open_time — visible. Cal is in one defaulting to slots only
-- — not visible, same "slots and open_time are independent grants" boundary
-- availability_windows.test.sql already proves. Dave has no Connection to
-- Amy at all.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy-fvb@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben-fvb@example.com'),
  ('cccccccc-0000-0000-0000-000000000063', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal-fvb@example.com'),
  ('dddddddd-0000-0000-0000-000000000064', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dave-fvb@example.com');

insert into public.connections (id, requester_id, addressee_id, status) values
  ('44444444-0000-0000-0000-000000000061', 'aaaaaaaa-0000-0000-0000-000000000061', 'bbbbbbbb-0000-0000-0000-000000000062', 'accepted'),
  ('55555555-0000-0000-0000-000000000062', 'aaaaaaaa-0000-0000-0000-000000000061', 'cccccccc-0000-0000-0000-000000000063', 'accepted');

-- A place-backed Org with a cache row, and one whose place_cache row is
-- missing (never fetched, or Google was unreachable) — the same cache-miss
-- case orgDisplayName degrades on the owner's own Orgs page.
insert into public.place_cache (place_id, name, formatted_address, latitude, longitude) values
  ('ChIJfriend-view-cached', 'PicklePlex Friend View', '1 Court Way, Toronto, ON', 43.7, -79.4);

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000061", "role": "authenticated"}';

insert into public.orgs (id, owner_id, name, time_zone) values
  ('aaaa0000-0000-0000-0000-000000000061', 'aaaaaaaa-0000-0000-0000-000000000061', 'Amy''s Backyard Court', 'America/Toronto');

insert into public.orgs (id, owner_id, google_place_id, time_zone) values
  ('aaaa0000-0000-0000-0000-000000000062', 'aaaaaaaa-0000-0000-0000-000000000061', 'ChIJfriend-view-cached', 'America/Toronto');

insert into public.orgs (id, owner_id, google_place_id, time_zone) values
  ('aaaa0000-0000-0000-0000-000000000063', 'aaaaaaaa-0000-0000-0000-000000000061', 'ChIJfriend-view-uncached', 'America/Toronto');

insert into public.bookings (id, org_id, owner_id, court_label, starts_at, ends_at) values
  ('bbbb0000-0000-0000-0000-000000000061', 'aaaa0000-0000-0000-0000-000000000061', 'aaaaaaaa-0000-0000-0000-000000000061', 'Court 1', '2031-08-20 18:00:00 America/Toronto', '2031-08-20 19:00:00 America/Toronto'),
  ('bbbb0000-0000-0000-0000-000000000062', 'aaaa0000-0000-0000-0000-000000000062', 'aaaaaaaa-0000-0000-0000-000000000061', 'Court 2', '2031-08-21 18:00:00 America/Toronto', '2031-08-21 19:00:00 America/Toronto'),
  ('bbbb0000-0000-0000-0000-000000000063', 'aaaa0000-0000-0000-0000-000000000063', 'aaaaaaaa-0000-0000-0000-000000000061', 'Court 3', '2031-08-22 18:00:00 America/Toronto', '2031-08-22 19:00:00 America/Toronto');

insert into public.friend_groups (id, owner_id, name, default_visibility) values
  ('66666666-0000-0000-0000-000000000061', 'aaaaaaaa-0000-0000-0000-000000000061', 'Open crew', 'open_time'),
  ('66666666-0000-0000-0000-000000000062', 'aaaaaaaa-0000-0000-0000-000000000061', 'Slots crew', 'slots');

insert into public.friend_group_members (group_id, connection_id) values
  ('66666666-0000-0000-0000-000000000061', '44444444-0000-0000-0000-000000000061'),
  ('66666666-0000-0000-0000-000000000062', '55555555-0000-0000-0000-000000000062');

-- Amy herself never reads through this view — it exists for friends, not
-- owners, and has_open_time_visibility(owner, owner) has no Connection row
-- to match, so it resolves false for a self-pair same as anyone unconnected.
select is(
  (select count(*)::int from public.friend_visible_bookings),
  0,
  'the owner does not see their own Bookings through the friend view — they read bookings directly instead'
);

set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000062", "role": "authenticated"}';

select is(
  (select count(*)::int from public.friend_visible_bookings where owner_id = 'aaaaaaaa-0000-0000-0000-000000000061'),
  3,
  'a friend with open_time Visibility sees all three of the owner''s Bookings through the view'
);

select is(
  (select facility_name from public.friend_visible_bookings where booking_id = 'bbbb0000-0000-0000-0000-000000000061'),
  'Amy''s Backyard Court',
  'a hand-named Org resolves to its own typed name, same as orgDisplayName'
);

select is(
  (select facility_name from public.friend_visible_bookings where booking_id = 'bbbb0000-0000-0000-0000-000000000062'),
  'PicklePlex Friend View',
  'a place-backed Org resolves to the cached Place''s name'
);

select is(
  (select facility_name from public.friend_visible_bookings where booking_id = 'bbbb0000-0000-0000-0000-000000000063'),
  'Facility details unavailable',
  'a place-backed Org with no cache row degrades the same way orgDisplayName''s cache-miss case does'
);

select throws_ok(
  $$select court_label from public.friend_visible_bookings$$,
  '42703',
  null,
  'court_label is not a column on the view at all — never selectable through it'
);

select is(
  (select array_agg(ou order by ou) from public.open_time_visible_owners(
    array['aaaaaaaa-0000-0000-0000-000000000061']::uuid[]
  ) as t(ou)),
  array['aaaaaaaa-0000-0000-0000-000000000061']::uuid[],
  'open_time_visible_owners includes the owner for a friend with open_time Visibility'
);

set local request.jwt.claims = '{"sub": "cccccccc-0000-0000-0000-000000000063", "role": "authenticated"}';

select is(
  (select count(*)::int from public.friend_visible_bookings where owner_id = 'aaaaaaaa-0000-0000-0000-000000000061'),
  0,
  'a friend with only slots Visibility (no open_time grant) sees none of the owner''s Bookings through the view'
);

select is(
  (select count(*)::int from public.open_time_visible_owners(array['aaaaaaaa-0000-0000-0000-000000000061']::uuid[])),
  0,
  'open_time_visible_owners excludes an owner for a friend with only slots Visibility'
);

set local request.jwt.claims = '{"sub": "dddddddd-0000-0000-0000-000000000064", "role": "authenticated"}';

select is(
  (select count(*)::int from public.friend_visible_bookings where owner_id = 'aaaaaaaa-0000-0000-0000-000000000061'),
  0,
  'a User with no Connection at all sees none of the owner''s Bookings through the view'
);

-- A bare-proposal Slot (no Booking attached) was never inserted into
-- `bookings` at all, so it can't appear here — nothing further to assert:
-- the view only ever selects from `bookings`, which is the same guarantee
-- `resolveAvailability`'s own busyIntervals source already relies on.

-- An explicit override closes Ben back out, same boundary
-- availability_windows.test.sql already proves for that table's own policy —
-- here it proves the view's embedded predicate reads overrides too, not just
-- group membership.
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000061", "role": "authenticated"}';

insert into public.visibility_overrides (owner_id, connection_id, level)
values ('aaaaaaaa-0000-0000-0000-000000000061', '44444444-0000-0000-0000-000000000061', 'none');

set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000062", "role": "authenticated"}';

select is(
  (select count(*)::int from public.friend_visible_bookings where owner_id = 'aaaaaaaa-0000-0000-0000-000000000061'),
  0,
  'a per-friend override below open_time wins over the group default, closing the view back off'
);

select is(
  (select count(*)::int from public.open_time_visible_owners(array['aaaaaaaa-0000-0000-0000-000000000061']::uuid[])),
  0,
  'open_time_visible_owners reflects the override too, not just group membership'
);

select * from finish();

rollback;

-- An Org is one User's record of playing at a Place; a Booking is one court
-- reservation held there (see CONTEXT.md). Both belong to exactly one User.
--
-- Four rules are worth pinning down at this layer:
--
--   * an Org names a Google Place or carries a hand-typed name, never both and
--     never neither (ADR 0005);
--   * an Org carries the facility's own clock — not null, and it has to be a
--     zone Postgres itself recognises (issue #20; moved here from
--     `bookings.time_zone`, which no longer exists);
--   * Bookings are never friend-visible on their own — a friend only ever
--     learns about one through a Slot it has been attached to, which is Phase
--     5's problem, so here even an accepted Connection sees nothing;
--   * `place_cache` inverts the usual posture: shared with every signed-in
--     User, writable by none of them.

begin;

create extension if not exists pgtap with schema extensions;

select plan(33);

select has_table('public', 'orgs', 'orgs table exists');
select has_table('public', 'bookings', 'bookings table exists');
select has_table('public', 'place_cache', 'place_cache table exists');

select has_column('public', 'orgs', 'time_zone', 'orgs carries the facility''s clock (issue #20)');
select hasnt_column('public', 'bookings', 'time_zone', 'bookings no longer carries its own time zone (issue #20)');

-- Both reads are "mine, newest first", and the two unique indexes are partial,
-- so neither of them can serve it. Asserted because a missing index is a
-- sequential scan that nothing else in this suite would notice.
select has_index(
  'public', 'orgs', 'orgs_owner_created_at',
  'orgs is indexed by owner, which is how every read of it filters'
);

-- The referencing side of an `on delete cascade`, which Postgres does not index
-- for you: without it, removing one Org scans every Booking there is.
select has_index(
  'public', 'bookings', 'bookings_org_id',
  'bookings is indexed by org, which is how the cascade finds them'
);

-- Amy and Ben are friends, so that "a friend sees nothing" is a real test
-- rather than a test about strangers. Cal is neither.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy-orgs@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben-orgs@example.com'),
  ('cccccccc-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal-orgs@example.com');

insert into public.connections (id, requester_id, addressee_id, status) values
  ('33333333-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000011', 'bbbbbbbb-0000-0000-0000-000000000012', 'accepted');

-- Seeded as the superuser, standing in for the server-side Places fetch. The
-- whole point of the assertions at the bottom is that no signed-in User could
-- have written these rows.
insert into public.place_cache (place_id, name, formatted_address, latitude, longitude) values
  ('ChIJpickleplex-downsview', 'PicklePlex Downsview', '70 Canuck Ave, North York, ON M3K 2C5', 43.7419, -79.4783);

-- Ben plays at the same club as Amy, and has his own Org for it. That two rows
-- carry one `place_id` is the entire reason for storing one.
insert into public.orgs (id, owner_id, google_place_id, time_zone) values
  ('cccc0000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000012', 'ChIJpickleplex-downsview', 'America/Toronto');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000011", "role": "authenticated"}';

insert into public.orgs (id, owner_id, google_place_id, time_zone)
values (
  'aaaa0000-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000011',
  'ChIJpickleplex-downsview',
  'America/Toronto'
);

select is(
  (select google_place_id from public.orgs where id = 'aaaa0000-0000-0000-0000-000000000001'),
  'ChIJpickleplex-downsview',
  'a User can create a Place-backed Org and read it back'
);

select is(
  (select time_zone from public.orgs where id = 'aaaa0000-0000-0000-0000-000000000001'),
  'America/Toronto',
  'the Org carries the facility''s clock, derived from its coordinates at pick time'
);

-- The escape hatch for a venue Google has never heard of. Permanently a second
-- class of Org: nothing cross-User can join it to anyone else's.
insert into public.orgs (id, owner_id, name, time_zone)
values (
  'aaaa0000-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000011',
  'Bob''s backyard court',
  'America/Vancouver'
);

select is(
  (select name from public.orgs where id = 'aaaa0000-0000-0000-0000-000000000002'),
  'Bob''s backyard court',
  'a User can create a hand-named Org for a venue Google does not list'
);

-- A hand-typed name alongside a place_id is the divergence problem ADR 0005
-- exists to prevent: the club would be renameable per owner after all.
select throws_ok(
  $$insert into public.orgs (owner_id, google_place_id, name, time_zone)
    values (
      'aaaaaaaa-0000-0000-0000-000000000011',
      'ChIJvaughan-pickleball',
      'Vaughan Pickleball, but my spelling',
      'America/Toronto'
    )$$,
  '23514',
  null,
  'an Org cannot be both Place-backed and hand-named'
);

select throws_ok(
  $$insert into public.orgs (owner_id, time_zone)
    values ('aaaaaaaa-0000-0000-0000-000000000011', 'America/Toronto')$$,
  '23514',
  null,
  'an Org must be one or the other — neither is not an Org'
);

select throws_ok(
  $$insert into public.orgs (owner_id, name)
    values ('aaaaaaaa-0000-0000-0000-000000000011', 'No zone given')$$,
  '23502',
  null,
  'an Org cannot be created without a time zone'
);

select throws_ok(
  $$insert into public.orgs (owner_id, name, time_zone)
    values ('aaaaaaaa-0000-0000-0000-000000000011', 'Mars court', 'Mars/Olympus_Mons')$$,
  '23514',
  null,
  'an Org cannot carry a time zone Postgres does not recognise'
);

-- Two rows for one club would be two indistinguishable entries in the Booking
-- form's picker.
select throws_ok(
  $$insert into public.orgs (owner_id, google_place_id, time_zone)
    values (
      'aaaaaaaa-0000-0000-0000-000000000011',
      'ChIJpickleplex-downsview',
      'America/Toronto'
    )$$,
  '23505',
  null,
  'the same owner cannot add the same Place twice'
);

select throws_ok(
  $$insert into public.orgs (owner_id, name, time_zone)
    values ('aaaaaaaa-0000-0000-0000-000000000011', 'bob''s BACKYARD court', 'America/Vancouver')$$,
  '23505',
  null,
  'the same owner cannot add two hand-named Orgs alike but for casing'
);

select throws_ok(
  $$insert into public.orgs (owner_id, name, time_zone)
    values ('bbbbbbbb-0000-0000-0000-000000000012', 'Amy pretending to be Ben', 'America/Toronto')$$,
  '42501',
  null,
  'a User cannot create an Org owned by someone else'
);

-- A Booking under an Org of your own is the ordinary case.
insert into public.bookings (id, org_id, owner_id, court_label, starts_at, ends_at)
values (
  'bbbb0000-0000-0000-0000-000000000001',
  'aaaa0000-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000011',
  'Court 3',
  '2026-08-20 18:00:00 America/Toronto',
  '2026-08-20 19:30:00 America/Toronto'
);

select is(
  (select court_label from public.bookings where id = 'bbbb0000-0000-0000-0000-000000000001'),
  'Court 3',
  'a User can create a Booking under one of their own Orgs'
);

-- The Org is what says where the reservation is. Pointing a Booking at
-- somebody else's Org would misattribute it, and RLS alone does not stop it:
-- the insert is on `bookings`, a table Amy is allowed to write.
select throws_ok(
  $$insert into public.bookings (org_id, owner_id, court_label, starts_at, ends_at)
    values (
      'cccc0000-0000-0000-0000-000000000001',
      'aaaaaaaa-0000-0000-0000-000000000011',
      'Court 1',
      '2026-08-21 18:00:00 America/Toronto',
      '2026-08-21 19:00:00 America/Toronto'
    )$$,
  '23514',
  null,
  'a Booking cannot be hung off an Org belonging to someone else'
);

select throws_ok(
  $$insert into public.bookings (org_id, owner_id, court_label, starts_at, ends_at)
    values (
      'aaaa0000-0000-0000-0000-000000000001',
      'aaaaaaaa-0000-0000-0000-000000000011',
      'Court 1',
      '2026-08-21 19:00:00 America/Toronto',
      '2026-08-21 18:00:00 America/Toronto'
    )$$,
  '23514',
  null,
  'a Booking cannot end before it starts'
);

-- Stored as an instant, so the same wall-clock reading in winter and summer are
-- different moments. Getting this wrong is invisible until a Reminder fires an
-- hour out.
select is(
  (select starts_at at time zone 'UTC' from public.bookings
   where id = 'bbbb0000-0000-0000-0000-000000000001'),
  '2026-08-20 22:00:00'::timestamp,
  'a wall-clock time is stored as the instant its own time zone makes it'
);

-- The cache is the one shared table in Booking Buddy, and reading it is the
-- only thing a User may do with it.
select is(
  (select name from public.place_cache where place_id = 'ChIJpickleplex-downsview'),
  'PicklePlex Downsview',
  'any signed-in User can read a cached Place'
);

select throws_ok(
  $$insert into public.place_cache (place_id, name, formatted_address)
    values ('ChIJmade-up', 'My Fake Club', '1 Nowhere Rd')$$,
  '42501',
  null,
  'a User cannot invent a Place'
);

select throws_ok(
  $$update public.place_cache set name = 'Renamed By A Stranger'$$,
  '42501',
  null,
  'a User cannot rename a real club out from under everyone else'
);

select throws_ok(
  $$delete from public.place_cache$$,
  '42501',
  null,
  'a User cannot delete a cached Place'
);

-- Being friends with the owner grants nothing here. A Booking reaches a friend
-- only through a Slot it is attached to.
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000012", "role": "authenticated"}';

select is(
  (select count(*)::int from public.bookings),
  0,
  'an accepted Connection of the owner still sees none of their Bookings'
);

select is(
  (select count(*)::int from public.orgs where owner_id <> 'bbbbbbbb-0000-0000-0000-000000000012'),
  0,
  'an accepted Connection of the owner sees none of their Orgs'
);

-- Amy and Ben both have an Org for PicklePlex Downsview, under one place_id.
-- Each sees exactly one: theirs. That both rows exist is what a later feature
-- joins on; that neither User can see the other's is what ADR 0003 requires.
select is(
  (select count(*)::int from public.orgs
   where google_place_id = 'ChIJpickleplex-downsview'),
  1,
  'two Users can each hold an Org for the same Place, and each sees only theirs'
);

set local request.jwt.claims = '{"sub": "cccccccc-0000-0000-0000-000000000013", "role": "authenticated"}';

select is(
  (select count(*)::int from public.bookings),
  0,
  'an unrelated User sees no Bookings at all'
);

select is(
  (select count(*)::int from public.orgs),
  0,
  'an unrelated User sees no Orgs at all'
);

-- Cal is a signed-in User with no Orgs, no friends and no Bookings, and the
-- cache is still his to read: it belongs to nobody in particular.
select is(
  (select count(*)::int from public.place_cache),
  1,
  'a User with nothing of their own can still read the Place cache'
);

-- Deleting the Org takes its Bookings with it: a reservation at a club the
-- User has removed has nowhere to be shown.
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000011", "role": "authenticated"}';

delete from public.orgs where id = 'aaaa0000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.bookings
   where id = 'bbbb0000-0000-0000-0000-000000000001'),
  0,
  'deleting an Org deletes the Bookings held under it'
);

-- Removing an Org must not evict the shared Place it pointed at — Ben still
-- plays there.
select is(
  (select count(*)::int from public.place_cache
   where place_id = 'ChIJpickleplex-downsview'),
  1,
  'deleting an Org leaves the cached Place alone'
);

select * from finish();

rollback;

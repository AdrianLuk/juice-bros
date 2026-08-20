-- A Player (issue #99, CONTEXT.md's Player entry, ADR 0011): a name plus an
-- optional link to a Connection, scoped to one Booking. Three rules live at
-- this layer:
--
--   * RLS mirrors `bookings`' own owner-only posture (ADR 0003) — a Player
--     row is visible/writable only via its parent Booking's owner, never by
--     the Connection it happens to be linked to;
--   * removing the Booking removes its Players (`on delete cascade`) — a
--     Player has no meaning independent of the Booking it describes;
--   * removing the linked Connection's User clears the link but leaves the
--     name text alone (`on delete set null`) — a Booking is a historical
--     record and doesn't lose data because a friendship ended.

begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

select has_table('public', 'booking_players', 'booking_players table exists');
select has_column('public', 'booking_players', 'booking_id', 'booking_players.booking_id exists');
select has_column('public', 'booking_players', 'name', 'booking_players.name exists');
select has_column('public', 'booking_players', 'connection_user_id', 'booking_players.connection_user_id exists');

-- The referencing side of the `bookings` cascade, which Postgres does not
-- index for you — same reasoning as `bookings_org_id`.
select has_index(
  'public', 'booking_players', 'booking_players_booking_id',
  'booking_players is indexed by booking, which is how the cascade finds them'
);

-- Amy owns the Booking. Ben is the Connection a Player gets linked to —
-- unrelated to whether he can see or touch the Player row itself. Cal is a
-- stranger to both.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000091', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy-players@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000092', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben-players@example.com'),
  ('cccccccc-0000-0000-0000-000000000093', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal-players@example.com');

insert into public.orgs (id, owner_id, name, time_zone) values
  ('99990000-0000-0000-0000-000000000091', 'aaaaaaaa-0000-0000-0000-000000000091', 'Amy''s gym', 'America/Toronto'),
  ('99990000-0000-0000-0000-000000000092', 'bbbbbbbb-0000-0000-0000-000000000092', 'Ben''s gym', 'America/Toronto');

insert into public.bookings (id, org_id, owner_id, court_label, starts_at, ends_at) values
  ('bbbb0000-0000-0000-0000-000000000091', '99990000-0000-0000-0000-000000000091', 'aaaaaaaa-0000-0000-0000-000000000091', 'Court 1', '2031-09-25 18:00:00 America/Toronto', '2031-09-25 19:00:00 America/Toronto'),
  ('bbbb0000-0000-0000-0000-000000000092', '99990000-0000-0000-0000-000000000092', 'bbbbbbbb-0000-0000-0000-000000000092', 'Court 2', '2031-09-25 18:00:00 America/Toronto', '2031-09-25 19:00:00 America/Toronto');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000091", "role": "authenticated"}';

-- The two Players `insertBookingPlayers` would write for a name matching one
-- Connection and a name matching none — the ordinary case.
insert into public.booking_players (id, booking_id, name, connection_user_id) values
  ('c0000000-0000-0000-0000-000000000091', 'bbbb0000-0000-0000-0000-000000000091', 'Ben Backhand', 'bbbbbbbb-0000-0000-0000-000000000092'),
  ('c0000000-0000-0000-0000-000000000092', 'bbbb0000-0000-0000-0000-000000000091', 'Some Rando', null);

select is(
  (select count(*)::int from public.booking_players where booking_id = 'bbbb0000-0000-0000-0000-000000000091'),
  2,
  'the owner can log Players on their own Booking and read them back'
);

select is(
  (select connection_user_id from public.booking_players where id = 'c0000000-0000-0000-0000-000000000091'),
  'bbbbbbbb-0000-0000-0000-000000000092',
  'a Player carries the Connection it matched'
);

-- Duplicate names on one Booking are allowed by design — two different
-- people can share a first name (CONTEXT.md's Player entry).
select lives_ok(
  $$insert into public.booking_players (booking_id, name)
    values ('bbbb0000-0000-0000-0000-000000000091', 'Ben Backhand')$$,
  'the same name can appear twice on one Booking — no uniqueness constraint'
);

select throws_ok(
  $$insert into public.booking_players (booking_id, name)
    values ('bbbb0000-0000-0000-0000-000000000091', '')$$,
  '23514',
  null,
  'a blank Player name is refused'
);

select throws_ok(
  $$insert into public.booking_players (booking_id, name)
    values ('bbbb0000-0000-0000-0000-000000000091', repeat('a', 41))$$,
  '23514',
  null,
  'a Player name over 40 characters is refused, same cap as court_label'
);

-- The half RLS's own `with check` on this table already covers, since the
-- policy itself looks at the named booking_id's owner (no separate coherence
-- trigger needed, unlike slot_bookings).
select throws_ok(
  $$insert into public.booking_players (booking_id, name)
    values ('bbbb0000-0000-0000-0000-000000000092', 'Sneaking in')$$,
  '42501',
  null,
  'a User cannot log a Player onto someone else''s Booking'
);

-- Ben: the Connection a Player links to, but not the Booking's owner — being
-- the match target grants nothing here.
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000092", "role": "authenticated"}';

select is(
  (select count(*)::int from public.booking_players where booking_id = 'bbbb0000-0000-0000-0000-000000000091'),
  0,
  'the Connection a Player is linked to still cannot see it — only the Booking''s owner can'
);

select throws_ok(
  $$insert into public.booking_players (booking_id, name)
    values ('bbbb0000-0000-0000-0000-000000000091', 'Ben adding himself')$$,
  '42501',
  null,
  'the linked Connection cannot write a Player onto someone else''s Booking either'
);

-- Cal: a stranger to both the Booking and the Connection link.
set local request.jwt.claims = '{"sub": "cccccccc-0000-0000-0000-000000000093", "role": "authenticated"}';

select is(
  (select count(*)::int from public.booking_players),
  0,
  'an unrelated User sees no Players at all'
);

-- Back to Amy for the two cascade behaviours.
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000091", "role": "authenticated"}';

-- Removing the linked Connection's User clears the link but leaves the name
-- text untouched (ADR 0011) — a Booking doesn't lose data because a
-- friendship ended. Deleting an `auth.users` row needs to bypass RLS
-- entirely, so this runs as postgres, same escalation slot_bookings.test.sql
-- already uses to seed privileged data.
set local role postgres;
delete from auth.users where id = 'bbbbbbbb-0000-0000-0000-000000000092';
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000091", "role": "authenticated"}';

select is(
  (select connection_user_id from public.booking_players where id = 'c0000000-0000-0000-0000-000000000091'),
  null,
  'deleting the linked Connection''s User clears connection_user_id'
);

select is(
  (select name from public.booking_players where id = 'c0000000-0000-0000-0000-000000000091'),
  'Ben Backhand',
  'but the Player''s name is untouched — a Booking is a historical record'
);

-- Removing the Booking removes its Players — they have no meaning on their
-- own.
delete from public.bookings where id = 'bbbb0000-0000-0000-0000-000000000091';

select is(
  (select count(*)::int from public.booking_players where booking_id = 'bbbb0000-0000-0000-0000-000000000091'),
  0,
  'deleting a Booking deletes the Players logged on it'
);

select * from finish();

rollback;

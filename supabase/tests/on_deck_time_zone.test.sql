-- On Deck: the Club's clock (issue #469). What this pins:
--
--   * a Club carries an IANA `time_zone`, defaulting to UTC, and Postgres
--     itself refuses one it does not recognise — including the bare offsets
--     `Intl` would happily accept;
--   * a new Session inherits its Club's zone at insert, from every insert
--     path, because a trigger does it rather than each RPC remembering to;
--   * a Session's zone is a *snapshot*: changing the Club's clock afterwards
--     does not rewrite a night that already happened;
--   * the clock has two write paths and each says what it means: adoption
--     fills a blank one and can never overwrite, and the setter is somebody
--     deciding. Saving venue or court count touches neither.

begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-0000-0000-000000000469', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vanessa-469@example.com'),
  ('22222222-0000-0000-0000-000000000469', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal-469@example.com');

-- ---- the column and its guard ---------------------------------------------

select has_column('public', 'on_deck_clubs', 'time_zone', 'a Club carries a time zone');
-- Nullable on purpose: null means "nobody has said yet", which is what lets
-- the app adopt the Organizer's browser zone instead of asking them.
select col_is_null('public', 'on_deck_clubs', 'time_zone', 'and it may be unset');
select has_column('public', 'on_deck_sessions', 'time_zone', 'a Session snapshots one');
select col_not_null('public', 'on_deck_sessions', 'time_zone', 'and it is never null either');

insert into public.on_deck_clubs (id, owner_id, name, venue_name, court_count, group_cap, floor_mode, time_zone) values
  ('c9c9c9c9-0000-0000-0000-000000000469', '11111111-0000-0000-0000-000000000469', 'TO Pickleball Club', 'Ramsden Park', 8, 4, 'hybrid', 'America/Toronto');

select is(
  (select time_zone from public.on_deck_clubs where id = 'c9c9c9c9-0000-0000-0000-000000000469'),
  'America/Toronto',
  'a real IANA zone is stored as given'
);

-- A Club seeded by hand from SQL has no browser to ask, so it starts blank.
insert into public.on_deck_clubs (id, owner_id, name, venue_name, court_count, group_cap, floor_mode) values
  ('c8c8c8c8-0000-0000-0000-000000000469', '22222222-0000-0000-0000-000000000469', 'Cal''s Club', 'Some Other Park', 6, 3, 'hybrid');

select is(
  (select time_zone from public.on_deck_clubs where id = 'c8c8c8c8-0000-0000-0000-000000000469'),
  null,
  'a Club seeded without a zone starts unset, not on a guess'
);

select throws_ok(
  $$update public.on_deck_clubs set time_zone = 'Mars/Olympus' where id = 'c9c9c9c9-0000-0000-0000-000000000469'$$,
  '22023',
  'unknown time zone Mars/Olympus',
  'a zone Postgres does not know is refused'
);

-- `Intl` accepts this; `pg_timezone_names` does not, which is exactly why the
-- app-side check refuses bare offsets before the row ever gets here.
select throws_ok(
  $$update public.on_deck_clubs set time_zone = '+05:30' where id = 'c9c9c9c9-0000-0000-0000-000000000469'$$,
  '22023',
  'unknown time zone +05:30',
  'a bare offset is refused, not silently stored'
);

-- ---- a Session inherits it ------------------------------------------------

insert into public.on_deck_sessions (id, club_id, venue_name, court_count, group_cap, floor_mode) values
  ('55555555-0000-0000-0000-000000000469', 'c9c9c9c9-0000-0000-0000-000000000469', 'Ramsden Park', 8, 4, 'hybrid');

select is(
  (select time_zone from public.on_deck_sessions where id = '55555555-0000-0000-0000-000000000469'),
  'America/Toronto',
  'a Session inherits its Club''s clock without the caller passing it'
);

-- An insert that names a zone keeps it: the trigger fills a gap, it does not
-- overwrite an intent.
insert into public.on_deck_sessions (id, club_id, venue_name, court_count, group_cap, floor_mode, status, started_at, scheduled_for, time_zone) values
  ('66666666-0000-0000-0000-000000000469', 'c9c9c9c9-0000-0000-0000-000000000469', 'Ramsden Park', 8, 4, 'hybrid', 'scheduled', null, '2026-09-12', 'Europe/London');

select is(
  (select time_zone from public.on_deck_sessions where id = '66666666-0000-0000-0000-000000000469'),
  'Europe/London',
  'an explicit zone on the insert is left alone'
);

-- ---- and it is a snapshot -------------------------------------------------

update public.on_deck_clubs
  set time_zone = 'America/Vancouver'
  where id = 'c9c9c9c9-0000-0000-0000-000000000469';

select is(
  (select time_zone from public.on_deck_sessions where id = '55555555-0000-0000-0000-000000000469'),
  'America/Toronto',
  'moving the Club''s clock does not rewrite a night that already happened'
);

-- ---- the write path -------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '11111111-0000-0000-0000-000000000469';
set local request.jwt.claims = '{"sub":"11111111-0000-0000-0000-000000000469","role":"authenticated"}';

select lives_ok(
  $$select public.on_deck_set_club_time_zone('America/Toronto')$$,
  'an Organizer sets their own Club''s clock'
);

select is(
  (select time_zone from public.on_deck_clubs where id = 'c9c9c9c9-0000-0000-0000-000000000469'),
  'America/Toronto',
  'and the new zone is what lands'
);

select throws_ok(
  $$select public.on_deck_set_club_time_zone('Mars/Olympus')$$,
  '22023',
  'unknown time zone Mars/Olympus',
  'the setter cannot smuggle an unknown zone past the table''s trigger'
);

-- The defaults RPC keeps its original three arguments, so there is no path by
-- which saving a venue or a court count writes a clock nobody chose.
select lives_ok(
  $$select public.on_deck_update_club_defaults('Trinity Bellwoods', 6, 4)$$,
  'saving the other defaults still works, and still takes three arguments'
);

select is(
  (select time_zone from public.on_deck_clubs where id = 'c9c9c9c9-0000-0000-0000-000000000469'),
  'America/Toronto',
  'and it leaves the clock exactly where it was'
);

-- ---- adoption: fills a blank clock, never overwrites one -----------------

-- Vanessa's Club already has a zone by now, so adoption must leave it alone.
select lives_ok(
  $$select public.on_deck_adopt_club_time_zone('Australia/Sydney')$$,
  'adopting is never an error, even when there is nothing to adopt'
);

select is(
  (select time_zone from public.on_deck_clubs where id = 'c9c9c9c9-0000-0000-0000-000000000469'),
  'America/Toronto',
  'a Club that already has a clock keeps it -- this is the safety property'
);

-- Now as Cal, whose Club is still blank.
set local request.jwt.claim.sub = '22222222-0000-0000-0000-000000000469';
set local request.jwt.claims = '{"sub":"22222222-0000-0000-0000-000000000469","role":"authenticated"}';

select lives_ok(
  $$select public.on_deck_adopt_club_time_zone('Europe/Berlin')$$,
  'an Organizer whose Club has no clock adopts one'
);

select is(
  (select time_zone from public.on_deck_clubs where id = 'c8c8c8c8-0000-0000-0000-000000000469'),
  'Europe/Berlin',
  'and it lands'
);

-- A second visit from another device does not move it.
select lives_ok(
  $$select public.on_deck_adopt_club_time_zone('Asia/Tokyo')$$,
  'a later visit from elsewhere is a no-op'
);

-- Cal's Club is untouched by Vanessa's edits. Read back as the table owner: under
-- Vanessa's JWT, RLS makes his Club invisible rather than unchanged, and an
-- invisible row would pass this assertion for the wrong reason.
reset role;

select is(
  (select time_zone from public.on_deck_clubs where id = 'c8c8c8c8-0000-0000-0000-000000000469'),
  'Europe/Berlin',
  'an Organizer travelling with their laptop cannot rewrite their own clock'
);

select * from finish();
rollback;

-- On Deck's tenant backbone (issue #241). What this pins down:
--
--   * a Club is the owner's alone to read, and nobody — not even the owner —
--     can create one through the Data API (Clubs are seeded by hand);
--   * only the Club's owner can open a Session for it, and only one Session
--     can be open per Club at a time;
--   * only the Club's owner can append events, only while the Session is open,
--     and only carrying their own account as the Operator;
--   * an *open* Session and its event log are readable with no auth session at
--     all — a Player scanning the Club QR (on-deck/docs/adr/0006) — while a
--     closed one is not.

begin;

create extension if not exists pgtap with schema extensions;

select plan(27);

select has_table('public', 'on_deck_clubs', 'on_deck_clubs table exists');
select has_table('public', 'on_deck_sessions', 'on_deck_sessions table exists');
select has_table('public', 'on_deck_session_events', 'on_deck_session_events table exists');

select has_index(
  'public', 'on_deck_sessions', 'on_deck_sessions_one_open_per_club',
  'the one-open-Session-per-Club rule is a real partial unique index'
);

-- Vanessa owns a Club; Cal is an unrelated Organizer with his own Club.
insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vanessa-ondeck@example.com'),
  ('22222222-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal-ondeck@example.com');

-- Seeded as the superuser, standing in for the by-hand Club creation.
insert into public.on_deck_clubs (id, owner_id, name, venue_name, court_count, group_cap, floor_mode) values
  ('c1c1c1c1-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'TO Pickleball Club', 'Ramsden Park', 8, 4, 'hybrid'),
  ('c2c2c2c2-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'Cal''s Club', 'Some Other Park', 6, 4, 'self-serve');

select is(
  (select floor_mode from public.on_deck_clubs where id = 'c1c1c1c1-0000-0000-0000-000000000001'),
  'hybrid',
  'a Club carries its Floor Mode default'
);

-- ---- as Vanessa -----------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-0000-0000-0000-000000000001", "role": "authenticated"}';

select is(
  (select count(*)::int from public.on_deck_clubs),
  1,
  'an Organizer sees only their own Club'
);

select throws_ok(
  $$insert into public.on_deck_clubs (owner_id, name, venue_name)
    values ('11111111-0000-0000-0000-000000000001', 'DIY Club', 'My Park')$$,
  '42501',
  null,
  'an Organizer cannot create a Club through the Data API — Clubs are seeded by hand'
);

-- Start: opens a Session from the Club's defaults.
insert into public.on_deck_sessions (id, club_id, venue_name, court_count, group_cap, floor_mode)
values (
  '5e551011-0000-0000-0000-000000000001',
  'c1c1c1c1-0000-0000-0000-000000000001',
  'Ramsden Park', 8, 4, 'hybrid'
);

select is(
  (select status from public.on_deck_sessions where id = '5e551011-0000-0000-0000-000000000001'),
  'open',
  'an Organizer can open a Session for their own Club'
);

select isnt_empty(
  $$select seed from public.on_deck_sessions where id = '5e551011-0000-0000-0000-000000000001' and btrim(seed) <> ''$$,
  'the Session carries a non-blank tie-break seed'
);

select throws_ok(
  $$insert into public.on_deck_sessions (club_id, venue_name, court_count, group_cap, floor_mode)
    values ('c1c1c1c1-0000-0000-0000-000000000001', 'Ramsden Park', 8, 4, 'hybrid')$$,
  '23505',
  null,
  'a second open Session for the same Club is refused'
);

select throws_ok(
  $$insert into public.on_deck_sessions (club_id, venue_name, court_count, group_cap, floor_mode)
    values ('c2c2c2c2-0000-0000-0000-000000000002', 'Some Other Park', 6, 4, 'self-serve')$$,
  '42501',
  null,
  'an Organizer cannot open a Session for a Club that is not theirs'
);

-- The SESSION_STARTED event, carrying its Operator.
insert into public.on_deck_session_events (session_id, type, operator_kind, operator_user_id)
values (
  '5e551011-0000-0000-0000-000000000001',
  'SESSION_STARTED', 'organizer', '11111111-0000-0000-0000-000000000001'
);

select is(
  (select operator_kind from public.on_deck_session_events
   where session_id = '5e551011-0000-0000-0000-000000000001'),
  'organizer',
  'the Organizer can append a SESSION_STARTED event carrying their account'
);

select throws_ok(
  $$insert into public.on_deck_session_events (session_id, type, operator_kind, operator_user_id)
    values ('5e551011-0000-0000-0000-000000000001', 'SESSION_STARTED', 'organizer',
            '22222222-0000-0000-0000-000000000002')$$,
  '42501',
  null,
  'an Organizer cannot append an event that names someone else as the Operator'
);

select throws_ok(
  $$insert into public.on_deck_session_events (session_id, type, operator_kind)
    values ('5e551011-0000-0000-0000-000000000001', 'COURT_FINISHED', 'kiosk')$$,
  '42501',
  null,
  'a Kiosk-sourced event is not appendable by an Organizer session (arrives by another path)'
);

-- ---- as Cal (unrelated Organizer) ---------------------------------------
set local request.jwt.claims = '{"sub": "22222222-0000-0000-0000-000000000002", "role": "authenticated"}';

-- The Start path: one RPC opens a Session and appends its event atomically.
select lives_ok(
  $$select public.on_deck_start_session('c2c2c2c2-0000-0000-0000-000000000002')$$,
  'on_deck_start_session opens a Session for the caller''s own Club'
);

select is(
  (select se.operator_kind
   from public.on_deck_session_events se
   join public.on_deck_sessions s on s.id = se.session_id
   where s.club_id = 'c2c2c2c2-0000-0000-0000-000000000002' and se.type = 'SESSION_STARTED'),
  'organizer',
  'the RPC appends a SESSION_STARTED event carrying the caller as Operator'
);

-- Vanessa cannot Start Cal's night for him.
set local request.jwt.claims = '{"sub": "11111111-0000-0000-0000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$select public.on_deck_start_session('c2c2c2c2-0000-0000-0000-000000000002')$$,
  '42501',
  null,
  'on_deck_start_session refuses a Club the caller does not own'
);

set local request.jwt.claims = '{"sub": "22222222-0000-0000-0000-000000000002", "role": "authenticated"}';

select is(
  (select count(*)::int from public.on_deck_clubs where owner_id <> '22222222-0000-0000-0000-000000000002'),
  0,
  'an unrelated Organizer sees nothing of another Club'
);

select is(
  (select count(*)::int from public.on_deck_sessions where club_id = 'c1c1c1c1-0000-0000-0000-000000000001'),
  1,
  'an unrelated Organizer can still read another Club''s Session while it is open (it is public to the venue)'
);

select throws_ok(
  $$insert into public.on_deck_session_events (session_id, type, operator_kind, operator_user_id)
    values ('5e551011-0000-0000-0000-000000000001', 'LAST_CALL', 'organizer',
            '22222222-0000-0000-0000-000000000002')$$,
  '42501',
  null,
  'an unrelated Organizer cannot append events to a Club that is not theirs'
);

-- ---- as an anonymous Player (no auth session) --------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  (select count(*)::int from public.on_deck_sessions where id = '5e551011-0000-0000-0000-000000000001'),
  1,
  'a Player with no account can read the open Session the Club QR resolves to'
);

select is(
  (select count(*)::int from public.on_deck_session_events
   where session_id = '5e551011-0000-0000-0000-000000000001'),
  1,
  'a Player with no account can read the open Session''s event log'
);

select throws_ok(
  $$select count(*) from public.on_deck_clubs$$,
  '42501',
  null,
  'a Player with no account cannot read Club rows at all'
);

select throws_ok(
  $$insert into public.on_deck_session_events (session_id, type, operator_kind)
    values ('5e551011-0000-0000-0000-000000000001', 'PLAYER_JOINED', 'player')$$,
  '42501',
  null,
  'a Player cannot append events yet (the player join path is a later ticket)'
);

-- ---- close the Session, then re-check the anon read --------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-0000-0000-0000-000000000001", "role": "authenticated"}';

update public.on_deck_sessions
set status = 'closed', closed_at = now()
where id = '5e551011-0000-0000-0000-000000000001';

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  (select count(*)::int from public.on_deck_sessions where id = '5e551011-0000-0000-0000-000000000001'),
  0,
  'once the Session is closed a Player with no account can no longer read it'
);

select is(
  (select count(*)::int from public.on_deck_session_events
   where session_id = '5e551011-0000-0000-0000-000000000001'),
  0,
  'and can no longer read its event log'
);

-- Back as Vanessa: the owner still sees her Club''s closed Session.
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-0000-0000-0000-000000000001", "role": "authenticated"}';

select is(
  (select status from public.on_deck_sessions where id = '5e551011-0000-0000-0000-000000000001'),
  'closed',
  'the Club owner still reads their own Session after it closes'
);

select * from finish();

rollback;

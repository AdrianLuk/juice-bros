-- On Deck: the rotation loop (issue #243). What this pins down:
--
--   * a Player with no account joins the Queue through the
--     `on_deck_queue_player` RPC — and only after joining the Session;
--   * the RPC is idempotent on the device token (one PLAYER_QUEUED per Player);
--   * a Player still cannot append events directly (no anon insert grant);
--   * the Organizer appends COURT_FINISHED through the existing owner policy,
--     and an unrelated Organizer cannot.

begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

select has_index(
  'public', 'on_deck_session_events', 'on_deck_session_events_one_queue_per_token',
  'one PLAYER_QUEUED per device token per Session is a real partial unique index'
);

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vanessa-rotation@example.com'),
  ('22222222-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal-rotation@example.com');

insert into public.on_deck_clubs (id, owner_id, name, venue_name, court_count, group_cap, floor_mode) values
  ('c1c1c1c1-0000-0000-0000-0000000000a1', '11111111-0000-0000-0000-0000000000a1', 'TO Pickleball Club', 'Ramsden Park', 8, 4, 'hybrid');

insert into public.on_deck_sessions (id, club_id, venue_name, court_count, group_cap, floor_mode) values
  ('5e551011-0000-0000-0000-0000000000a1', 'c1c1c1c1-0000-0000-0000-0000000000a1', 'Ramsden Park', 8, 4, 'hybrid');

insert into public.on_deck_session_events (session_id, type, operator_kind, operator_user_id) values
  ('5e551011-0000-0000-0000-0000000000a1', 'SESSION_STARTED', 'organizer', '11111111-0000-0000-0000-0000000000a1');

-- ---- as an anonymous Player -------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select public.on_deck_queue_player('5e551011-0000-0000-0000-0000000000a1', 'device-token-sarah')$$,
  '42501',
  null,
  'a Player cannot queue before joining the Session'
);

select public.on_deck_join_session(
  '5e551011-0000-0000-0000-0000000000a1', 'device-token-sarah', 'Sarah', 'K', 'intermediate'
);

select lives_ok(
  $$select public.on_deck_queue_player('5e551011-0000-0000-0000-0000000000a1', 'device-token-sarah')$$,
  'a Player who has joined can queue with no account'
);

select is(
  (select count(*)::int from public.on_deck_session_events
   where session_id = '5e551011-0000-0000-0000-0000000000a1' and type = 'PLAYER_QUEUED'),
  1,
  'queueing appended exactly one PLAYER_QUEUED'
);

select lives_ok(
  $$select public.on_deck_queue_player('5e551011-0000-0000-0000-0000000000a1', 'device-token-sarah')$$,
  'queueing again does not error'
);

select is(
  (select count(*)::int from public.on_deck_session_events
   where session_id = '5e551011-0000-0000-0000-0000000000a1' and type = 'PLAYER_QUEUED'),
  1,
  'and does not append a second PLAYER_QUEUED for the same token'
);

select throws_ok(
  $$insert into public.on_deck_session_events (session_id, type, operator_kind)
    values ('5e551011-0000-0000-0000-0000000000a1', 'PLAYER_QUEUED', 'player')$$,
  '42501',
  null,
  'a Player still cannot append events directly — only through the RPC'
);

-- ---- as the owning Organizer ----------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select lives_ok(
  $$insert into public.on_deck_session_events (session_id, type, operator_kind, operator_user_id, payload)
    values ('5e551011-0000-0000-0000-0000000000a1', 'COURT_FINISHED', 'organizer',
            '11111111-0000-0000-0000-0000000000a1', '{"court": 1}'::jsonb)$$,
  'the owning Organizer appends COURT_FINISHED'
);

select is(
  (select payload->>'court' from public.on_deck_session_events
   where session_id = '5e551011-0000-0000-0000-0000000000a1' and type = 'COURT_FINISHED'),
  '1',
  'the COURT_FINISHED event carries its Court number'
);

-- ---- as an unrelated Organizer ------------------------------------------
set local request.jwt.claims = '{"sub": "22222222-0000-0000-0000-0000000000a2", "role": "authenticated"}';

select throws_ok(
  $$insert into public.on_deck_session_events (session_id, type, operator_kind, operator_user_id, payload)
    values ('5e551011-0000-0000-0000-0000000000a1', 'COURT_FINISHED', 'organizer',
            '22222222-0000-0000-0000-0000000000a2', '{"court": 2}'::jsonb)$$,
  '42501',
  null,
  'an unrelated Organizer cannot end a Court on a Session that is not theirs'
);

select * from finish();

rollback;

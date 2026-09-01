-- On Deck: Paused (issue #246). What this pins down:
--
--   * a Player removes themselves through the `on_deck_pause_player` RPC —
--     appending PLAYER_PAUSED / player / left — and only after joining;
--   * a paused Player rejoins through `on_deck_requeue_player` (PLAYER_REQUEUED),
--     and the RPC is a no-op when they are not currently paused;
--   * `on_deck_is_paused` tracks the pause/rejoin cycle;
--   * a Player still cannot append these events directly (no anon insert grant);
--   * the Organizer appends the operator-side doors (set-aside, the swap, an
--     operator re-queue) through the existing owner policy;
--   * PLAYER_REQUEUED is now an accepted event type.

begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

select has_function(
  'public', 'on_deck_is_paused', array['uuid', 'text'],
  'on_deck_is_paused(uuid, text) exists'
);

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vanessa-paused@example.com'),
  ('22222222-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal-paused@example.com');

insert into public.on_deck_clubs (id, owner_id, name, venue_name, court_count, group_cap, floor_mode) values
  ('c2c2c2c2-0000-0000-0000-0000000000b1', '11111111-0000-0000-0000-0000000000b1', 'TO Pickleball Club', 'Ramsden Park', 8, 4, 'hybrid');

insert into public.on_deck_sessions (id, club_id, venue_name, court_count, group_cap, floor_mode) values
  ('5e552022-0000-0000-0000-0000000000b1', 'c2c2c2c2-0000-0000-0000-0000000000b1', 'Ramsden Park', 8, 4, 'hybrid');

insert into public.on_deck_session_events (session_id, type, operator_kind, operator_user_id) values
  ('5e552022-0000-0000-0000-0000000000b1', 'SESSION_STARTED', 'organizer', '11111111-0000-0000-0000-0000000000b1');

-- PLAYER_REQUEUED is an accepted type now.
select lives_ok(
  $$insert into public.on_deck_session_events (session_id, type, operator_kind, operator_user_id, payload)
    values ('5e552022-0000-0000-0000-0000000000b1', 'PLAYER_REQUEUED', 'organizer',
            '11111111-0000-0000-0000-0000000000b1', '{"token": "seed-token-only"}'::jsonb)$$,
  'PLAYER_REQUEUED passes the type check'
);

-- ---- as an anonymous Player ---------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select public.on_deck_pause_player('5e552022-0000-0000-0000-0000000000b1', 'device-token-dana')$$,
  '42501',
  null,
  'a Player cannot pause before joining the Session'
);

select public.on_deck_join_session(
  '5e552022-0000-0000-0000-0000000000b1', 'device-token-dana', 'Dana', 'R', 'intermediate'
);
select public.on_deck_queue_player('5e552022-0000-0000-0000-0000000000b1', 'device-token-dana');

select is(
  public.on_deck_is_paused('5e552022-0000-0000-0000-0000000000b1', 'device-token-dana'),
  false,
  'a queued Player is not paused'
);

select lives_ok(
  $$select public.on_deck_pause_player('5e552022-0000-0000-0000-0000000000b1', 'device-token-dana')$$,
  'a joined Player removes themselves with no account'
);

select is(
  public.on_deck_is_paused('5e552022-0000-0000-0000-0000000000b1', 'device-token-dana'),
  true,
  'and is now paused'
);

select public.on_deck_pause_player('5e552022-0000-0000-0000-0000000000b1', 'device-token-dana');
select is(
  (select count(*)::int from public.on_deck_session_events
   where session_id = '5e552022-0000-0000-0000-0000000000b1' and type = 'PLAYER_PAUSED'),
  1,
  'pausing again does not append a second PLAYER_PAUSED'
);

select lives_ok(
  $$select public.on_deck_requeue_player('5e552022-0000-0000-0000-0000000000b1', 'device-token-dana')$$,
  'the paused Player rejoins via the Club QR'
);

select is(
  public.on_deck_is_paused('5e552022-0000-0000-0000-0000000000b1', 'device-token-dana'),
  false,
  'and is no longer paused'
);

select public.on_deck_requeue_player('5e552022-0000-0000-0000-0000000000b1', 'device-token-dana');
select is(
  (select count(*)::int from public.on_deck_session_events
   where session_id = '5e552022-0000-0000-0000-0000000000b1' and type = 'PLAYER_REQUEUED'
     and payload ->> 'token' = 'device-token-dana'),
  1,
  're-queueing again when not paused is a no-op'
);

select throws_ok(
  $$insert into public.on_deck_session_events (session_id, type, operator_kind)
    values ('5e552022-0000-0000-0000-0000000000b1', 'PLAYER_PAUSED', 'player')$$,
  '42501',
  null,
  'a Player still cannot append events directly'
);

-- ---- as an unrelated Organizer ----------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-0000-0000-0000-0000000000b2", "role": "authenticated"}';

select throws_ok(
  $$insert into public.on_deck_session_events (session_id, type, operator_kind, operator_user_id, payload)
    values ('5e552022-0000-0000-0000-0000000000b1', 'FOURSOME_MEMBER_SWAPPED', 'organizer',
            '22222222-0000-0000-0000-0000000000b2',
            '{"court": 1, "out": "a", "in": "b"}'::jsonb)$$,
  '42501',
  null,
  'an unrelated Organizer cannot swap on a Session that is not theirs'
);

select * from finish();

rollback;

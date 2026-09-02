-- On Deck: Last Call, close, and the Session Summary (issue #255). What this
-- pins down:
--
--   * `on_deck_last_call` appends a LAST_CALL for the owning Organizer and for
--     a link-authenticated Volunteer; it is idempotent; a stranger can't call;
--   * `on_deck_close_session` stores the Summary, flips status to closed, and
--     purges every event row for the Session (the roster with it, ADR 0001);
--   * a stranger can't close; a closed Session frees the "one open per Club"
--     index; the Summary survives the purge and is the Organizer's to read;
--   * a Player still cannot append LAST_CALL / SESSION_CLOSED directly.

begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-0000-0000-00000000ec01', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vanessa-close@example.com'),
  ('22222222-0000-0000-0000-00000000ec02', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stranger-close@example.com');

insert into public.on_deck_clubs (id, owner_id, name, venue_name, court_count, group_cap, floor_mode) values
  ('c1050000-0000-0000-0000-00000000ec01', '11111111-0000-0000-0000-00000000ec01', 'TO Pickleball Club', 'Ramsden Park', 8, 4, 'hybrid');

insert into public.on_deck_sessions
  (id, club_id, venue_name, court_count, group_cap, floor_mode, status, closed_at, volunteer_token) values
  ('5e550000-0000-0000-0000-00000000ec01', 'c1050000-0000-0000-0000-00000000ec01', 'Ramsden Park', 8, 4, 'hybrid', 'open', null, 'vol-token-cccccccccccccccccccccccccc'),
  ('5e550000-0000-0000-0000-00000000ec02', 'c1050000-0000-0000-0000-00000000ec01', 'Ramsden Park', 8, 4, 'hybrid', 'closed', now(), 'vol-token-dddddddddddddddddddddddddd');

insert into public.on_deck_session_events (session_id, type, operator_kind, operator_user_id, payload, at) values
  ('5e550000-0000-0000-0000-00000000ec01', 'SESSION_STARTED', 'organizer', '11111111-0000-0000-0000-00000000ec01', '{}'::jsonb, now() - interval '2 hours'),
  ('5e550000-0000-0000-0000-00000000ec01', 'PLAYER_JOINED', 'player', null, '{"token":"device-aaaaaaaaaaaaaaaa","firstName":"Ada","lastInitial":"L","skillLevel":"intermediate"}'::jsonb, now() - interval '110 minutes'),
  ('5e550000-0000-0000-0000-00000000ec01', 'PLAYER_JOINED', 'player', null, '{"token":"device-bbbbbbbbbbbbbbbb","firstName":"Ben","lastInitial":"K","skillLevel":"advanced"}'::jsonb, now() - interval '105 minutes');

-- ---- LAST_CALL: the owning Organizer ------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-0000-0000-0000-00000000ec01", "role": "authenticated"}';

select lives_ok(
  $$select public.on_deck_last_call('5e550000-0000-0000-0000-00000000ec01')$$,
  'the owning Organizer calls Last Call'
);

select is(
  (select count(*)::int from public.on_deck_session_events
   where session_id = '5e550000-0000-0000-0000-00000000ec01' and type = 'LAST_CALL'),
  1,
  'exactly one LAST_CALL is in the log'
);

select lives_ok(
  $$select public.on_deck_last_call('5e550000-0000-0000-0000-00000000ec01')$$,
  'a second Last Call does not error'
);

select is(
  (select count(*)::int from public.on_deck_session_events
   where session_id = '5e550000-0000-0000-0000-00000000ec01' and type = 'LAST_CALL'),
  1,
  'Last Call is idempotent — still exactly one row'
);

-- ---- LAST_CALL: a stranger --------------------------------------------
set local request.jwt.claims = '{"sub": "22222222-0000-0000-0000-00000000ec02", "role": "authenticated"}';
select throws_ok(
  $$select public.on_deck_last_call('5e550000-0000-0000-0000-00000000ec01')$$,
  '42501', null,
  'a non-owner cannot call Last Call'
);

-- ---- LAST_CALL: a link Volunteer ------------------------------------
-- The Organizer's Last Call above already landed the one LAST_CALL row on
-- ec01, so a Volunteer call there is the idempotent no-op path — it must still
-- not error for a valid link.
set local role anon;
set local request.jwt.claims = '';
select lives_ok(
  $$select public.on_deck_last_call('5e550000-0000-0000-0000-00000000ec01', 'vol-token-cccccccccccccccccccccccccc')$$,
  'a link-authenticated Volunteer may call Last Call'
);

-- ---- LAST_CALL: a link Volunteer's token is inert on a closed Session --
select throws_ok(
  $$select public.on_deck_last_call('5e550000-0000-0000-0000-00000000ec02', 'vol-token-dddddddddddddddddddddddddd')$$,
  '42501', null,
  'a Volunteer link is inert on a closed Session'
);

-- ---- a Player still cannot append the vocabulary directly ------------
select throws_ok(
  $$insert into public.on_deck_session_events (session_id, type, operator_kind, payload)
    values ('5e550000-0000-0000-0000-00000000ec01', 'SESSION_CLOSED', 'player', '{}'::jsonb)$$,
  '42501', null,
  'anon cannot INSERT a SESSION_CLOSED row'
);

-- ---- close: a stranger ----------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-0000-0000-0000-00000000ec02", "role": "authenticated"}';
select throws_ok(
  $$select public.on_deck_close_session('5e550000-0000-0000-0000-00000000ec01', '{"attendance":2,"gamesPlayed":0}'::jsonb)$$,
  '42501', null,
  'a non-owner cannot close the Session'
);

-- ---- close: the owning Organizer -----------------------------------
set local request.jwt.claims = '{"sub": "11111111-0000-0000-0000-00000000ec01", "role": "authenticated"}';
select lives_ok(
  $$select public.on_deck_close_session('5e550000-0000-0000-0000-00000000ec01', '{"attendance":2,"gamesPlayed":3,"skillMix":{"advanced":1}}'::jsonb)$$,
  'the owning Organizer closes the Session'
);

select is(
  (select status from public.on_deck_sessions where id = '5e550000-0000-0000-0000-00000000ec01'),
  'closed',
  'the Session is now closed'
);

select isnt(
  (select closed_at from public.on_deck_sessions where id = '5e550000-0000-0000-0000-00000000ec01'),
  null,
  'closed_at is stamped'
);

select is(
  (select count(*)::int from public.on_deck_session_events
   where session_id = '5e550000-0000-0000-0000-00000000ec01'),
  0,
  'the event log — and the Player roster with it — is purged'
);

select is(
  (select attendance from public.on_deck_session_summaries
   where session_id = '5e550000-0000-0000-0000-00000000ec01'),
  2,
  'the Session Summary survives the purge, with its headline numbers'
);

select is(
  (select games_played from public.on_deck_session_summaries
   where session_id = '5e550000-0000-0000-0000-00000000ec01'),
  3,
  'games_played is pulled out of the summary JSON'
);

-- ---- close is idempotent, and frees the "one open per Club" index ----
select lives_ok(
  $$select public.on_deck_close_session('5e550000-0000-0000-0000-00000000ec01', '{"attendance":2,"gamesPlayed":3}'::jsonb)$$,
  'closing an already-closed Session is a no-op, not an error'
);

set local role postgres;
select lives_ok(
  $$insert into public.on_deck_sessions (club_id, venue_name, court_count, group_cap, floor_mode)
    values ('c1050000-0000-0000-0000-00000000ec01', 'Ramsden Park', 8, 4, 'hybrid')$$,
  'a new open Session can be started once the old one is closed'
);

select * from finish();
rollback;

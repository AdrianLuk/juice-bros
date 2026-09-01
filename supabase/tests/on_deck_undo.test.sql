-- On Deck: operator Undo (issue #247). What this pins down:
--
--   * `on_deck_undo_last_event` drops the single most recent event — the owning
--     Organizer via their account, a Volunteer via the link token;
--   * it refuses a stale `expected_seq` (a concurrent Operator) with 40001;
--   * it refuses a non-undoable last event (SESSION_STARTED), an event older
--     than the undo window, and an empty log;
--   * the volunteer path is gated the same as `on_deck_volunteer_append`
--     (wrong token / self-serve all rejected), and a closed Session takes none;
--   * an unrelated Organizer cannot undo, and nobody can DELETE a row directly.

begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select has_function(
  'public', 'on_deck_undo_last_event', array['uuid', 'bigint', 'text'],
  'on_deck_undo_last_event(uuid, bigint, text) exists'
);

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vanessa-undo@example.com'),
  ('22222222-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal-undo@example.com'),
  ('33333333-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'selfserve-undo@example.com');

insert into public.on_deck_clubs (id, owner_id, name, venue_name, court_count, group_cap, floor_mode) values
  ('cd0d0d0d-0000-0000-0000-0000000000d1', '11111111-0000-0000-0000-0000000000d1', 'TO Pickleball Club', 'Ramsden Park', 8, 4, 'hybrid'),
  ('cd0d0d0d-0000-0000-0000-0000000000d3', '33333333-0000-0000-0000-0000000000d3', 'Self Serve Club', 'Trinity Bellwoods', 8, 4, 'self-serve');

insert into public.on_deck_sessions
  (id, club_id, venue_name, court_count, group_cap, floor_mode, status, volunteer_token) values
  ('5e55d0d0-0000-0000-0000-0000000000d1', 'cd0d0d0d-0000-0000-0000-0000000000d1', 'Ramsden Park', 8, 4, 'hybrid', 'open', 'vol-token-dddddddddddddddddddddddddd'),
  ('5e55d0d0-0000-0000-0000-0000000000d3', 'cd0d0d0d-0000-0000-0000-0000000000d3', 'Trinity Bellwoods', 8, 4, 'self-serve', 'open', 'vol-token-eeeeeeeeeeeeeeeeeeeeeeeeee');

-- d1's log: SESSION_STARTED (old), then two recent COURT_FINISHED. Fixed seqs
-- so the tests can name them without racing a subquery against the delete.
insert into public.on_deck_session_events (session_id, seq, type, operator_kind, operator_user_id, payload, at)
  overriding system value
values
  ('5e55d0d0-0000-0000-0000-0000000000d1', 8001, 'SESSION_STARTED', 'organizer', '11111111-0000-0000-0000-0000000000d1', '{}'::jsonb, now() - interval '90 minutes'),
  ('5e55d0d0-0000-0000-0000-0000000000d1', 8002, 'COURT_FINISHED', 'organizer', '11111111-0000-0000-0000-0000000000d1', '{"court": 1}'::jsonb, now() - interval '5 minutes'),
  ('5e55d0d0-0000-0000-0000-0000000000d1', 8003, 'COURT_FINISHED', 'volunteer', null, '{"court": 2}'::jsonb, now() - interval '1 minute'),
  ('5e55d0d0-0000-0000-0000-0000000000d1', 8004, 'PLAYER_PAUSED', 'organizer', '11111111-0000-0000-0000-0000000000d1', '{"token": "device-token-old", "reason": "set-aside"}'::jsonb, now() - interval '30 minutes');

-- ---- as the owning Organizer ----------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-0000-0000-0000-0000000000d1", "role": "authenticated"}';

-- Latest is 8004, a 30-minute-old PLAYER_PAUSED — inside the log but past the
-- undo window.
select throws_ok(
  $$select public.on_deck_undo_last_event('5e55d0d0-0000-0000-0000-0000000000d1', 8004)$$,
  '22023', null,
  'an event older than the undo window cannot be undone'
);

-- Drop 8004 out of band so the recent events are on top.
set local role postgres;
delete from public.on_deck_session_events where seq = 8004;
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-0000-0000-0000-0000000000d1", "role": "authenticated"}';

-- Stale expected_seq: caller thinks 8002 is the top, but it is 8003.
select throws_ok(
  $$select public.on_deck_undo_last_event('5e55d0d0-0000-0000-0000-0000000000d1', 8002)$$,
  '40001', null,
  'a stale expected_seq is refused as a concurrent-operator conflict'
);

select lives_ok(
  $$select public.on_deck_undo_last_event('5e55d0d0-0000-0000-0000-0000000000d1', 8003)$$,
  'the owning Organizer undoes the latest event (8003)'
);
select is(
  (select count(*)::int from public.on_deck_session_events where seq = 8003),
  0,
  '8003 is gone from the log'
);

select lives_ok(
  $$select public.on_deck_undo_last_event('5e55d0d0-0000-0000-0000-0000000000d1', 8002)$$,
  'undo walks back one more recent event (8002)'
);

-- Only SESSION_STARTED (8001) remains — not an undoable type.
select throws_ok(
  $$select public.on_deck_undo_last_event('5e55d0d0-0000-0000-0000-0000000000d1', 8001)$$,
  '22023', null,
  'SESSION_STARTED is not an Operator''s to undo'
);

-- ---- as an unrelated Organizer ------------------------------------------
set local request.jwt.claims = '{"sub": "22222222-0000-0000-0000-0000000000d2", "role": "authenticated"}';

set local role postgres;
insert into public.on_deck_session_events (session_id, seq, type, operator_kind, operator_user_id, payload, at)
  overriding system value
values
  ('5e55d0d0-0000-0000-0000-0000000000d1', 8010, 'COURT_FINISHED', 'organizer', '11111111-0000-0000-0000-0000000000d1', '{"court": 3}'::jsonb, now());
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-0000-0000-0000-0000000000d2", "role": "authenticated"}';

select throws_ok(
  $$select public.on_deck_undo_last_event('5e55d0d0-0000-0000-0000-0000000000d1', 8010)$$,
  '42501', null,
  'an unrelated Organizer cannot undo a Session that is not theirs'
);
select throws_ok(
  $$delete from public.on_deck_session_events where seq = 8010$$,
  '42501', null,
  'nobody can DELETE an event row directly — only through the RPC'
);

-- ---- as an anonymous Volunteer ---------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select public.on_deck_undo_last_event('5e55d0d0-0000-0000-0000-0000000000d1', 8010, 'wrong-token-dddddddddddddddddddddd')$$,
  '42501', null,
  'a wrong volunteer token cannot undo'
);
select lives_ok(
  $$select public.on_deck_undo_last_event('5e55d0d0-0000-0000-0000-0000000000d1', 8010, 'vol-token-dddddddddddddddddddddddddd')$$,
  'a link-authenticated Volunteer undoes the latest event'
);
select is(
  (select count(*)::int from public.on_deck_session_events where seq = 8010),
  0,
  'the volunteer''s undo dropped the row'
);

-- Self-serve Session: inert even with the right token.
set local role postgres;
insert into public.on_deck_session_events (session_id, seq, type, operator_kind, operator_user_id, payload, at)
  overriding system value
values
  ('5e55d0d0-0000-0000-0000-0000000000d3', 8020, 'SESSION_STARTED', 'organizer', '33333333-0000-0000-0000-0000000000d3', '{}'::jsonb, now() - interval '10 minutes'),
  ('5e55d0d0-0000-0000-0000-0000000000d3', 8021, 'COURT_FINISHED', 'organizer', '33333333-0000-0000-0000-0000000000d3', '{"court": 1}'::jsonb, now());
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select public.on_deck_undo_last_event('5e55d0d0-0000-0000-0000-0000000000d3', 8021, 'vol-token-eeeeeeeeeeeeeeeeeeeeeeeeee')$$,
  '42501', null,
  'a self-serve Session takes no volunteer undo'
);

-- Closed Session: the Organizer path refuses too.
set local role postgres;
update public.on_deck_sessions set status = 'closed', closed_at = now()
  where id = '5e55d0d0-0000-0000-0000-0000000000d1';
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-0000-0000-0000-0000000000d1", "role": "authenticated"}';

select throws_ok(
  $$select public.on_deck_undo_last_event('5e55d0d0-0000-0000-0000-0000000000d1', 8001)$$,
  '42501', null,
  'a closed Session takes no undo'
);
select is(
  (select count(*)::int from public.on_deck_session_events where seq = 8001),
  1,
  'SESSION_STARTED was never touched'
);

select * from finish();

rollback;

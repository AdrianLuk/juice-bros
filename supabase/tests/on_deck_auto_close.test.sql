-- On Deck: the forgotten-Session auto-close (issue #516). What this pins down:
--
--   * `on_deck_auto_close_stale_session` refuses (55000) a Session whose log
--     has an event inside `on_deck_stale_after()` — a live Session, however
--     long it has been open, is never closed;
--   * it closes a Session whose log has gone quiet past that window: stores
--     the Summary with `auto_closed = true`, flips status to closed, stamps
--     `closed_at`, and purges the event log (the roster with it, ADR 0001);
--   * a stranger can't auto-close someone else's Club's Session;
--   * it is idempotent — a second call on an already-closed Session is a
--     silent no-op (`false`), not an error;
--   * a deliberate `on_deck_close_session` is untouched by any of this and
--     still closes a live Session on an Organizer's own tap, `auto_closed`
--     left `false`;
--   * the shared `on_deck_finalize_session_close` tail isn't itself a way in —
--     no role has an execute grant on it directly.

begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vanessa-autoclose@example.com'),
  ('22222222-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stranger-autoclose@example.com'),
  ('33333333-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'steady-autoclose@example.com');

-- Two Clubs — one Club per owner (`on_deck_clubs_one_per_owner`) means the
-- stale and the still-live Session can't share a Club, since only one open
-- Session is allowed per Club at a time either way.
insert into public.on_deck_clubs (id, owner_id, name, venue_name, court_count, group_cap, floor_mode) values
  ('c1060000-0000-0000-0000-000000000601', '11111111-0000-0000-0000-000000000601', 'TO Pickleball Club', 'Ramsden Park', 8, 4, 'hybrid'),
  ('c1060000-0000-0000-0000-000000000603', '33333333-0000-0000-0000-000000000603', 'Steady Sundays', 'East Gym', 6, 4, 'hybrid');

-- Two open Sessions: one genuinely stale (last event well past the
-- threshold), one long-running but still live (started long ago, event just
-- now — must never close).
insert into public.on_deck_sessions
  (id, club_id, venue_name, court_count, group_cap, floor_mode, status) values
  ('5e560000-0000-0000-0000-000000000601', 'c1060000-0000-0000-0000-000000000601', 'Ramsden Park', 8, 4, 'hybrid', 'open'),
  ('5e560000-0000-0000-0000-000000000602', 'c1060000-0000-0000-0000-000000000603', 'East Gym', 6, 4, 'hybrid', 'open');

insert into public.on_deck_session_events (session_id, type, operator_kind, operator_user_id, payload, at) values
  -- Stale: started a week ago, nothing since Last Call fired days later.
  ('5e560000-0000-0000-0000-000000000601', 'SESSION_STARTED', 'organizer', '11111111-0000-0000-0000-000000000601', '{}'::jsonb, now() - interval '9 days'),
  ('5e560000-0000-0000-0000-000000000601', 'PLAYER_JOINED', 'player', null, '{"token":"device-cccccccccccccccc","firstName":"Cy","lastInitial":"P","skillLevel":"beginner"}'::jsonb, now() - interval '9 days'),
  ('5e560000-0000-0000-0000-000000000601', 'COURT_FINISHED', 'organizer', '11111111-0000-0000-0000-000000000601', '{"court":1}'::jsonb, now() - interval '9 days' + interval '20 minutes'),
  -- Long-running but genuinely live: started ten hours ago, a court just
  -- finished a minute ago. Must never be auto-closed.
  ('5e560000-0000-0000-0000-000000000602', 'SESSION_STARTED', 'organizer', '33333333-0000-0000-0000-000000000603', '{}'::jsonb, now() - interval '10 hours'),
  ('5e560000-0000-0000-0000-000000000602', 'COURT_FINISHED', 'organizer', '33333333-0000-0000-0000-000000000603', '{"court":1}'::jsonb, now() - interval '1 minute');

-- ---- refuses a stranger, before it even looks at staleness -------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-0000-0000-0000-000000000602", "role": "authenticated"}';
select throws_ok(
  $$select public.on_deck_auto_close_stale_session('5e560000-0000-0000-0000-000000000601', '{"attendance":1,"gamesPlayed":1}'::jsonb)$$,
  '42501', null,
  'a non-owner cannot auto-close another Club''s session'
);

-- ---- refuses a live session, no matter how long it has been open -------
set local request.jwt.claims = '{"sub": "33333333-0000-0000-0000-000000000603", "role": "authenticated"}';
select throws_ok(
  $$select public.on_deck_auto_close_stale_session('5e560000-0000-0000-0000-000000000602', '{"attendance":0,"gamesPlayed":1}'::jsonb)$$,
  '55000', null,
  'a session with a recent event is refused, even ten hours open'
);

select is(
  (select status from public.on_deck_sessions where id = '5e560000-0000-0000-0000-000000000602'),
  'open',
  'the live session is untouched — still open'
);

select is(
  (select count(*)::int from public.on_deck_session_events where session_id = '5e560000-0000-0000-0000-000000000602'),
  2,
  'the live session''s log is untouched'
);

-- ---- anon cannot call it at all -----------------------------------------
set local role anon;
set local request.jwt.claims = '';
select throws_ok(
  $$select public.on_deck_auto_close_stale_session('5e560000-0000-0000-0000-000000000601', '{"attendance":1,"gamesPlayed":1}'::jsonb)$$,
  '42501', null,
  'anon has no execute grant on the auto-close function'
);

-- ---- closes the genuinely stale session ---------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-0000-0000-0000-000000000601", "role": "authenticated"}';

select is(
  (select public.on_deck_auto_close_stale_session(
    '5e560000-0000-0000-0000-000000000601',
    '{"attendance":1,"gamesPlayed":1,"skillMix":{"beginner":1}}'::jsonb
  )),
  true,
  'the stale session closes, and reports that it did'
);

select is(
  (select status from public.on_deck_sessions where id = '5e560000-0000-0000-0000-000000000601'),
  'closed',
  'the session is now closed'
);

select isnt(
  (select closed_at from public.on_deck_sessions where id = '5e560000-0000-0000-0000-000000000601'),
  null,
  'closed_at is stamped'
);

select is(
  (select count(*)::int from public.on_deck_session_events where session_id = '5e560000-0000-0000-0000-000000000601'),
  0,
  'the event log — and the Player roster with it — is purged'
);

select is(
  (select attendance from public.on_deck_session_summaries where session_id = '5e560000-0000-0000-0000-000000000601'),
  1,
  'the Summary survives the purge, with its headline numbers'
);

select is(
  (select games_played from public.on_deck_session_summaries where session_id = '5e560000-0000-0000-0000-000000000601'),
  1,
  'games_played is pulled out of the summary JSON, same as a deliberate close'
);

select is(
  (select auto_closed from public.on_deck_session_summaries where session_id = '5e560000-0000-0000-0000-000000000601'),
  true,
  'the Summary is flagged auto_closed — closed for the Organizer, not by them'
);

-- ---- idempotent: a second call is a silent no-op ------------------------
select is(
  (select public.on_deck_auto_close_stale_session(
    '5e560000-0000-0000-0000-000000000601',
    '{"attendance":1,"gamesPlayed":1}'::jsonb
  )),
  false,
  'auto-closing an already-closed session is a no-op, not an error, and reports it did nothing'
);

select is(
  (select count(*)::int from public.on_deck_session_summaries where session_id = '5e560000-0000-0000-0000-000000000601'),
  1,
  'the no-op left exactly one Summary row behind — no duplicate'
);

-- ---- a deliberate close is unaffected: it still closes a live session, --
-- ---- and leaves auto_closed false ---------------------------------------
set local request.jwt.claims = '{"sub": "33333333-0000-0000-0000-000000000603", "role": "authenticated"}';
select lives_ok(
  $$select public.on_deck_close_session('5e560000-0000-0000-0000-000000000602', '{"attendance":0,"gamesPlayed":1}'::jsonb)$$,
  'a deliberate close still closes a live session on the Organizer''s own tap'
);

select is(
  (select auto_closed from public.on_deck_session_summaries where session_id = '5e560000-0000-0000-0000-000000000602'),
  false,
  'a deliberate close leaves auto_closed false'
);

-- ---- the shared finalize helper is not itself a way in ------------------
select ok(
  not has_function_privilege(
    'authenticated',
    'public.on_deck_finalize_session_close(public.on_deck_sessions, jsonb, boolean)',
    'EXECUTE'
  ),
  'authenticated has no execute grant on the shared finalize helper'
);

-- ---- closing frees the "one open per Club" index, same as a deliberate close
set local role postgres;
select lives_ok(
  $$insert into public.on_deck_sessions (club_id, venue_name, court_count, group_cap, floor_mode)
    values ('c1060000-0000-0000-0000-000000000601', 'Ramsden Park', 8, 4, 'hybrid')$$,
  'a new open session can start once the stale one has closed itself'
);

select * from finish();
rollback;

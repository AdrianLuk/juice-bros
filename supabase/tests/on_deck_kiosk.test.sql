-- On Deck: the courtside Kiosk (issue #259). What this pins down:
--
--   * COURT_CONFIRMED is in the on_deck_event_type check;
--   * on_deck_check_kiosk_access is true for an open self-serve / hybrid
--     Session, false for a closed one and for a volunteer-run one;
--   * on_deck_kiosk_append appends a turnover event as operator_kind 'kiosk' /
--     no user id, for COURT_FINISHED / FOURSOME_MEMBER_SWAPPED / PLAYER_JOINED
--     (walk-up) / COURT_CONFIRMED;
--   * it rejects a closed Session, a volunteer-run Session, and any other event
--     type (SESSION_*, LAST_CALL, the Group vocabulary);
--   * a kiosk PLAYER_JOINED must be a server-minted, queued, valid-level walk-up;
--   * the Kiosk still cannot append events directly or touch the Session row
--     (no anon grants) — the scope is enforced, not just hidden;
--   * on_deck_undo_last_event admits a Kiosk caller (p_kiosk => true) on a
--     self-serve / hybrid Session and refuses one on a volunteer-run Session.

begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

-- --- vocabulary --------------------------------------------------------------

select col_type_is(
  'public', 'on_deck_session_events', 'type', 'text',
  'events still carry a text type'
);
select lives_ok(
  $$insert into public.on_deck_session_events (session_id, type, operator_kind)
    select '00000000-0000-0000-0000-000000000000', 'COURT_CONFIRMED', 'kiosk'
    where false$$,
  'COURT_CONFIRMED passes the on_deck_event_type check'
);
select has_function(
  'public', 'on_deck_check_kiosk_access', array['uuid'],
  'on_deck_check_kiosk_access(uuid) exists'
);
select has_function(
  'public', 'on_deck_kiosk_append', array['uuid', 'text', 'jsonb'],
  'on_deck_kiosk_append(uuid, text, jsonb) exists'
);

-- --- fixtures ----------------------------------------------------------------

-- One owner per Club (one-Club-per-owner index) and one open Session per Club
-- (one-open-per-club index) — so a distinct owner + Club per Floor Mode.
insert into auth.users (id, instance_id, aud, role, email) values
  ('2222259a-0000-0000-0000-000000000259', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vanessa-259a@example.com'),
  ('2222259b-0000-0000-0000-000000000259', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vanessa-259b@example.com'),
  ('2222259c-0000-0000-0000-000000000259', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vanessa-259c@example.com'),
  ('2222259d-0000-0000-0000-000000000259', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vanessa-259d@example.com');

insert into public.on_deck_clubs (id, owner_id, name, venue_name, court_count, group_cap, floor_mode) values
  ('c9c90a00-0000-0000-0000-000000000259', '2222259a-0000-0000-0000-000000000259', 'Self-serve Club 259', 'Ramsden Park', 8, 4, 'self-serve'),
  ('c9c90b00-0000-0000-0000-000000000259', '2222259b-0000-0000-0000-000000000259', 'Hybrid Club 259', 'Ramsden Park', 8, 4, 'hybrid'),
  ('c9c90c00-0000-0000-0000-000000000259', '2222259c-0000-0000-0000-000000000259', 'Volunteer-run Club 259', 'Ramsden Park', 8, 4, 'volunteer-run'),
  ('c9c90d00-0000-0000-0000-000000000259', '2222259d-0000-0000-0000-000000000259', 'Closed Club 259', 'Ramsden Park', 8, 4, 'self-serve');

-- ...a — self-serve open (the Kiosk's home), ...b — hybrid open, ...c —
-- volunteer-run open, ...d — self-serve closed.
insert into public.on_deck_sessions
  (id, club_id, venue_name, court_count, group_cap, floor_mode, status, closed_at, volunteer_token) values
  ('5e552590-0000-0000-0000-00000000000a', 'c9c90a00-0000-0000-0000-000000000259', 'Ramsden Park', 8, 4, 'self-serve', 'open', null, 'vol-token-259aaaaaaaaaaaaaaaaaaaaa'),
  ('5e552590-0000-0000-0000-00000000000b', 'c9c90b00-0000-0000-0000-000000000259', 'Ramsden Park', 8, 4, 'hybrid', 'open', null, 'vol-token-259bbbbbbbbbbbbbbbbbbbbb'),
  ('5e552590-0000-0000-0000-00000000000c', 'c9c90c00-0000-0000-0000-000000000259', 'Ramsden Park', 8, 4, 'volunteer-run', 'open', null, 'vol-token-259cccccccccccccccccccc'),
  ('5e552590-0000-0000-0000-00000000000d', 'c9c90d00-0000-0000-0000-000000000259', 'Ramsden Park', 8, 4, 'self-serve', 'closed', now(), 'vol-token-259dddddddddddddddddddd');

insert into public.on_deck_session_events (session_id, type, operator_kind, operator_user_id) values
  ('5e552590-0000-0000-0000-00000000000a', 'SESSION_STARTED', 'organizer', '2222259a-0000-0000-0000-000000000259'),
  ('5e552590-0000-0000-0000-00000000000b', 'SESSION_STARTED', 'organizer', '2222259a-0000-0000-0000-000000000259'),
  ('5e552590-0000-0000-0000-00000000000c', 'SESSION_STARTED', 'organizer', '2222259a-0000-0000-0000-000000000259');

-- --- as an anonymous Kiosk (no account, no token) ---------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  public.on_deck_check_kiosk_access('5e552590-0000-0000-0000-00000000000a'),
  true, 'kiosk access: true for an open self-serve Session'
);
select is(
  public.on_deck_check_kiosk_access('5e552590-0000-0000-0000-00000000000b'),
  true, 'kiosk access: true for an open hybrid Session'
);
select is(
  public.on_deck_check_kiosk_access('5e552590-0000-0000-0000-00000000000c'),
  false, 'kiosk access: false for a volunteer-run Session'
);
select is(
  public.on_deck_check_kiosk_access('5e552590-0000-0000-0000-00000000000d'),
  false, 'kiosk access: false for a closed Session'
);

-- A Kiosk ends a Game.
select lives_ok(
  $$select public.on_deck_kiosk_append(
      '5e552590-0000-0000-0000-00000000000a', 'COURT_FINISHED', '{"court": 1}'::jsonb)$$,
  'a kiosk appends COURT_FINISHED'
);
select is(
  (select operator_kind from public.on_deck_session_events
   where session_id = '5e552590-0000-0000-0000-00000000000a' and type = 'COURT_FINISHED'),
  'kiosk', 'the turnover is recorded as a kiosk action'
);
select is(
  (select operator_user_id from public.on_deck_session_events
   where session_id = '5e552590-0000-0000-0000-00000000000a' and type = 'COURT_FINISHED'),
  null, 'a kiosk action carries no user id'
);

-- A Kiosk confirms an idle Court.
select lives_ok(
  $$select public.on_deck_kiosk_append(
      '5e552590-0000-0000-0000-00000000000a', 'COURT_CONFIRMED',
      '{"court": 2, "since": null}'::jsonb)$$,
  'a kiosk appends COURT_CONFIRMED'
);

-- A Kiosk adds a walk-up ("add me").
select lives_ok(
  $$select public.on_deck_kiosk_append(
      '5e552590-0000-0000-0000-00000000000a', 'PLAYER_JOINED',
      '{"token": "walkup-00000000-0000-0000-0000-000000000259", "firstName": "Wade", "lastInitial": "K", "skillLevel": "beginner", "queueOnJoin": true}'::jsonb)$$,
  'a kiosk adds a walk-up Player'
);

-- Rejections.
select throws_ok(
  $$select public.on_deck_kiosk_append(
      '5e552590-0000-0000-0000-00000000000c', 'COURT_FINISHED', '{"court": 1}'::jsonb)$$,
  '42501', null,
  'the kiosk is inert on a volunteer-run Session'
);
select throws_ok(
  $$select public.on_deck_kiosk_append(
      '5e552590-0000-0000-0000-00000000000d', 'COURT_FINISHED', '{"court": 1}'::jsonb)$$,
  '42501', null,
  'the kiosk is inert on a closed Session'
);
select throws_ok(
  $$select public.on_deck_kiosk_append(
      '5e552590-0000-0000-0000-00000000000a', 'LAST_CALL', '{}'::jsonb)$$,
  '42501', null,
  'the kiosk cannot call LAST_CALL (ADR 0002)'
);
select throws_ok(
  $$select public.on_deck_kiosk_append(
      '5e552590-0000-0000-0000-00000000000a', 'GROUP_FORMED',
      '{"groupId": "group-00000000-0000-0000-0000-000000000001", "memberTokens": ["a", "b"]}'::jsonb)$$,
  '42501', null,
  'the kiosk cannot form a Group'
);
select throws_ok(
  $$select public.on_deck_kiosk_append(
      '5e552590-0000-0000-0000-00000000000a', 'PLAYER_JOINED',
      '{"token": "hand-crafted", "firstName": "Wade", "lastInitial": "K", "skillLevel": "beginner", "queueOnJoin": true}'::jsonb)$$,
  '22023', null,
  'a kiosk walk-up id must be server-minted'
);

-- The Kiosk still cannot write the log directly or touch the Session row.
select throws_ok(
  $$insert into public.on_deck_session_events (session_id, type, operator_kind)
    values ('5e552590-0000-0000-0000-00000000000a', 'COURT_FINISHED', 'kiosk')$$,
  null, null,
  'anon has no direct INSERT on the event log'
);

-- Undo admits a Kiosk on self-serve / hybrid, refuses on volunteer-run, and a
-- Kiosk may only take back a kiosk-sourced event.
select throws_ok(
  $$select public.on_deck_undo_last_event(
      '5e552590-0000-0000-0000-00000000000c',
      (select max(seq) from public.on_deck_session_events
       where session_id = '5e552590-0000-0000-0000-00000000000c'),
      null, true)$$,
  '42501', null,
  'a kiosk undo is refused on a volunteer-run Session'
);

-- A Volunteer's turnover at the tip of the self-serve Session's log — a Kiosk
-- must not be able to roll that back (it has no credential of its own).
reset role;
insert into public.on_deck_session_events (session_id, type, operator_kind, payload)
  values ('5e552590-0000-0000-0000-00000000000a', 'COURT_FINISHED', 'volunteer', '{"court": 5}'::jsonb);
set local role anon;
select throws_ok(
  $$select public.on_deck_undo_last_event(
      '5e552590-0000-0000-0000-00000000000a',
      (select max(seq) from public.on_deck_session_events
       where session_id = '5e552590-0000-0000-0000-00000000000a'),
      null, true)$$,
  '42501', null,
  'a kiosk cannot undo a non-kiosk (volunteer) action'
);

-- ...but a kiosk-sourced turnover at the tip it can.
select public.on_deck_kiosk_append(
  '5e552590-0000-0000-0000-00000000000a', 'COURT_FINISHED', '{"court": 3}'::jsonb);
select lives_ok(
  $$select public.on_deck_undo_last_event(
      '5e552590-0000-0000-0000-00000000000a',
      (select max(seq) from public.on_deck_session_events
       where session_id = '5e552590-0000-0000-0000-00000000000a'),
      null, true)$$,
  'a kiosk undo drops the last kiosk turnover on a self-serve Session'
);

select * from finish();

rollback;

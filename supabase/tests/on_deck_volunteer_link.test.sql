-- On Deck: the Volunteer Link (issue #248). What this pins down:
--
--   * every Session carries a `volunteer_token`, and `anon` cannot read it off
--     the world-readable open-Session row (column privilege, not just RLS);
--   * `on_deck_check_volunteer_token` is true only for the right token on an
--     open Session that admits volunteers — false for a wrong token, a closed
--     Session, or a `self-serve` one;
--   * `on_deck_volunteer_append` appends a turnover event as
--     `operator_kind = 'volunteer'` / no user id;
--   * it rejects a wrong token, a closed Session, a `self-serve` Session, a
--     non-turnover event type, and a pause that is not a set-aside;
--   * a Volunteer still cannot append events directly or touch the Session row
--     (no `anon` grants) — the scope is enforced, not just hidden.

begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

select has_column(
  'public', 'on_deck_sessions', 'volunteer_token',
  'on_deck_sessions carries a volunteer_token'
);
select col_not_null(
  'public', 'on_deck_sessions', 'volunteer_token',
  'volunteer_token is always present'
);
select has_function(
  'public', 'on_deck_check_volunteer_token', array['uuid', 'text'],
  'on_deck_check_volunteer_token(uuid, text) exists'
);
select has_function(
  'public', 'on_deck_volunteer_append', array['uuid', 'text', 'text', 'jsonb'],
  'on_deck_volunteer_append(uuid, text, text, jsonb) exists'
);

-- One owner per Club (one-Club-per-owner index) and one open Session per Club
-- (one-open-per-club index), so three of each to stand up A / B / C.
insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vanessa-vol-a@example.com'),
  ('11111111-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vanessa-vol-b@example.com'),
  ('11111111-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vanessa-vol-c@example.com');

insert into public.on_deck_clubs (id, owner_id, name, venue_name, court_count, group_cap, floor_mode) values
  ('c3c3c3c3-0000-0000-0000-00000000000a', '11111111-0000-0000-0000-00000000000a', 'TO Pickleball Club A', 'Ramsden Park', 8, 4, 'hybrid'),
  ('c3c3c3c3-0000-0000-0000-00000000000b', '11111111-0000-0000-0000-00000000000b', 'TO Pickleball Club B', 'Ramsden Park', 8, 4, 'self-serve'),
  ('c3c3c3c3-0000-0000-0000-00000000000c', '11111111-0000-0000-0000-00000000000c', 'TO Pickleball Club C', 'Ramsden Park', 8, 4, 'hybrid');

-- A: open, hybrid — the real Volunteer Link.
-- B: open, self-serve — the link is inert.
-- C: closed, hybrid — the link has expired.
insert into public.on_deck_sessions
  (id, club_id, venue_name, court_count, group_cap, floor_mode, status, closed_at, volunteer_token) values
  ('5e553033-0000-0000-0000-00000000000a', 'c3c3c3c3-0000-0000-0000-00000000000a', 'Ramsden Park', 8, 4, 'hybrid', 'open', null, 'vol-token-aaaaaaaaaaaaaaaaaaaaaaaaaa'),
  ('5e553033-0000-0000-0000-00000000000b', 'c3c3c3c3-0000-0000-0000-00000000000b', 'Ramsden Park', 8, 4, 'self-serve', 'open', null, 'vol-token-bbbbbbbbbbbbbbbbbbbbbbbbbb'),
  ('5e553033-0000-0000-0000-00000000000c', 'c3c3c3c3-0000-0000-0000-00000000000c', 'Ramsden Park', 8, 4, 'hybrid', 'closed', now(), 'vol-token-cccccccccccccccccccccccccc');

insert into public.on_deck_session_events (session_id, type, operator_kind, operator_user_id) values
  ('5e553033-0000-0000-0000-00000000000a', 'SESSION_STARTED', 'organizer', '11111111-0000-0000-0000-00000000000a'),
  ('5e553033-0000-0000-0000-00000000000c', 'SESSION_STARTED', 'organizer', '11111111-0000-0000-0000-00000000000c');

-- ---- as the owning Organizer -------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-0000-0000-0000-00000000000a", "role": "authenticated"}';

select isnt(
  (select volunteer_token from public.on_deck_sessions
   where id = '5e553033-0000-0000-0000-00000000000a'),
  null,
  'the owning Organizer reads the volunteer_token to show the link'
);

-- ---- as an anonymous Volunteer / Player -------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select volunteer_token from public.on_deck_sessions
    where id = '5e553033-0000-0000-0000-00000000000a'$$,
  '42501',
  null,
  'anon cannot read volunteer_token off the open-Session row'
);

select lives_ok(
  $$select venue_name, status, floor_mode from public.on_deck_sessions
    where id = '5e553033-0000-0000-0000-00000000000a'$$,
  'anon still reads the non-secret Session columns'
);

select is(
  public.on_deck_check_volunteer_token('5e553033-0000-0000-0000-00000000000a', 'vol-token-aaaaaaaaaaaaaaaaaaaaaaaaaa'),
  true,
  'the right token on an open hybrid Session checks out'
);
select is(
  public.on_deck_check_volunteer_token('5e553033-0000-0000-0000-00000000000a', 'wrong-token-aaaaaaaaaaaaaaaaaaaa'),
  false,
  'a wrong token does not'
);
select is(
  public.on_deck_check_volunteer_token('5e553033-0000-0000-0000-00000000000b', 'vol-token-bbbbbbbbbbbbbbbbbbbbbbbbbb'),
  false,
  'a self-serve Session''s link is inert'
);
select is(
  public.on_deck_check_volunteer_token('5e553033-0000-0000-0000-00000000000c', 'vol-token-cccccccccccccccccccccccccc'),
  false,
  'a closed Session''s link has expired'
);

-- A Volunteer ends a Game.
select lives_ok(
  $$select public.on_deck_volunteer_append(
      '5e553033-0000-0000-0000-00000000000a', 'vol-token-aaaaaaaaaaaaaaaaaaaaaaaaaa',
      'COURT_FINISHED', '{"court": 3}'::jsonb)$$,
  'a Volunteer ends a Game through the link'
);
select is(
  (select operator_kind from public.on_deck_session_events
   where session_id = '5e553033-0000-0000-0000-00000000000a' and type = 'COURT_FINISHED'),
  'volunteer',
  'the event records volunteer as the Operator'
);
select is(
  (select operator_user_id from public.on_deck_session_events
   where session_id = '5e553033-0000-0000-0000-00000000000a' and type = 'COURT_FINISHED'),
  null,
  'and carries no account'
);

-- A Volunteer sets a Player aside.
select lives_ok(
  $$select public.on_deck_volunteer_append(
      '5e553033-0000-0000-0000-00000000000a', 'vol-token-aaaaaaaaaaaaaaaaaaaaaaaaaa',
      'PLAYER_PAUSED', '{"token": "device-token-x", "reason": "set-aside"}'::jsonb)$$,
  'a Volunteer sets a Player aside'
);

-- A Volunteer does a no-show swap.
select lives_ok(
  $$select public.on_deck_volunteer_append(
      '5e553033-0000-0000-0000-00000000000a', 'vol-token-aaaaaaaaaaaaaaaaaaaaaaaaaa',
      'FOURSOME_MEMBER_SWAPPED', '{"court": 1, "out": "device-token-x", "in": "device-token-y"}'::jsonb)$$,
  'a Volunteer swaps a no-show'
);
select is(
  (select operator_kind from public.on_deck_session_events
   where session_id = '5e553033-0000-0000-0000-00000000000a' and type = 'FOURSOME_MEMBER_SWAPPED'),
  'volunteer',
  'the swap is recorded as a volunteer action'
);

-- The scope: wrong token, self-serve, closed, wrong type, wrong pause reason.
select throws_ok(
  $$select public.on_deck_volunteer_append(
      '5e553033-0000-0000-0000-00000000000a', 'wrong-token-aaaaaaaaaaaaaaaaaaaa',
      'COURT_FINISHED', '{"court": 1}'::jsonb)$$,
  '42501', null,
  'a wrong token cannot append'
);
select throws_ok(
  $$select public.on_deck_volunteer_append(
      '5e553033-0000-0000-0000-00000000000b', 'vol-token-bbbbbbbbbbbbbbbbbbbbbbbbbb',
      'COURT_FINISHED', '{"court": 1}'::jsonb)$$,
  '42501', null,
  'a self-serve Session takes no volunteer-sourced write'
);
select throws_ok(
  $$select public.on_deck_volunteer_append(
      '5e553033-0000-0000-0000-00000000000c', 'vol-token-cccccccccccccccccccccccccc',
      'COURT_FINISHED', '{"court": 1}'::jsonb)$$,
  '42501', null,
  'a closed Session takes no volunteer-sourced write'
);
select throws_ok(
  $$select public.on_deck_volunteer_append(
      '5e553033-0000-0000-0000-00000000000a', 'vol-token-aaaaaaaaaaaaaaaaaaaaaaaaaa',
      'SESSION_CLOSED', '{}'::jsonb)$$,
  '42501', null,
  'a Volunteer cannot fire a non-turnover event (closing the Session)'
);
select throws_ok(
  $$select public.on_deck_volunteer_append(
      '5e553033-0000-0000-0000-00000000000a', 'vol-token-aaaaaaaaaaaaaaaaaaaaaaaaaa',
      'FLOOR_MODE_CHANGED', '{"floorMode": "self-serve"}'::jsonb)$$,
  '42501', null,
  'a Volunteer cannot change a Club/Session setting'
);
select throws_ok(
  $$select public.on_deck_volunteer_append(
      '5e553033-0000-0000-0000-00000000000a', 'vol-token-aaaaaaaaaaaaaaaaaaaaaaaaaa',
      'PLAYER_PAUSED', '{"token": "device-token-y", "reason": "left"}'::jsonb)$$,
  '22023', null,
  'a Volunteer pause must be a set-aside, not a "left"'
);

-- A Volunteer still cannot append directly or edit the Session row.
select throws_ok(
  $$insert into public.on_deck_session_events (session_id, type, operator_kind)
    values ('5e553033-0000-0000-0000-00000000000a', 'COURT_FINISHED', 'volunteer')$$,
  '42501', null,
  'a Volunteer cannot append an event directly — only through the RPC'
);
select throws_ok(
  $$update public.on_deck_sessions set status = 'closed', closed_at = now()
    where id = '5e553033-0000-0000-0000-00000000000a'$$,
  '42501', null,
  'a Volunteer cannot close or edit the Session'
);

select * from finish();

rollback;

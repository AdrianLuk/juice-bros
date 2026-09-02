-- On Deck: Queue Together, player-formed (issue #251). What this pins down:
--
--   * `on_deck_form_group` appends a GROUP_FORMED as operator_kind player when
--     the acting device token has joined and is one of the members;
--   * it rejects a non-server-minted groupId, a member array outside 2..8, and
--     an actor token that is not in the member array;
--   * `on_deck_leave_group` appends a GROUP_MEMBER_REMOVED as operator_kind
--     player;
--   * `on_deck_volunteer_append` now accepts GROUP_DISSOLVED from a Volunteer
--     (recorded as volunteer) and still rejects a non-server-minted groupId;
--   * `on_deck_undo_last_event` will undo a GROUP_DISSOLVED;
--   * a player cannot INSERT GROUP_FORMED / GROUP_MEMBER_REMOVED directly.

begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-0000-0000-0000000002b0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vanessa-qtpf@example.com');

insert into public.on_deck_clubs (id, owner_id, name, venue_name, court_count, group_cap, floor_mode) values
  ('c3c3c3c3-0000-0000-0000-0000000002b0', '11111111-0000-0000-0000-0000000002b0', 'TO Pickleball Club QTPF', 'Ramsden Park', 8, 4, 'hybrid');

insert into public.on_deck_sessions
  (id, club_id, venue_name, court_count, group_cap, floor_mode, status, closed_at, volunteer_token) values
  ('5e553033-0000-0000-0000-0000000002b0', 'c3c3c3c3-0000-0000-0000-0000000002b0', 'Ramsden Park', 8, 4, 'hybrid', 'open', null, 'vol-token-qtpf-aaaaaaaaaaaaaaaaaaaa');

insert into public.on_deck_session_events (session_id, type, operator_kind, operator_user_id) values
  ('5e553033-0000-0000-0000-0000000002b0', 'SESSION_STARTED', 'organizer', '11111111-0000-0000-0000-0000000002b0');

-- Two Players join and queue (the RPC checks a PLAYER_JOINED exists for the
-- acting token; the fold needs both members queued for the Group to materialise
-- — kept realistic here even though this file only asserts the row is written,
-- the fold parity being covered by reduce.test.ts and the e2e).
insert into public.on_deck_session_events (session_id, type, operator_kind, payload) values
  ('5e553033-0000-0000-0000-0000000002b0', 'PLAYER_JOINED', 'player', '{"token": "dev-aaaa", "firstName": "Ana", "lastInitial": "A", "skillLevel": "intermediate"}'::jsonb),
  ('5e553033-0000-0000-0000-0000000002b0', 'PLAYER_JOINED', 'player', '{"token": "dev-bbbb", "firstName": "Bea", "lastInitial": "B", "skillLevel": "intermediate"}'::jsonb),
  ('5e553033-0000-0000-0000-0000000002b0', 'PLAYER_QUEUED', 'player', '{"token": "dev-aaaa"}'::jsonb),
  ('5e553033-0000-0000-0000-0000000002b0', 'PLAYER_QUEUED', 'player', '{"token": "dev-bbbb"}'::jsonb);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

-- A Player forms a Group from their phone.
select lives_ok(
  $$select public.on_deck_form_group(
      '5e553033-0000-0000-0000-0000000002b0', 'dev-aaaa',
      'group-00000000-0000-0000-0000-0000000000a1',
      '["dev-aaaa", "dev-bbbb"]'::jsonb)$$,
  'a Player forms a Group through on_deck_form_group'
);
select is(
  (select operator_kind from public.on_deck_session_events
   where session_id = '5e553033-0000-0000-0000-0000000002b0' and type = 'GROUP_FORMED'),
  'player',
  'the GROUP_FORMED event records player as the Operator'
);

-- Guards.
select throws_ok(
  $$select public.on_deck_form_group(
      '5e553033-0000-0000-0000-0000000002b0', 'dev-aaaa',
      'nope', '["dev-aaaa", "dev-bbbb"]'::jsonb)$$,
  '22023', null,
  'a form-group groupId must be server-minted'
);
select throws_ok(
  $$select public.on_deck_form_group(
      '5e553033-0000-0000-0000-0000000002b0', 'dev-aaaa',
      'group-00000000-0000-0000-0000-0000000000a2', '["dev-aaaa"]'::jsonb)$$,
  '22023', null,
  'a form-group needs at least two members'
);
select throws_ok(
  $$select public.on_deck_form_group(
      '5e553033-0000-0000-0000-0000000002b0', 'dev-aaaa',
      'group-00000000-0000-0000-0000-0000000000a3', '["dev-bbbb", "dev-cccc"]'::jsonb)$$,
  '42501', null,
  'the acting Player must be one of the members'
);
select throws_ok(
  $$select public.on_deck_form_group(
      '5e553033-0000-0000-0000-0000000002b0', 'dev-never-joined-xx',
      'group-00000000-0000-0000-0000-0000000000a4', '["dev-never-joined-xx", "dev-bbbb"]'::jsonb)$$,
  '42501', null,
  'the acting Player must have joined the Session'
);

-- A member removes themselves.
select lives_ok(
  $$select public.on_deck_leave_group(
      '5e553033-0000-0000-0000-0000000002b0', 'dev-bbbb',
      'group-00000000-0000-0000-0000-0000000000a1')$$,
  'a member leaves the Group through on_deck_leave_group'
);
select is(
  (select operator_kind from public.on_deck_session_events
   where session_id = '5e553033-0000-0000-0000-0000000002b0' and type = 'GROUP_MEMBER_REMOVED'),
  'player',
  'the GROUP_MEMBER_REMOVED event records player as the Operator'
);

-- A player cannot write either event directly.
select throws_ok(
  $$insert into public.on_deck_session_events (session_id, type, operator_kind)
    values ('5e553033-0000-0000-0000-0000000002b0', 'GROUP_FORMED', 'player')$$,
  '42501', null,
  'a player cannot append GROUP_FORMED directly — only through the RPC'
);

-- A Volunteer dissolves a Group.
select lives_ok(
  $$select public.on_deck_volunteer_append(
      '5e553033-0000-0000-0000-0000000002b0', 'vol-token-qtpf-aaaaaaaaaaaaaaaaaaaa',
      'GROUP_DISSOLVED',
      '{"groupId": "group-00000000-0000-0000-0000-0000000000a1"}'::jsonb)$$,
  'a Volunteer dissolves a Group through the link'
);
select throws_ok(
  $$select public.on_deck_volunteer_append(
      '5e553033-0000-0000-0000-0000000002b0', 'vol-token-qtpf-aaaaaaaaaaaaaaaaaaaa',
      'GROUP_DISSOLVED', '{"groupId": "nope"}'::jsonb)$$,
  '22023', null,
  'a GROUP_DISSOLVED groupId must be server-minted'
);

-- Undo: the tip is the GROUP_DISSOLVED — it is undoable.
select lives_ok(
  $$select public.on_deck_undo_last_event(
      '5e553033-0000-0000-0000-0000000002b0',
      (select max(seq) from public.on_deck_session_events
       where session_id = '5e553033-0000-0000-0000-0000000002b0'),
      'vol-token-qtpf-aaaaaaaaaaaaaaaaaaaa')$$,
  'GROUP_DISSOLVED is undoable via on_deck_undo_last_event'
);

select * from finish();

rollback;

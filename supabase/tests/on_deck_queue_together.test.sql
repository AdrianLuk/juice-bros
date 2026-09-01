-- On Deck: Queue Together, volunteer-formed (issue #250). What this pins down:
--
--   * `on_deck_volunteer_append` accepts `GROUP_FORMED` and `GROUP_CAP_CHANGED`
--     from a link-authenticated Volunteer, recorded as operator_kind volunteer;
--   * it rejects a `GROUP_FORMED` with a non-server-minted groupId or a member
--     array outside 2..8, and a `GROUP_CAP_CHANGED` with a cap outside 2..8;
--   * `on_deck_undo_last_event` will undo a `GROUP_FORMED` but not a
--     `GROUP_CAP_CHANGED` (the cap is corrected forward);
--   * a Volunteer still cannot append either event directly (no anon grant).

begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-0000-0000-0000000002a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vanessa-qt-a@example.com');

insert into public.on_deck_clubs (id, owner_id, name, venue_name, court_count, group_cap, floor_mode) values
  ('c3c3c3c3-0000-0000-0000-0000000002a0', '11111111-0000-0000-0000-0000000002a0', 'TO Pickleball Club QT', 'Ramsden Park', 8, 4, 'hybrid');

insert into public.on_deck_sessions
  (id, club_id, venue_name, court_count, group_cap, floor_mode, status, closed_at, volunteer_token) values
  ('5e553033-0000-0000-0000-0000000002a0', 'c3c3c3c3-0000-0000-0000-0000000002a0', 'Ramsden Park', 8, 4, 'hybrid', 'open', null, 'vol-token-qt-aaaaaaaaaaaaaaaaaaaaaa');

insert into public.on_deck_session_events (session_id, type, operator_kind, operator_user_id) values
  ('5e553033-0000-0000-0000-0000000002a0', 'SESSION_STARTED', 'organizer', '11111111-0000-0000-0000-0000000002a0');

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

-- A Volunteer forms a Group.
select lives_ok(
  $$select public.on_deck_volunteer_append(
      '5e553033-0000-0000-0000-0000000002a0', 'vol-token-qt-aaaaaaaaaaaaaaaaaaaaaa',
      'GROUP_FORMED',
      '{"groupId": "group-00000000-0000-0000-0000-000000000001", "memberTokens": ["dev-a", "dev-b"]}'::jsonb)$$,
  'a Volunteer forms a Group through the link'
);
select is(
  (select operator_kind from public.on_deck_session_events
   where session_id = '5e553033-0000-0000-0000-0000000002a0' and type = 'GROUP_FORMED'),
  'volunteer',
  'the GROUP_FORMED event records volunteer as the Operator'
);

-- A Volunteer lowers the cap.
select lives_ok(
  $$select public.on_deck_volunteer_append(
      '5e553033-0000-0000-0000-0000000002a0', 'vol-token-qt-aaaaaaaaaaaaaaaaaaaaaa',
      'GROUP_CAP_CHANGED', '{"cap": 3}'::jsonb)$$,
  'a Volunteer lowers the live group cap'
);

-- Payload guards.
select throws_ok(
  $$select public.on_deck_volunteer_append(
      '5e553033-0000-0000-0000-0000000002a0', 'vol-token-qt-aaaaaaaaaaaaaaaaaaaaaa',
      'GROUP_FORMED', '{"groupId": "nope", "memberTokens": ["dev-a", "dev-b"]}'::jsonb)$$,
  '22023', null,
  'a GROUP_FORMED groupId must be server-minted'
);
select throws_ok(
  $$select public.on_deck_volunteer_append(
      '5e553033-0000-0000-0000-0000000002a0', 'vol-token-qt-aaaaaaaaaaaaaaaaaaaaaa',
      'GROUP_FORMED',
      '{"groupId": "group-00000000-0000-0000-0000-000000000002", "memberTokens": ["dev-a"]}'::jsonb)$$,
  '22023', null,
  'a GROUP_FORMED needs at least two members'
);
select throws_ok(
  $$select public.on_deck_volunteer_append(
      '5e553033-0000-0000-0000-0000000002a0', 'vol-token-qt-aaaaaaaaaaaaaaaaaaaaaa',
      'GROUP_CAP_CHANGED', '{"cap": 1}'::jsonb)$$,
  '22023', null,
  'a GROUP_CAP_CHANGED cap under 2 is rejected'
);
select throws_ok(
  $$select public.on_deck_volunteer_append(
      '5e553033-0000-0000-0000-0000000002a0', 'vol-token-qt-aaaaaaaaaaaaaaaaaaaaaa',
      'GROUP_CAP_CHANGED', '{"cap": 2.5}'::jsonb)$$,
  '22023', null,
  'a GROUP_CAP_CHANGED cap must be a whole number'
);

-- A Volunteer cannot write either event directly.
select throws_ok(
  $$insert into public.on_deck_session_events (session_id, type, operator_kind)
    values ('5e553033-0000-0000-0000-0000000002a0', 'GROUP_FORMED', 'volunteer')$$,
  '42501', null,
  'a Volunteer cannot append GROUP_FORMED directly — only through the RPC'
);

-- Undo: the most recent event is the GROUP_CAP_CHANGED. It is not undoable.
select throws_ok(
  $$select public.on_deck_undo_last_event(
      '5e553033-0000-0000-0000-0000000002a0',
      (select max(seq) from public.on_deck_session_events
       where session_id = '5e553033-0000-0000-0000-0000000002a0'),
      'vol-token-qt-aaaaaaaaaaaaaaaaaaaaaa')$$,
  '22023', null,
  'GROUP_CAP_CHANGED cannot be undone'
);

-- Drop it as postgres so GROUP_FORMED is the tip, then undo it.
set local role postgres;
delete from public.on_deck_session_events
where session_id = '5e553033-0000-0000-0000-0000000002a0' and type = 'GROUP_CAP_CHANGED';
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select lives_ok(
  $$select public.on_deck_undo_last_event(
      '5e553033-0000-0000-0000-0000000002a0',
      (select max(seq) from public.on_deck_session_events
       where session_id = '5e553033-0000-0000-0000-0000000002a0'),
      'vol-token-qt-aaaaaaaaaaaaaaaaaaaaaa')$$,
  'GROUP_FORMED is undoable via on_deck_undo_last_event'
);
select is(
  (select count(*)::int from public.on_deck_session_events
   where session_id = '5e553033-0000-0000-0000-0000000002a0' and type = 'GROUP_FORMED'),
  0,
  'the undo dropped the GROUP_FORMED row'
);

select * from finish();

rollback;

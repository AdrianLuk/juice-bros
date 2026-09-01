-- On Deck: walk-up Players and Skill Level override (issue #249). What this
-- pins down, on top of on_deck_volunteer_link.test.sql:
--
--   * on_deck_volunteer_append accepts PLAYER_JOINED (a walk-up) and
--     PLAYER_SKILL_SET (an override), recorded as operator_kind 'volunteer';
--   * a volunteer PLAYER_JOINED must carry a server-minted `walkup-<uuid>` id,
--     a name, a valid Skill Level, and queueOnJoin=true;
--   * PLAYER_SKILL_SET must carry a valid Skill Level;
--   * the Organizer's own INSERT path already takes both types (the foundation
--     append policy does not constrain the event type).

begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, instance_id, aud, role, email) values
  ('22222222-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vanessa-249-a@example.com');

insert into public.on_deck_clubs (id, owner_id, name, venue_name, court_count, group_cap, floor_mode) values
  ('c9c9c9c9-0000-0000-0000-00000000000a', '22222222-0000-0000-0000-00000000000a', 'TO Pickleball Club 249', 'Ramsden Park', 8, 4, 'hybrid');

insert into public.on_deck_sessions
  (id, club_id, venue_name, court_count, group_cap, floor_mode, status, closed_at, volunteer_token) values
  ('5e559249-0000-0000-0000-00000000000a', 'c9c9c9c9-0000-0000-0000-00000000000a', 'Ramsden Park', 8, 4, 'hybrid', 'open', null, 'vol-token-249aaaaaaaaaaaaaaaaaaaaa');

insert into public.on_deck_session_events (session_id, type, operator_kind, operator_user_id) values
  ('5e559249-0000-0000-0000-00000000000a', 'SESSION_STARTED', 'organizer', '22222222-0000-0000-0000-00000000000a');

-- ---- as an anonymous Volunteer -------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

-- A volunteer adds a walk-up.
select lives_ok(
  $$select public.on_deck_volunteer_append(
      '5e559249-0000-0000-0000-00000000000a', 'vol-token-249aaaaaaaaaaaaaaaaaaaaa',
      'PLAYER_JOINED',
      '{"token": "walkup-00000000-0000-0000-0000-000000000001", "firstName": "Wanda", "lastInitial": "W", "skillLevel": "beginner", "queueOnJoin": true}'::jsonb)$$,
  'a volunteer adds a walk-up Player'
);
select is(
  (select operator_kind from public.on_deck_session_events
   where session_id = '5e559249-0000-0000-0000-00000000000a' and type = 'PLAYER_JOINED'),
  'volunteer',
  'the walk-up is recorded as a volunteer action'
);

-- A volunteer overrides a Skill Level.
select lives_ok(
  $$select public.on_deck_volunteer_append(
      '5e559249-0000-0000-0000-00000000000a', 'vol-token-249aaaaaaaaaaaaaaaaaaaaa',
      'PLAYER_SKILL_SET',
      '{"token": "walkup-00000000-0000-0000-0000-000000000001", "skillLevel": "advanced"}'::jsonb)$$,
  'a volunteer overrides a Player''s Skill Level'
);
select is(
  (select operator_kind from public.on_deck_session_events
   where session_id = '5e559249-0000-0000-0000-00000000000a' and type = 'PLAYER_SKILL_SET'),
  'volunteer',
  'the override is recorded as a volunteer action'
);

-- The guards. Each uses a valid walkup id so the failing check is the one named.
select throws_ok(
  $$select public.on_deck_volunteer_append(
      '5e559249-0000-0000-0000-00000000000a', 'vol-token-249aaaaaaaaaaaaaaaaaaaaa',
      'PLAYER_JOINED',
      '{"token": "walkup-00000000-0000-0000-0000-000000000002", "firstName": "Wanda", "lastInitial": "W", "skillLevel": "beginner"}'::jsonb)$$,
  '22023', null,
  'a volunteer PLAYER_JOINED without queueOnJoin is rejected'
);
select throws_ok(
  $$select public.on_deck_volunteer_append(
      '5e559249-0000-0000-0000-00000000000a', 'vol-token-249aaaaaaaaaaaaaaaaaaaaa',
      'PLAYER_JOINED',
      '{"token": "hand-crafted-token", "firstName": "Wanda", "lastInitial": "W", "skillLevel": "beginner", "queueOnJoin": true}'::jsonb)$$,
  '22023', null,
  'a volunteer cannot pass a non-minted walk-up id'
);
select throws_ok(
  $$select public.on_deck_volunteer_append(
      '5e559249-0000-0000-0000-00000000000a', 'vol-token-249aaaaaaaaaaaaaaaaaaaaa',
      'PLAYER_JOINED',
      '{"token": "walkup-00000000-0000-0000-0000-000000000002", "firstName": "", "lastInitial": "W", "skillLevel": "beginner", "queueOnJoin": true}'::jsonb)$$,
  '22023', null,
  'a volunteer walk-up needs a first name'
);
select throws_ok(
  $$select public.on_deck_volunteer_append(
      '5e559249-0000-0000-0000-00000000000a', 'vol-token-249aaaaaaaaaaaaaaaaaaaaa',
      'PLAYER_JOINED',
      '{"token": "walkup-00000000-0000-0000-0000-000000000002", "firstName": "Wanda", "lastInitial": "W", "skillLevel": "pro", "queueOnJoin": true}'::jsonb)$$,
  '22023', null,
  'a volunteer walk-up needs a known Skill Level'
);
select throws_ok(
  $$select public.on_deck_volunteer_append(
      '5e559249-0000-0000-0000-00000000000a', 'vol-token-249aaaaaaaaaaaaaaaaaaaaa',
      'PLAYER_SKILL_SET',
      '{"token": "walkup-00000000-0000-0000-0000-000000000001", "skillLevel": "pro"}'::jsonb)$$,
  '22023', null,
  'a skill override needs a known Skill Level'
);

-- ---- as the owning Organizer -------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$insert into public.on_deck_session_events
      (session_id, type, operator_kind, operator_user_id, payload)
    values (
      '5e559249-0000-0000-0000-00000000000a', 'PLAYER_SKILL_SET', 'organizer',
      '22222222-0000-0000-0000-00000000000a',
      '{"token": "walkup-00000000-0000-0000-0000-000000000001", "skillLevel": "intermediate"}'::jsonb)$$,
  'the Organizer appends a PLAYER_SKILL_SET on their own open Session'
);

select * from finish();

rollback;

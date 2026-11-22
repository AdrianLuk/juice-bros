-- Dink Dine & Drink: courts and Court turns (issue #717). What this pins down:
--
--   * an Organizer saves a change to a Matchup's courts, and the links show it;
--   * moves must be an object (Game to court index);
--   * anon and a signed-in outsider can't write one.

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, instance_id, aud, role, email) values
  ('71771771-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ddd-ct-organizer@example.com'),
  ('71771771-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ddd-ct-outsider@example.com');
insert into public.ddd_organizers (user_id) values ('71771771-0000-0000-0000-00000000000a');

insert into public.ddd_events (id, name, event_date, play_venue, dine_venue, score_token, public_token) values
  ('71771771-1111-0000-0000-000000000001', 'Courts DDD', '2026-11-28', 'Rec Hall', 'Noodle Bar',
   'score717score717score717score717', 'public717public717public717public');
insert into public.ddd_teams (id, event_id, name, position) values
  ('71771771-2222-0000-0000-000000000001', '71771771-1111-0000-0000-000000000001', 'Ann', 1),
  ('71771771-2222-0000-0000-000000000004', '71771771-1111-0000-0000-000000000001', 'Di', 4);

-- ---- anon ------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok(
  $$insert into public.ddd_court_plans (team_a, team_b, swapped) values
    ('71771771-2222-0000-0000-000000000001', '71771771-2222-0000-0000-000000000004', true)$$,
  '42501', null, 'anon can''t change a Matchup''s courts'
);

-- ---- an outsider -----------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "71771771-0000-0000-0000-00000000000c", "role": "authenticated"}';
select throws_ok(
  $$insert into public.ddd_court_plans (team_a, team_b, swapped) values
    ('71771771-2222-0000-0000-000000000001', '71771771-2222-0000-0000-000000000004', true)$$,
  '42501', null, 'nor can a signed-in outsider'
);

-- ---- an Organizer ----------------------------------------------------------
set local request.jwt.claims = '{"sub": "71771771-0000-0000-0000-00000000000a", "role": "authenticated"}';
select throws_ok(
  $$insert into public.ddd_court_plans (team_a, team_b, moves) values
    ('71771771-2222-0000-0000-000000000001', '71771771-2222-0000-0000-000000000004', '[2]')$$,
  '23514', null, 'moves are Game to court, not a list'
);
select lives_ok(
  $$insert into public.ddd_court_plans (team_a, team_b, swapped, moves) values
    ('71771771-2222-0000-0000-000000000001', '71771771-2222-0000-0000-000000000004', true, '{"womens": 3}')$$,
  'an Organizer swaps the Court turns and moves a Game'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(
  (select (p ->> 'swapped') || ' ' || (p -> 'moves' ->> 'womens')
   from jsonb_array_elements(public.ddd_link_event('public717public717public717public') -> 'courtPlans') p),
  'true 3',
  'the Public Link shows the change'
);
select is(
  jsonb_array_length(public.ddd_link_event('score717score717score717score717') -> 'courtPlans'),
  1,
  'and so does the Score Link'
);

select * from finish();
rollback;

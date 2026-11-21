-- Dink Dine & Drink: Round 1 (issue #715). What this pins down:
--
--   * a Score Link holder (anon) enters a final with the token, and it is
--     recorded as the Score Link's; another DDD's token is refused;
--   * only 21 to 0..20 is a final;
--   * one pair is one row whichever way round it is entered, and a second
--     entry corrects it;
--   * an Organizer corrects and clears a final and is recorded as the editor;
--     the Score Link can't clear, and an outsider can't write at all;
--   * an Organizer sets a Rotation; the link shows it, the finals and the
--     tie order.

begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, instance_id, aud, role, email) values
  ('71571571-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ddd-db-organizer@example.com'),
  ('71571571-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ddd-db-outsider@example.com');
insert into public.ddd_organizers (user_id) values ('71571571-0000-0000-0000-00000000000a');

insert into public.ddd_events (id, name, event_date, play_venue, dine_venue, score_token, public_token) values
  ('71571571-1111-0000-0000-000000000001', 'Round 1 DDD', '2026-11-28', 'Rec Hall', 'Noodle Bar',
   'score715score715score715score715', 'public715public715public715public'),
  ('71571571-1111-0000-0000-000000000002', 'Other DDD', '2026-11-28', 'Rec Hall', 'Noodle Bar',
   'other715other715other715other715', 'otherpub715otherpub715otherpub71');
insert into public.ddd_teams (id, event_id, name, position) values
  ('71571571-2222-0000-0000-000000000001', '71571571-1111-0000-0000-000000000001', 'Ann', 1),
  ('71571571-2222-0000-0000-000000000002', '71571571-1111-0000-0000-000000000001', 'Bo', 2),
  ('71571571-2222-0000-0000-000000000003', '71571571-1111-0000-0000-000000000001', 'Cy', 3),
  ('71571571-2222-0000-0000-000000000004', '71571571-1111-0000-0000-000000000001', 'Di', 4);
insert into public.ddd_players (id, team_id, position, name, gender, dupr) values
  ('71571571-3333-0000-0000-000000000001', '71571571-2222-0000-0000-000000000001', 1, 'Ann', 'F', 4.0),
  ('71571571-3333-0000-0000-000000000002', '71571571-2222-0000-0000-000000000001', 2, 'Al', 'M', 4.5);

-- ---- the Score Link ----------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select lives_ok(
  $$select public.ddd_save_dreambreaker('score715score715score715score715',
    '71571571-2222-0000-0000-000000000002', '71571571-2222-0000-0000-000000000001', 21, 15)$$,
  'the Score Link enters a final, the pair given either way round'
);
select throws_ok(
  $$select public.ddd_save_dreambreaker('other715other715other715other715',
    '71571571-2222-0000-0000-000000000001', '71571571-2222-0000-0000-000000000002', 21, 3)$$,
  '42501', null, 'another DDD''s Score Link is refused'
);
select throws_ok(
  $$select public.ddd_save_dreambreaker('score715score715score715score715',
    '71571571-2222-0000-0000-000000000001', '71571571-2222-0000-0000-000000000003', 22, 20)$$,
  '22023', null, '22-20 is not a final'
);
select throws_ok(
  $$select public.ddd_save_dreambreaker('score715score715score715score715',
    '71571571-2222-0000-0000-000000000001', '71571571-2222-0000-0000-000000000003', 21, 21)$$,
  '22023', null, 'nor is 21-21'
);
select lives_ok(
  $$select public.ddd_save_dreambreaker('score715score715score715score715',
    '71571571-2222-0000-0000-000000000001', '71571571-2222-0000-0000-000000000002', 20, 21)$$,
  'the Score Link corrects a final'
);
select throws_ok(
  $$select public.ddd_save_dreambreaker('score715score715score715score715',
    '71571571-2222-0000-0000-000000000001', '71571571-2222-0000-0000-000000000002', null, null)$$,
  '42501', null, 'but can''t clear one'
);
select is(
  (select d ->> 'scoreA' || '-' || (d ->> 'scoreB') || ' ' || (d ->> 'editedBy')
   from jsonb_array_elements(public.ddd_link_event('public715public715public715public') -> 'dreambreakers') d),
  '20-21 score_link',
  'one row for the pair, in roster order, edited by the Score Link'
);
select throws_ok(
  $$select public.ddd_save_dreambreaker(null,
    '71571571-2222-0000-0000-000000000001', '71571571-2222-0000-0000-000000000002', 21, 0)$$,
  '42501', null, 'without the token, anon can''t write'
);

-- ---- an outsider -------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "71571571-0000-0000-0000-00000000000c", "role": "authenticated"}';
select throws_ok(
  $$select public.ddd_save_dreambreaker(null,
    '71571571-2222-0000-0000-000000000001', '71571571-2222-0000-0000-000000000002', 21, 0)$$,
  '42501', null, 'nor can an outsider'
);

-- ---- an Organizer ------------------------------------------------------------
set local request.jwt.claims = '{"sub": "71571571-0000-0000-0000-00000000000a", "role": "authenticated"}';
select lives_ok(
  $$select public.ddd_save_dreambreaker(null,
    '71571571-2222-0000-0000-000000000003', '71571571-2222-0000-0000-000000000004', 21, 9)$$,
  'an Organizer enters a final'
);
select is(
  (select last_edited_by_kind || ' ' || last_edited_by::text from public.ddd_dreambreakers
   where team_a_id = '71571571-2222-0000-0000-000000000003'),
  'organizer 71571571-0000-0000-0000-00000000000a',
  'recorded as that Organizer'
);
select lives_ok(
  $$select public.ddd_save_dreambreaker(null,
    '71571571-2222-0000-0000-000000000004', '71571571-2222-0000-0000-000000000003', null, null)$$,
  'and clears it'
);
select lives_ok(
  $$select public.ddd_set_rotation('71571571-2222-0000-0000-000000000001',
    array['71571571-3333-0000-0000-000000000001'::uuid, '71571571-3333-0000-0000-000000000002'::uuid])$$,
  'an Organizer sets a Rotation'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(
  (select jsonb_agg(p ->> 'rotation' order by p ->> 'name')
   from jsonb_array_elements(public.ddd_link_event('public715public715public715public') -> 'teams' -> 0 -> 'players') p)::text
  || ' ' || jsonb_array_length(public.ddd_link_event('public715public715public715public') -> 'dreambreakers'),
  '["2", "1"] 1',
  'the link shows the Rotation and the one final left'
);

select * from finish();
rollback;

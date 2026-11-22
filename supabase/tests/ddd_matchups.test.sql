-- Dink Dine & Drink: Round 2 and the Playoff (issue #716). What this pins down:
--
--   * a Score Link holder (anon) enters a Game final with the token, stored
--     once per pairing and Game in roster order whichever way round it came;
--   * only side-out to 11, win by 2 is a final, and a Game with no Spread
--     can't be scored;
--   * the Score Link can't clear a final, and another DDD's token, anon
--     without one and an outsider can't write at all;
--   * an Organizer's call on a 2-2 needs a reason, shows on the link, and
--     stands through a corrected final; anon can't make one.

begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (id, instance_id, aud, role, email) values
  ('71671671-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ddd-mu-organizer@example.com'),
  ('71671671-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ddd-mu-outsider@example.com');
insert into public.ddd_organizers (user_id) values ('71671671-0000-0000-0000-00000000000a');

insert into public.ddd_events (id, name, event_date, play_venue, dine_venue, score_token, public_token) values
  ('71671671-1111-0000-0000-000000000001', 'Matchups DDD', '2026-11-28', 'Rec Hall', 'Noodle Bar',
   'score716score716score716score716', 'public716public716public716public'),
  ('71671671-1111-0000-0000-000000000002', 'Other DDD', '2026-11-28', 'Rec Hall', 'Noodle Bar',
   'other716other716other716other716', 'otherpub716otherpub716otherpub71');
insert into public.ddd_teams (id, event_id, name, position) values
  ('71671671-2222-0000-0000-000000000001', '71671671-1111-0000-0000-000000000001', 'Ann', 1),
  ('71671671-2222-0000-0000-000000000002', '71671671-1111-0000-0000-000000000001', 'Bo', 2),
  ('71671671-2222-0000-0000-000000000003', '71671671-1111-0000-0000-000000000001', 'Cy', 3),
  ('71671671-2222-0000-0000-000000000004', '71671671-1111-0000-0000-000000000001', 'Di', 4);
insert into public.ddd_spreads (team_a, team_b, game, lower, points, sig) values
  ('71671671-2222-0000-0000-000000000001', '71671671-2222-0000-0000-000000000002', 'mens', 'b', 5.5, '');

-- ---- the Score Link ----------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select lives_ok(
  $$select public.ddd_save_game('score716score716score716score716',
    '71671671-2222-0000-0000-000000000002', '71671671-2222-0000-0000-000000000001', 'mens', 6, 11)$$,
  'the Score Link enters a final, the pair given either way round'
);
select throws_ok(
  $$select public.ddd_save_game('score716score716score716score716',
    '71671671-2222-0000-0000-000000000001', '71671671-2222-0000-0000-000000000002', 'womens', 11, 4)$$,
  '55000', null, 'a Game with no Spread can''t be scored'
);
select throws_ok(
  $$select public.ddd_save_game('score716score716score716score716',
    '71671671-2222-0000-0000-000000000001', '71671671-2222-0000-0000-000000000002', 'mens', 11, 10)$$,
  '22023', null, '11-10 is not a final'
);
select throws_ok(
  $$select public.ddd_save_game('score716score716score716score716',
    '71671671-2222-0000-0000-000000000001', '71671671-2222-0000-0000-000000000002', 'mens', 14, 10)$$,
  '22023', null, 'nor is 14-10: the Game ended at 12-10'
);
select throws_ok(
  $$select public.ddd_save_game('other716other716other716other716',
    '71671671-2222-0000-0000-000000000001', '71671671-2222-0000-0000-000000000002', 'mens', 11, 3)$$,
  '42501', null, 'another DDD''s Score Link is refused'
);
select lives_ok(
  $$select public.ddd_save_game('score716score716score716score716',
    '71671671-2222-0000-0000-000000000001', '71671671-2222-0000-0000-000000000002', 'mens', 13, 11)$$,
  'the Score Link corrects it to 13-11'
);
select throws_ok(
  $$select public.ddd_save_game('score716score716score716score716',
    '71671671-2222-0000-0000-000000000001', '71671671-2222-0000-0000-000000000002', 'mens', null, null)$$,
  '42501', null, 'but can''t clear it'
);
select is(
  (select g ->> 'scoreA' || '-' || (g ->> 'scoreB') || ' ' || (g ->> 'editedBy')
   from jsonb_array_elements(public.ddd_link_event('public716public716public716public') -> 'games') g),
  '13-11 score_link',
  'one row for the pairing and Game, Ann''s points first, edited by the Score Link'
);
select throws_ok(
  $$select public.ddd_save_game(null,
    '71671671-2222-0000-0000-000000000001', '71671671-2222-0000-0000-000000000002', 'mens', 11, 0)$$,
  '42501', null, 'without the token, anon can''t write'
);
select throws_ok(
  $$insert into public.ddd_matchup_calls (team_a, team_b, winner, reason) values
    ('71671671-2222-0000-0000-000000000001', '71671671-2222-0000-0000-000000000002',
     '71671671-2222-0000-0000-000000000001', 'x')$$,
  '42501', null, 'nor make a call'
);

-- ---- an outsider -------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "71671671-0000-0000-0000-00000000000c", "role": "authenticated"}';
select throws_ok(
  $$select public.ddd_save_game(null,
    '71671671-2222-0000-0000-000000000001', '71671671-2222-0000-0000-000000000002', 'mens', 11, 0)$$,
  '42501', null, 'an outsider can''t write'
);

-- ---- an Organizer ------------------------------------------------------------
set local request.jwt.claims = '{"sub": "71671671-0000-0000-0000-00000000000a", "role": "authenticated"}';
select throws_ok(
  $$insert into public.ddd_matchup_calls (team_a, team_b, winner, reason) values
    ('71671671-2222-0000-0000-000000000001', '71671671-2222-0000-0000-000000000002',
     '71671671-2222-0000-0000-000000000002', '  ')$$,
  '23514', null, 'a call needs a reason'
);
select lives_ok(
  $$insert into public.ddd_matchup_calls (team_a, team_b, winner, reason) values
    ('71671671-2222-0000-0000-000000000001', '71671671-2222-0000-0000-000000000002',
     '71671671-2222-0000-0000-000000000002', 'Coin toss at the court')$$,
  'an Organizer makes the call, with a reason'
);
select is(
  (select c ->> 'reason'
   from jsonb_array_elements(public.ddd_link_event('public716public716public716public') -> 'calls') c),
  'Coin toss at the court',
  'the link shows the call''s reason'
);
select lives_ok(
  $$select public.ddd_save_game(null,
    '71671671-2222-0000-0000-000000000001', '71671671-2222-0000-0000-000000000002', 'mens', 11, 2)$$,
  'an Organizer corrects the final'
);
select is(
  (select count(*)::int from public.ddd_matchup_calls),
  1,
  'the call stands through a correction'
);

select * from finish();
rollback;

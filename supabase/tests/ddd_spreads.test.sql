-- Dink Dine & Drink: Spreads (issue #714). What this pins down:
--
--   * an outsider can't read or write a Spread;
--   * a Spread must end in .5 and run 0.5 to 10.5: the table refuses the rest;
--   * a Team can't be paired with itself, and the same Game of a pairing is one row;
--   * a link holder sees every saved Spread of the DDD.

begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

insert into auth.users (id, instance_id, aud, role, email) values
  ('71471471-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ddd-spread-organizer@example.com'),
  ('71471471-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ddd-spread-outsider@example.com');
insert into public.ddd_organizers (user_id) values ('71471471-0000-0000-0000-00000000000a');

insert into public.ddd_events (id, name, event_date, play_venue, dine_venue)
values ('71471471-1111-0000-0000-000000000001', 'Spread DDD', '2026-11-28', 'Rec Hall', 'Noodle Bar');
insert into public.ddd_teams (id, event_id, name, position) values
  ('71471471-2222-0000-0000-000000000001', '71471471-1111-0000-0000-000000000001', 'Ann', 1),
  ('71471471-2222-0000-0000-000000000002', '71471471-1111-0000-0000-000000000001', 'Bo', 2);
insert into public.ddd_spreads (team_a, team_b, game, lower, points, sig) values
  ('71471471-2222-0000-0000-000000000001', '71471471-2222-0000-0000-000000000002', 'mens', 'a', 5.5, 'x|y');

create temporary table ddd_spread_token (public_token text) on commit drop;
insert into ddd_spread_token select public_token from public.ddd_events;
grant all on ddd_spread_token to anon;

set local role authenticated;

-- ---- an outsider -------------------------------------------------------------
set local request.jwt.claims = '{"sub": "71471471-0000-0000-0000-00000000000c", "role": "authenticated"}';
select is((select count(*)::int from public.ddd_spreads), 0, 'an outsider reads no Spread');
select throws_ok(
  $$insert into public.ddd_spreads (team_a, team_b, game, lower, points, sig)
    values ('71471471-2222-0000-0000-000000000001', '71471471-2222-0000-0000-000000000002', 'womens', 'a', 3.5, 'x|y')$$,
  '42501',
  null,
  'an outsider can''t write one'
);

-- ---- an Organizer ------------------------------------------------------------
set local request.jwt.claims = '{"sub": "71471471-0000-0000-0000-00000000000a", "role": "authenticated"}';
select lives_ok(
  $$insert into public.ddd_spreads (team_a, team_b, game, lower, points, sig)
    values ('71471471-2222-0000-0000-000000000001', '71471471-2222-0000-0000-000000000002', 'womens', 'b', 10.5, 'x|y')$$,
  'an Organizer sets a Spread, 10.5 being the top of the range'
);
select throws_ok(
  $$insert into public.ddd_spreads (team_a, team_b, game, lower, points, sig)
    values ('71471471-2222-0000-0000-000000000001', '71471471-2222-0000-0000-000000000002', 'mixed1', 'a', 5, 'x|y')$$,
  '23514',
  null,
  'a Spread not ending in .5 is refused'
);
select throws_ok(
  $$insert into public.ddd_spreads (team_a, team_b, game, lower, points, sig)
    values ('71471471-2222-0000-0000-000000000001', '71471471-2222-0000-0000-000000000002', 'mixed1', 'a', 11.5, 'x|y')$$,
  '23514',
  null,
  'a Spread above 10.5 is refused'
);
select throws_ok(
  $$insert into public.ddd_spreads (team_a, team_b, game, lower, points, sig)
    values ('71471471-2222-0000-0000-000000000001', '71471471-2222-0000-0000-000000000001', 'mixed1', 'a', 5.5, 'x|y')$$,
  '23514',
  null,
  'a Team can''t be paired with itself'
);
select throws_ok(
  $$insert into public.ddd_spreads (team_a, team_b, game, lower, points, sig)
    values ('71471471-2222-0000-0000-000000000001', '71471471-2222-0000-0000-000000000002', 'mens', 'a', 4.5, 'x|y')$$,
  '23505',
  null,
  'a Game of a pairing holds one Spread'
);

-- ---- anon, holding a link ----------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(
  jsonb_array_length(public.ddd_link_event((select public_token from ddd_spread_token)) -> 'spreads'),
  2,
  'a link shows every saved Spread'
);

select * from finish();
rollback;

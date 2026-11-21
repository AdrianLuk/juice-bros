-- Dink Dine & Drink: Lineups (issue #713). What this pins down:
--
--   * an outsider can't read or write a Lineup;
--   * an Organizer saves a Pair holding the same player twice and an empty
--     slot: the rules are warnings in the app, never the database's;
--   * a removed player leaves an empty slot, not a deleted Pair;
--   * a link holder sees the saved Pairs, and null for a Team with none.

begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

insert into auth.users (id, instance_id, aud, role, email) values
  ('71371371-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ddd-lineup-organizer@example.com'),
  ('71371371-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ddd-lineup-outsider@example.com');
insert into public.ddd_organizers (user_id) values ('71371371-0000-0000-0000-00000000000a');

insert into public.ddd_events (id, name, event_date, play_venue, dine_venue)
values ('71371371-1111-0000-0000-000000000001', 'Lineup DDD', '2026-11-28', 'Rec Hall', 'Noodle Bar');
insert into public.ddd_teams (id, event_id, name, position) values
  ('71371371-2222-0000-0000-000000000001', '71371371-1111-0000-0000-000000000001', 'Ann', 1),
  ('71371371-2222-0000-0000-000000000002', '71371371-1111-0000-0000-000000000001', 'Bo', 2);
insert into public.ddd_players (id, team_id, position, name, gender) values
  ('71371371-3333-0000-0000-000000000001', '71371371-2222-0000-0000-000000000001', 1, 'Ann', 'M'),
  ('71371371-3333-0000-0000-000000000002', '71371371-2222-0000-0000-000000000001', 2, 'Ann partner', 'F');
insert into public.ddd_lineup_pairs (team_id, game, player_a, player_b) values
  ('71371371-2222-0000-0000-000000000001', 'mens', '71371371-3333-0000-0000-000000000001', '71371371-3333-0000-0000-000000000001');

create temporary table ddd_lineup_token (public_token text) on commit drop;
insert into ddd_lineup_token select public_token from public.ddd_events;
grant all on ddd_lineup_token to anon;

set local role authenticated;

-- ---- an outsider -------------------------------------------------------------
set local request.jwt.claims = '{"sub": "71371371-0000-0000-0000-00000000000c", "role": "authenticated"}';
select is((select count(*)::int from public.ddd_lineup_pairs), 0, 'an outsider reads no Lineup');
select throws_ok(
  $$insert into public.ddd_lineup_pairs (team_id, game) values ('71371371-2222-0000-0000-000000000001', 'womens')$$,
  '42501',
  null,
  'an outsider can''t write one'
);

-- ---- an Organizer ------------------------------------------------------------
set local request.jwt.claims = '{"sub": "71371371-0000-0000-0000-00000000000a", "role": "authenticated"}';
select lives_ok(
  $$insert into public.ddd_lineup_pairs (team_id, game, player_a, player_b)
    values ('71371371-2222-0000-0000-000000000001', 'womens', '71371371-3333-0000-0000-000000000002', null)$$,
  'a half-empty Pair saves, and so did the same player twice'
);
select lives_ok(
  $$delete from public.ddd_players where id = '71371371-3333-0000-0000-000000000002'$$,
  'removing a player from the roster is allowed'
);
select is(
  (select player_a is null from public.ddd_lineup_pairs where game = 'womens'),
  true,
  'and leaves an empty slot in the Pair'
);

-- ---- anon, holding a link ----------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(
  (public.ddd_link_event((select public_token from ddd_lineup_token)) -> 'teams' -> 0 -> 'lineup' -> 'mens' ->> 1)
    || ' ' || coalesce((public.ddd_link_event((select public_token from ddd_lineup_token)) -> 'teams' -> 1 -> 'lineup')::text, 'null'),
  '71371371-3333-0000-0000-000000000001 null',
  'a link shows the saved Pairs, and null for a Team with none'
);

select * from finish();
rollback;

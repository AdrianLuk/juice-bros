-- Team Tally: a Team Event and who can reach it (issue #622). What this pins
-- down:
--
--   * a Team Event is plain rows (ADR 0001): Team Event, Team, Player slot,
--     Matchup, Game;
--   * a signed-in Organizer creates, edits and lists their own Team Events
--     through `team_tally_save_event`, and an edit keeps each Team's row, so a
--     Score Link already printed in a Brief keeps working;
--   * another User can't read, change, delete or add to them, directly or
--     through the save function;
--   * `anon` has no table access at all;
--   * `team_tally_public_event` reads a Team Event by its Public Link token,
--     never hands out a Score Link token, and refuses a wrong token;
--   * the save function refuses an odd number of Teams and a Team in two
--     Matchups, as a backstop to the form's own validation.
--
-- Names are PPA Tour pros: this repo is public.

begin;

create extension if not exists pgtap with schema extensions;

select plan(42);

select has_table('public', 'team_tally_events', 'Team Events are a table');
select has_table('public', 'team_tally_teams', 'Teams are a table');
select has_table('public', 'team_tally_player_slots', 'Player slots are a table');
select has_table('public', 'team_tally_matchups', 'Matchups are a table');
select has_table('public', 'team_tally_games', 'Games are a table');
select has_function(
  'public', 'team_tally_save_event', array['uuid', 'text', 'date', 'jsonb', 'jsonb'],
  'team_tally_save_event(uuid, text, date, jsonb, jsonb) exists'
);
select has_function(
  'public', 'team_tally_public_event', array['text'],
  'team_tally_public_event(text) exists'
);

insert into auth.users (id, instance_id, aud, role, email) values
  ('22222222-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tt-organizer-a@example.com'),
  ('22222222-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tt-organizer-b@example.com');

-- The four-Team night every test below builds on.
create temporary table tt_setup (teams jsonb, matchups jsonb) on commit drop;
insert into tt_setup values (
  '[
    {"nickname": "Golden Set", "homeCourt": "16", "captain": "Ben Johns", "slotA": "Anna Leigh Waters", "slotB": "Collin Johns", "slotC": "Anna Bright"},
    {"nickname": "", "homeCourt": "19", "captain": "Federico Staksrud", "slotA": "Catherine Parenteau", "slotB": "Andrei Daescu", "slotC": "Jorja Johnson"},
    {"nickname": "Kitchen Kings", "homeCourt": "17", "captain": "Hayden Patriquin", "slotA": "Tyra Black", "slotB": "Gabriel Tardio", "slotC": "Lea Jansen"},
    {"nickname": null, "homeCourt": "18", "captain": "Christian Alshon", "slotA": "Jessie Irvine", "slotB": "JW Johnson", "slotC": "Kaitlyn Christian"}
  ]'::jsonb,
  '[{"red": 0, "blue": 1}, {"red": 2, "blue": 3}]'::jsonb
);
grant select on tt_setup to authenticated, anon;

-- Somewhere to keep ids across role switches.
create temporary table tt_ids (key text primary key, value text) on commit drop;
grant select, insert, update on tt_ids to authenticated, anon;

-- ---- as Organizer A ----------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-0000-0000-0000-00000000000a", "role": "authenticated"}';

insert into tt_ids
select 'event', public.team_tally_save_event(null, 'Tuesday Team Night', date '2026-10-13', teams, matchups)::text
from tt_setup;

select is(
  (select count(*)::int from public.team_tally_events),
  1,
  'the Organizer lists the Team Event they built'
);
select is(
  (select owner_id from public.team_tally_events),
  '22222222-0000-0000-0000-00000000000a'::uuid,
  'it is owned by the Organizer who built it'
);
select is(
  (select status from public.team_tally_events),
  'opening',
  'a new Team Event starts in its opening round'
);
select is((select count(*)::int from public.team_tally_teams), 4, 'it has four Teams');
select is((select count(*)::int from public.team_tally_player_slots), 16, 'each Team has a captain and slots A, B and C');
select is(
  (select count(*)::int from public.team_tally_matchups where stage = 'opening'),
  2,
  'it has two opening Matchups'
);
select is((select count(*)::int from public.team_tally_games), 12, 'each Matchup has six Games, waiting for scores');
select is(
  (select count(*)::int from public.team_tally_games where red_score is null and blue_score is null),
  12,
  'no Game has a score yet'
);
select is(
  (select court_one || ' & ' || court_two from public.team_tally_matchups where number = 1),
  '16 & 19',
  'a Matchup''s court pair is its two Teams'' home courts'
);
select is(
  (select nickname from public.team_tally_teams where home_court = '19'),
  null,
  'a blank nickname is stored as no nickname'
);
select is(
  (select count(distinct score_token)::int from public.team_tally_teams where char_length(score_token) >= 24),
  4,
  'every Team gets its own Score Link token'
);

insert into tt_ids select 'public_token', public_token from public.team_tally_events;
insert into tt_ids select 'score_token_16', score_token from public.team_tally_teams where home_court = '16';
insert into tt_ids select 'team_16', id::text from public.team_tally_teams where home_court = '16';

-- An edit: rename the night, change a captain, add a nickname. Each Team is
-- sent back with its id, as the edit form does.
select lives_ok(
  $$select public.team_tally_save_event(
      (select value::uuid from tt_ids where key = 'event'),
      'Tuesday Team Night, week 2',
      date '2026-10-20',
      (select jsonb_agg(
         case when t.home_court = '19'
           then jsonb_build_object('id', t.id, 'nickname', 'Third Shot Drop', 'homeCourt', '19', 'captain', 'Andrei Daescu', 'slotA', 'Catherine Parenteau', 'slotB', 'Federico Staksrud', 'slotC', 'Jorja Johnson')
           else jsonb_build_object('id', t.id, 'nickname', coalesce(t.nickname, ''), 'homeCourt', t.home_court,
             'captain', (select name from public.team_tally_player_slots where team_id = t.id and position = 'captain'),
             'slotA', (select name from public.team_tally_player_slots where team_id = t.id and position = 'A'),
             'slotB', (select name from public.team_tally_player_slots where team_id = t.id and position = 'B'),
             'slotC', (select name from public.team_tally_player_slots where team_id = t.id and position = 'C'))
         end order by t.position)
       from public.team_tally_teams t),
      (select matchups from tt_setup))$$,
  'the Organizer edits their Team Event'
);
select is(
  (select name || ' ' || event_date from public.team_tally_events),
  'Tuesday Team Night, week 2 2026-10-20',
  'the edit renames and re-dates the night'
);
select is(
  (select s.name from public.team_tally_player_slots s
   join public.team_tally_teams t on t.id = s.team_id
   where t.home_court = '19' and s.position = 'captain'),
  'Andrei Daescu',
  'the edit changes a captain'
);
select is(
  (select score_token from public.team_tally_teams where home_court = '16'),
  (select value from tt_ids where key = 'score_token_16'),
  'an edit keeps each Team''s Score Link token'
);
select is(
  (select count(*)::int from public.team_tally_teams),
  4,
  'an edit does not duplicate Teams'
);
select is((select count(*)::int from public.team_tally_games), 12, 'an edit keeps the six Games per Matchup');

select throws_ok(
  $$select public.team_tally_save_event(null, 'Odd night', date '2026-10-13',
      (select teams || '[{"nickname": "", "homeCourt": "20", "captain": "Riley Newman", "slotA": "Parris Todd", "slotB": "Tyson McGuffin", "slotC": "Callie Smith"}]'::jsonb from tt_setup),
      (select matchups from tt_setup))$$,
  '22023',
  null,
  'an odd number of Teams is refused'
);
select throws_ok(
  $$select public.team_tally_save_event(null, 'Overbooked night', date '2026-10-13',
      (select teams from tt_setup),
      '[{"red": 0, "blue": 1}, {"red": 1, "blue": 3}]'::jsonb)$$,
  '22023',
  null,
  'a Team in two Matchups is refused'
);

-- ---- as another User, B --------------------------------------------------------
set local request.jwt.claims = '{"sub": "22222222-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is((select count(*)::int from public.team_tally_events), 0, 'another User sees none of A''s Team Events');
select is((select count(*)::int from public.team_tally_teams), 0, 'another User sees none of A''s Teams');
select is((select count(*)::int from public.team_tally_player_slots), 0, 'another User sees none of A''s Player slots');
select is((select count(*)::int from public.team_tally_matchups), 0, 'another User sees none of A''s Matchups');
select is((select count(*)::int from public.team_tally_games), 0, 'another User sees none of A''s Games');

-- Both silently match no row under RLS; checked from outside below.
update public.team_tally_events set name = 'Hijacked'
where id = (select value::uuid from tt_ids where key = 'event');
delete from public.team_tally_events
where id = (select value::uuid from tt_ids where key = 'event');
update public.team_tally_player_slots set name = 'Hijacked';

select throws_ok(
  $$insert into public.team_tally_teams (event_id, position, home_court)
    values ((select value::uuid from tt_ids where key = 'event'), 9, '30')$$,
  '42501',
  null,
  'another User cannot add a Team to A''s Team Event'
);
select throws_ok(
  $$insert into public.team_tally_events (owner_id, name, event_date)
    values ('22222222-0000-0000-0000-00000000000a', 'Planted', date '2026-10-13')$$,
  '42501',
  null,
  'another User cannot create a Team Event in A''s name'
);
select throws_ok(
  $$select public.team_tally_save_event(
      (select value::uuid from tt_ids where key = 'event'), 'Hijacked', date '2026-10-13',
      (select teams from tt_setup), (select matchups from tt_setup))$$,
  'P0002',
  null,
  'another User cannot overwrite A''s Team Event through the save function'
);

reset role;

select is(
  (select name from public.team_tally_events where id = (select value::uuid from tt_ids where key = 'event')),
  'Tuesday Team Night, week 2',
  'another User cannot rename A''s Team Event, and it is still there to read'
);
select is(
  (select count(*)::int from public.team_tally_player_slots where name = 'Hijacked'),
  0,
  'another User cannot rename A''s players'
);

-- ---- as anon, holding links -----------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select count(*) from public.team_tally_events$$,
  '42501',
  null,
  'anon has no access to the Team Event table'
);
select is(
  public.team_tally_public_event((select value from tt_ids where key = 'public_token')) ->> 'name',
  'Tuesday Team Night, week 2',
  'the Public Link token reads the Team Event'
);
select is(
  jsonb_array_length(public.team_tally_public_event((select value from tt_ids where key = 'public_token')) -> 'teams'),
  4,
  'the Public Link read includes every Team'
);
select ok(
  position(
    (select value from tt_ids where key = 'score_token_16')
    in public.team_tally_public_event((select value from tt_ids where key = 'public_token'))::text
  ) = 0,
  'the Public Link read never carries a Score Link token'
);
select is(
  public.team_tally_public_event('not-the-token-not-the-token-not-the-token'),
  null,
  'a wrong Public Link token is refused'
);
select is(
  public.team_tally_public_event((select value from tt_ids where key = 'score_token_16')),
  null,
  'a Score Link token is not a Public Link token'
);

select * from finish();

rollback;

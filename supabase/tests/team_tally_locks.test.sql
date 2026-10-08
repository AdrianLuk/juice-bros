-- Team Tally: what stays put once play has started (PR #629 review). What
-- this pins down:
--
--   * the setup form's save refuses a Team in two opening Matchups however
--     its index is spelled ("0" and "00" are the same Team);
--   * once any Game has a score, or the Flights are placed, the setup is set:
--     rosters change from the Score Links from then on;
--   * a finished night refuses a Dreambreaker winner, from a Score Link and
--     from the Organizer, like every other write;
--   * a tie on every count across a Flight line that seeding settled in
--     setup order stays the Organizer's call after the Flights are placed:
--     putting the lower Team ahead swaps the two Teams between the two
--     Flights (the court pairs stay with the Flight), until either Flight has
--     a score.
--
-- Names are PPA Tour pros: this repo is public.

begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

select has_function(
  'public', 'team_tally_organizer_put_ahead', array['uuid', 'uuid'],
  'team_tally_organizer_put_ahead(uuid, uuid) exists'
);

insert into auth.users (id, instance_id, aud, role, email) values
  ('25252525-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tt-locks-a@example.com'),
  ('25252525-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tt-locks-b@example.com');

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

create temporary table tt_ids (key text primary key, value text) on commit drop;
grant select, insert, update on tt_ids to authenticated, anon;

set local role authenticated;
set local request.jwt.claims = '{"sub": "25252525-0000-0000-0000-00000000000a", "role": "authenticated"}';

-- ---- one Matchup per Team, compared as numbers ------------------------------------
select throws_ok(
  $$select public.team_tally_save_event(null, 'Tuesday Team Night', date '2026-10-13',
      (select teams from tt_setup), '[{"red": "0", "blue": "1"}, {"red": "00", "blue": "3"}]'::jsonb)$$,
  '22023',
  'every Team plays in exactly one opening Matchup',
  'a Team written as "0" and as "00" is one Team, in two Matchups'
);

-- ---- the setup is set once a Game has a score -------------------------------------
insert into tt_ids
select 'event', public.team_tally_save_event(null, 'Tuesday Team Night', date '2026-10-13',
  (select teams from tt_setup), (select matchups from tt_setup))::text;
insert into tt_ids select 'team_' || home_court, id::text from public.team_tally_teams
  where event_id = (select value::uuid from tt_ids where key = 'event');
insert into tt_ids select 'token_' || home_court, score_token from public.team_tally_teams
  where event_id = (select value::uuid from tt_ids where key = 'event');
insert into tt_ids select 'm' || number, id::text from public.team_tally_matchups
  where event_id = (select value::uuid from tt_ids where key = 'event') and stage = 'opening';

-- An edit carries each Team's id, as the edit form does, so the rows stay.
reset role;
create temporary table tt_edit on commit drop as
select jsonb_agg(t.team || jsonb_build_object('id', (select value from tt_ids where key = 'team_' || (t.team ->> 'homeCourt'))) order by t.n) as teams
from tt_setup, jsonb_array_elements(tt_setup.teams) with ordinality as t (team, n);
grant select on tt_edit to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub": "25252525-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$select public.team_tally_save_event((select value::uuid from tt_ids where key = 'event'),
      'Tuesday Team Night, week 2', date '2026-10-13', (select teams from tt_edit), (select matchups from tt_setup))$$,
  'before any score, the Organizer edits the setup'
);

select lives_ok(
  $$select public.team_tally_organizer_score_game(
      (select id from public.team_tally_games where matchup_id = (select value::uuid from tt_ids where key = 'm1') and round = 1 and kind = 'captains'),
      11, 9)$$,
  'a captains'' game gets a score'
);

select throws_ok(
  $$select public.team_tally_save_event((select value::uuid from tt_ids where key = 'event'),
      'Tuesday Team Night', date '2026-10-13', (select teams from tt_edit),
      '[{"red": 0, "blue": 2}, {"red": 1, "blue": 3}]'::jsonb)$$,
  '22023',
  'Play has started, so the setup is set. Rosters change from the Score Links now.',
  'once a Game has a score, the setup is refused, with the reason'
);
select is(
  (select count(*)::int from public.team_tally_games g
   where g.matchup_id = (select value::uuid from tt_ids where key = 'm1') and g.red_score is not null),
  1,
  'and the scored Matchup keeps its Games'
);

-- Cleared again, the setup opens back up.
select lives_ok(
  $$select public.team_tally_organizer_score_game(
      (select id from public.team_tally_games where matchup_id = (select value::uuid from tt_ids where key = 'm1') and round = 1 and kind = 'captains'),
      null, null)$$,
  'the Organizer clears the score'
);
select lives_ok(
  $$select public.team_tally_save_event((select value::uuid from tt_ids where key = 'event'),
      'Tuesday Team Night', date '2026-10-13', (select teams from tt_edit), (select matchups from tt_setup))$$,
  'with no score anywhere, the setup saves again'
);

-- ---- every Matchup 60-60: all four Teams level on every count -------------------------
reset role;
update public.team_tally_games set red_score = 11, blue_score = 9
  where matchup_id in (select value::uuid from tt_ids where key in ('m1', 'm2')) and kind = 'captains';
update public.team_tally_games set red_score = 9, blue_score = 11
  where matchup_id in (select value::uuid from tt_ids where key in ('m1', 'm2')) and kind = 'teammates';
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select public.team_tally_set_dreambreaker((select value from tt_ids where key = 'token_16'),
  (select value::uuid from tt_ids where key = 'm1'), (select value::uuid from tt_ids where key = 'team_16'));
select public.team_tally_mark_done((select value from tt_ids where key = 'token_16'), (select value::uuid from tt_ids where key = 'm1'));
select public.team_tally_set_dreambreaker((select value from tt_ids where key = 'token_17'),
  (select value::uuid from tt_ids where key = 'm2'), (select value::uuid from tt_ids where key = 'team_17'));

set local role authenticated;
set local request.jwt.claims = '{"sub": "25252525-0000-0000-0000-00000000000a", "role": "authenticated"}';

select throws_ok(
  $$select public.team_tally_organizer_put_ahead((select value::uuid from tt_ids where key = 'event'), (select value::uuid from tt_ids where key = 'team_17'))$$,
  '22023',
  'The Flights aren''t placed yet.',
  'before Seeding, a tie is ordered the usual way'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select lives_ok(
  $$select public.team_tally_mark_done((select value from tt_ids where key = 'token_18'), (select value::uuid from tt_ids where key = 'm2'))$$,
  'the last opening Matchup done places the Flights, nobody choosing the tie'
);

reset role;
select results_eq(
  $$select m.flight_letter, m.court_one || ' & ' || m.court_two, m.red_team_id::text, m.blue_team_id::text
    from public.team_tally_matchups m where m.stage = 'flight' order by m.number$$,
  $$values
      ('A', '16 & 19', (select value from tt_ids where key = 'team_16'), (select value from tt_ids where key = 'team_19')),
      ('B', '17 & 18', (select value from tt_ids where key = 'team_17'), (select value from tt_ids where key = 'team_18'))$$,
  'level on every count, the Teams seed in setup order'
);
insert into tt_ids select 'flight_' || flight_letter, id::text from public.team_tally_matchups where stage = 'flight';

set local role authenticated;
set local request.jwt.claims = '{"sub": "25252525-0000-0000-0000-00000000000a", "role": "authenticated"}';

select throws_ok(
  $$select public.team_tally_save_event((select value::uuid from tt_ids where key = 'event'),
      'Tuesday Team Night', date '2026-10-13', (select teams from tt_edit), (select matchups from tt_setup))$$,
  '22023',
  'Play has started, so the setup is set. Rosters change from the Score Links now.',
  'with the Flights placed, the setup is refused'
);

-- ---- the Organizer's call on that tie, after Seeding ----------------------------------
select throws_ok(
  $$select public.team_tally_organizer_put_ahead((select value::uuid from tt_ids where key = 'event'), (select value::uuid from tt_ids where key = 'team_18'))$$,
  '22023',
  'That Team isn''t level on every count with the Team above it in the next Flight up.',
  'only the top Team of a Flight, tied with the bottom of the Flight above, can move up'
);

set local request.jwt.claims = '{"sub": "25252525-0000-0000-0000-00000000000b", "role": "authenticated"}';
select throws_ok(
  $$select public.team_tally_organizer_put_ahead((select value::uuid from tt_ids where key = 'event'), (select value::uuid from tt_ids where key = 'team_17'))$$,
  'P0002',
  null,
  'another User cannot make A''s call'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok(
  $$select public.team_tally_organizer_put_ahead((select value::uuid from tt_ids where key = 'event'), (select value::uuid from tt_ids where key = 'team_17'))$$,
  '42501',
  null,
  'nor can a Score Link holder'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "25252525-0000-0000-0000-00000000000a", "role": "authenticated"}';
select lives_ok(
  $$select public.team_tally_organizer_put_ahead((select value::uuid from tt_ids where key = 'event'), (select value::uuid from tt_ids where key = 'team_17'))$$,
  'the Organizer puts Kitchen Kings ahead of Federico''s Team'
);
select results_eq(
  $$select m.flight_letter, m.court_one || ' & ' || m.court_two, m.red_team_id::text, m.blue_team_id::text
    from public.team_tally_matchups m where m.stage = 'flight' order by m.number$$,
  $$values
      ('A', '16 & 19', (select value from tt_ids where key = 'team_16'), (select value from tt_ids where key = 'team_17')),
      ('B', '17 & 18', (select value from tt_ids where key = 'team_19'), (select value from tt_ids where key = 'team_18'))$$,
  'the two Teams change Flights; each Flight keeps its court pair'
);
reset role;
select results_eq(
  $$select team_id::text from public.team_tally_seed_order((select value::uuid from tt_ids where key = 'event')) order by seed$$,
  $$values ((select value from tt_ids where key = 'team_16')), ((select value from tt_ids where key = 'team_17')),
            ((select value from tt_ids where key = 'team_19')), ((select value from tt_ids where key = 'team_18'))$$,
  'and the standings read in the new order'
);
set local role authenticated;
set local request.jwt.claims = '{"sub": "25252525-0000-0000-0000-00000000000a", "role": "authenticated"}';

-- A score in either Flight settles it.
select lives_ok(
  $$select public.team_tally_organizer_score_game(
      (select id from public.team_tally_games where matchup_id = (select value::uuid from tt_ids where key = 'flight_B') and round = 1 and kind = 'captains'),
      11, 4)$$,
  'Flight B starts'
);
select throws_ok(
  $$select public.team_tally_organizer_put_ahead((select value::uuid from tt_ids where key = 'event'), (select value::uuid from tt_ids where key = 'team_19'))$$,
  '22023',
  'A Flight has a score, so the Teams stay.',
  'once either Flight has a score, the Teams stay'
);

-- ---- a finished night takes no Dreambreaker winner ------------------------------------
reset role;
update public.team_tally_games set red_score = 11, blue_score = 4
  where matchup_id in (select value::uuid from tt_ids where key like 'flight_%');
update public.team_tally_matchups set done_at = null
  where id = (select value::uuid from tt_ids where key = 'm2');
update public.team_tally_matchups set done_at = now()
  where id in (select value::uuid from tt_ids where key like 'flight_%');
update public.team_tally_events set status = 'finished'
  where id = (select value::uuid from tt_ids where key = 'event');

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select throws_ok(
  $$select public.team_tally_set_dreambreaker((select value from tt_ids where key = 'token_18'),
      (select value::uuid from tt_ids where key = 'm2'), (select value::uuid from tt_ids where key = 'team_18'))$$,
  '22023',
  'This Team Event has finished, so its scores are final.',
  'a Score Link cannot change a Dreambreaker once the night is over'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "25252525-0000-0000-0000-00000000000a", "role": "authenticated"}';
select throws_ok(
  $$select public.team_tally_organizer_set_dreambreaker((select value::uuid from tt_ids where key = 'm2'), null)$$,
  '22023',
  'This Team Event has finished, so its scores are final.',
  'nor can the Organizer'
);

select * from finish();

rollback;

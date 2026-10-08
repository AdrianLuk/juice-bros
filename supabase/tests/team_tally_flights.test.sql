-- Team Tally: Matchup done, Seeding and Flights (issue #624). What this pins
-- down:
--
--   * Matchup done refuses a Matchup with a Game unscored, and a tied one
--     with no Dreambreaker winner, with the reason;
--   * the Dreambreaker winner is one of the Matchup's own Teams, recorded
--     only on a tie, by either captain or the Organizer;
--   * a done Matchup refuses score and slot writes, from a Score Link and
--     from the Organizer alike, until the Organizer (and only the Organizer)
--     reopens it;
--   * the last opening Matchup done places the Flights by Seeding (Team
--     score, then the Matchup winner for two Teams that played each other),
--     each on its opening court pair, and Seed now does the same early, once;
--   * the Organizer swaps Flight court pairs before any Flight score, orders
--     a tie on every count, and a reopened opening Matchup leaves the Flights
--     where they are;
--   * the last Flight Matchup done finishes the night.
--
-- The concurrency case (two captains finishing the last two Matchups at the
-- same moment) is in src/lib/team-tally/flights.db-test.ts: pgTAP runs in one
-- transaction and can't race itself. Names are PPA Tour pros: this repo is
-- public.

begin;

create extension if not exists pgtap with schema extensions;

select plan(52);

select has_function('public', 'team_tally_mark_done', array['text', 'uuid'], 'team_tally_mark_done(text, uuid) exists');
select has_function('public', 'team_tally_set_dreambreaker', array['text', 'uuid', 'uuid'], 'team_tally_set_dreambreaker exists');
select has_function('public', 'team_tally_organizer_reopen', array['uuid'], 'team_tally_organizer_reopen exists');
select has_function('public', 'team_tally_organizer_seed_now', array['uuid'], 'team_tally_organizer_seed_now exists');
select has_function('public', 'team_tally_organizer_swap_flight_courts', array['uuid', 'uuid'], 'team_tally_organizer_swap_flight_courts exists');

insert into auth.users (id, instance_id, aud, role, email) values
  ('24242424-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tt-flights-a@example.com'),
  ('24242424-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tt-flights-b@example.com');

create temporary table tt_ids (key text primary key, value text) on commit drop;
grant select, insert, update on tt_ids to authenticated, anon;

-- ---- Organizer A builds a four-Team night -----------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "24242424-0000-0000-0000-00000000000a", "role": "authenticated"}';

insert into tt_ids
select 'event', public.team_tally_save_event(
  null, 'Tuesday Team Night', date '2026-10-13',
  '[
    {"nickname": "Golden Set", "homeCourt": "16", "captain": "Ben Johns", "slotA": "Anna Leigh Waters", "slotB": "Collin Johns", "slotC": "Anna Bright"},
    {"nickname": "", "homeCourt": "19", "captain": "Federico Staksrud", "slotA": "Catherine Parenteau", "slotB": "Andrei Daescu", "slotC": "Jorja Johnson"},
    {"nickname": "Kitchen Kings", "homeCourt": "17", "captain": "Hayden Patriquin", "slotA": "Tyra Black", "slotB": "Gabriel Tardio", "slotC": "Lea Jansen"},
    {"nickname": null, "homeCourt": "18", "captain": "Christian Alshon", "slotA": "Jessie Irvine", "slotB": "JW Johnson", "slotC": "Kaitlyn Christian"}
  ]'::jsonb,
  '[{"red": 0, "blue": 1}, {"red": 2, "blue": 3}]'::jsonb
)::text;

insert into tt_ids select 'token_' || c, score_token from public.team_tally_teams t
  join (values ('16', 'ben'), ('19', 'fed'), ('17', 'hay'), ('18', 'chr')) as h (court, c) on h.court = t.home_court;
insert into tt_ids select 'team_' || c, t.id::text from public.team_tally_teams t
  join (values ('16', 'ben'), ('19', 'fed'), ('17', 'hay'), ('18', 'chr')) as h (court, c) on h.court = t.home_court;
insert into tt_ids select 'm' || number, id::text from public.team_tally_matchups where stage = 'opening';
insert into tt_ids
select 'm1_r' || g.round || '_' || g.kind, g.id::text
from public.team_tally_games g join public.team_tally_matchups m on m.id = g.matchup_id
where m.stage = 'opening' and m.number = 1;

-- ---- Match 1, by Ben's Score Link -----------------------------------------------
reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select public.team_tally_mark_done((select value from tt_ids where key = 'token_ben'), (select value::uuid from tt_ids where key = 'm1'))$$,
  '22023',
  'Round 1''s captains'' game has no score yet.',
  'Matchup done is refused while a Game has no score, and says which'
);

-- Six Games, 11-9 and 9-11 in turn: 60-60.
reset role;
update public.team_tally_games set red_score = 11, blue_score = 9
  where matchup_id = (select value::uuid from tt_ids where key = 'm1') and kind = 'captains';
update public.team_tally_games set red_score = 9, blue_score = 11
  where matchup_id = (select value::uuid from tt_ids where key = 'm1') and kind = 'teammates';
set local role anon;

select throws_ok(
  $$select public.team_tally_mark_done((select value from tt_ids where key = 'token_ben'), (select value::uuid from tt_ids where key = 'm1'))$$,
  '22023',
  'Tied 60-60. Record who won the Dreambreaker first.',
  'a tied Matchup is refused until its Dreambreaker winner is recorded'
);
select throws_ok(
  $$select public.team_tally_set_dreambreaker((select value from tt_ids where key = 'token_hay'),
      (select value::uuid from tt_ids where key = 'm1'), (select value::uuid from tt_ids where key = 'team_hay'))$$,
  '42501',
  'That Matchup isn''t yours.',
  'a captain from another Matchup cannot record its Dreambreaker'
);
select throws_ok(
  $$select public.team_tally_set_dreambreaker((select value from tt_ids where key = 'token_ben'),
      (select value::uuid from tt_ids where key = 'm1'), (select value::uuid from tt_ids where key = 'team_hay'))$$,
  '22023',
  'That Team isn''t in this Matchup.',
  'the Dreambreaker winner is one of the Matchup''s two Teams'
);
select lives_ok(
  $$select public.team_tally_set_dreambreaker((select value from tt_ids where key = 'token_fed'),
      (select value::uuid from tt_ids where key = 'm1'), (select value::uuid from tt_ids where key = 'team_fed'))$$,
  'either captain records who won the Dreambreaker'
);
select lives_ok(
  $$select public.team_tally_mark_done((select value from tt_ids where key = 'token_ben'), (select value::uuid from tt_ids where key = 'm1'))$$,
  'with a Dreambreaker winner, the tied Matchup is done'
);
select is(
  public.team_tally_score_link_event((select value from tt_ids where key = 'token_ben')) -> 'matchups' -> 0 ->> 'doneByTeamId',
  (select value from tt_ids where key = 'team_ben'),
  'the document says which Team marked it done'
);
select is(
  public.team_tally_score_link_event((select value from tt_ids where key = 'token_ben')) -> 'matchups' -> 0 ->> 'dreambreakerWinnerId',
  (select value from tt_ids where key = 'team_fed'),
  'and who won its Dreambreaker'
);

-- ---- a done Matchup is locked ----------------------------------------------------
select throws_ok(
  $$select public.team_tally_score_game((select value from tt_ids where key = 'token_fed'),
      (select value::uuid from tt_ids where key = 'm1_r1_captains'), 11, 5)$$,
  '22023',
  'This Matchup is done. Only the organizer can reopen it.',
  'a done Matchup refuses a captain''s score'
);
select throws_ok(
  $$select public.team_tally_set_slots((select value from tt_ids where key = 'token_ben'), 'Anna Bright', 'Collin Johns', 'Anna Leigh Waters')$$,
  '22023',
  'This Team''s Matchup is done, so its roster is final.',
  'and a captain''s roster change'
);
select throws_ok(
  $$select public.team_tally_set_dreambreaker((select value from tt_ids where key = 'token_ben'),
      (select value::uuid from tt_ids where key = 'm1'), (select value::uuid from tt_ids where key = 'team_ben'))$$,
  '22023',
  'This Matchup is done. Only the organizer can reopen it.',
  'and a new Dreambreaker winner'
);
select throws_ok(
  $$select public.team_tally_mark_done((select value from tt_ids where key = 'token_fed'), (select value::uuid from tt_ids where key = 'm1'))$$,
  '22023',
  'This Matchup is already done.',
  'it is done once'
);
select throws_ok(
  $$select public.team_tally_organizer_reopen((select value::uuid from tt_ids where key = 'm1'))$$,
  '42501',
  null,
  'a Score Link holder cannot reopen it'
);
select is(
  public.team_tally_score_link_event((select value from tt_ids where key = 'token_ben')) ->> 'status',
  'opening',
  'one Matchup done of two places no Flights'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "24242424-0000-0000-0000-00000000000a", "role": "authenticated"}';

select throws_ok(
  $$select public.team_tally_organizer_score_game(
      (select g.id from public.team_tally_games g where g.matchup_id = (select value::uuid from tt_ids where key = 'm1') and g.round = 2 and g.kind = 'captains'), 11, 4)$$,
  '22023',
  'This Matchup is done. Only the organizer can reopen it.',
  'the Organizer''s score is refused too, until they reopen it'
);
select throws_ok(
  $$update public.team_tally_games set red_score = 11, blue_score = 4
    where matchup_id = (select value::uuid from tt_ids where key = 'm1') and round = 2 and kind = 'captains'$$,
  '22023',
  'This Matchup is done. Only the organizer can reopen it.',
  'nor written straight to the table'
);

set local request.jwt.claims = '{"sub": "24242424-0000-0000-0000-00000000000b", "role": "authenticated"}';
select throws_ok(
  $$select public.team_tally_organizer_reopen((select value::uuid from tt_ids where key = 'm1'))$$,
  'P0002',
  null,
  'another User cannot reopen A''s Matchup'
);

set local request.jwt.claims = '{"sub": "24242424-0000-0000-0000-00000000000a", "role": "authenticated"}';
select lives_ok(
  $$select public.team_tally_organizer_reopen((select value::uuid from tt_ids where key = 'm1'))$$,
  'the Organizer reopens it'
);
select lives_ok(
  $$select public.team_tally_organizer_score_game(
      (select g.id from public.team_tally_games g where g.matchup_id = (select value::uuid from tt_ids where key = 'm1') and g.round = 1 and g.kind = 'captains'), 11, 9)$$,
  'and a reopened Matchup takes scores again'
);
select lives_ok(
  $$select public.team_tally_organizer_mark_done((select value::uuid from tt_ids where key = 'm1'))$$,
  'the Organizer can mark a Matchup done as well'
);

-- Match 2: Kitchen Kings win every Game 11-5, 66-30.
update public.team_tally_games set red_score = 11, blue_score = 5
  where matchup_id = (select value::uuid from tt_ids where key = 'm2');

-- ---- the last opening Matchup done places the Flights ----------------------------
reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select lives_ok(
  $$select public.team_tally_mark_done((select value from tt_ids where key = 'token_chr'), (select value::uuid from tt_ids where key = 'm2'))$$,
  'the losing captain can mark their Matchup done'
);

reset role;
insert into tt_ids select 'flight_' || flight_letter, id::text from public.team_tally_matchups where stage = 'flight';
insert into tt_ids
select 'fB_r1_captains', g.id::text
from public.team_tally_games g join public.team_tally_matchups m on m.id = g.matchup_id
where m.stage = 'flight' and m.flight_letter = 'B' and g.round = 1 and g.kind = 'captains';

select is(
  (select status || ' ' || (seeded_at is not null)::text from public.team_tally_events where id = (select value::uuid from tt_ids where key = 'event')),
  'flights true',
  'the last opening Matchup done places the Flights by itself'
);
select results_eq(
  $$select m.flight_letter, m.court_one || ' & ' || m.court_two, m.red_team_id::text, m.blue_team_id::text
    from public.team_tally_matchups m where m.stage = 'flight' order by m.number$$,
  $$values
      ('A', '16 & 19', (select value from tt_ids where key = 'team_hay'), (select value from tt_ids where key = 'team_fed')),
      ('B', '17 & 18', (select value from tt_ids where key = 'team_ben'), (select value from tt_ids where key = 'team_chr'))$$,
  'Kitchen Kings top, Federico''s Team over Ben''s on their Dreambreaker; Flight A on Match 1''s courts, Flight B on Match 2''s'
);
select is(
  (select count(*)::int from public.team_tally_games where matchup_id in (select value::uuid from tt_ids where key like 'flight_%')),
  12,
  'each Flight Matchup has its six Games'
);
select ok(
  (select count(*) > 0 from realtime.messages
   where topic = 'team-tally:' || (select value from tt_ids where key = 'event') and event = 'changed'),
  'placing the Flights broadcasts on the Team Event''s topic'
);
select is(
  jsonb_array_length(public.team_tally_public_event((select public_token from public.team_tally_events where id = (select value::uuid from tt_ids where key = 'event'))) -> 'matchups'),
  4,
  'the Public Link reads the Flights'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "24242424-0000-0000-0000-00000000000a", "role": "authenticated"}';

select throws_ok(
  $$select public.team_tally_organizer_seed_now((select value::uuid from tt_ids where key = 'event'))$$,
  '22023',
  'The Flights are already placed.',
  'Flights are placed once'
);

-- ---- Flight court pairs -------------------------------------------------------------
select lives_ok(
  $$select public.team_tally_organizer_swap_flight_courts((select value::uuid from tt_ids where key = 'flight_A'), (select value::uuid from tt_ids where key = 'flight_B'))$$,
  'the Organizer swaps two Flights'' court pairs before any Flight score'
);
select results_eq(
  $$select flight_letter, court_one || ' & ' || court_two from public.team_tally_matchups where stage = 'flight' order by number$$,
  $$values ('A', '17 & 18'), ('B', '16 & 19')$$,
  'Flight A now plays on 17 & 18'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select public.team_tally_score_game((select value from tt_ids where key = 'token_ben'),
      (select value::uuid from tt_ids where key = 'm1_r1_teammates'), 11, 2)$$,
  '22023',
  'This Matchup is done. Only the organizer can reopen it.',
  'a captain cannot touch their done opening Matchup once in a Flight'
);
select lives_ok(
  $$select public.team_tally_score_game((select value from tt_ids where key = 'token_ben'),
      (select value::uuid from tt_ids where key = 'fB_r1_captains'), 11, 7)$$,
  'and scores their Flight Matchup from the same Score Link'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "24242424-0000-0000-0000-00000000000a", "role": "authenticated"}';

select throws_ok(
  $$select public.team_tally_organizer_swap_flight_courts((select value::uuid from tt_ids where key = 'flight_A'), (select value::uuid from tt_ids where key = 'flight_B'))$$,
  '22023',
  'A Flight has a score, so the courts stay.',
  'once a Flight has a score, its courts stay'
);

-- ---- a correction after Seeding leaves the Flights placed ---------------------------
select lives_ok(
  $$select public.team_tally_organizer_reopen((select value::uuid from tt_ids where key = 'm2'))$$,
  'the Organizer reopens an opening Matchup after Seeding'
);
select lives_ok(
  $$select public.team_tally_organizer_score_game(
      (select g.id from public.team_tally_games g where g.matchup_id = (select value::uuid from tt_ids where key = 'm2') and g.round = 1 and g.kind = 'captains'), 2, 11)$$,
  'and corrects a score'
);
select results_eq(
  $$select status, (select count(*)::int from public.team_tally_matchups where stage = 'flight')
    from public.team_tally_events where id = (select value::uuid from tt_ids where key = 'event')$$,
  $$values ('flights', 2)$$,
  'the Flights stay where they were placed'
);

-- ---- the last Flight Matchup done ends the night -----------------------------------
update public.team_tally_games set red_score = 11, blue_score = 7
  where matchup_id in (select value::uuid from tt_ids where key like 'flight_%');
select lives_ok(
  $$select public.team_tally_organizer_mark_done((select value::uuid from tt_ids where key = 'flight_A'))$$,
  'Flight A is done'
);
select is(
  (select status from public.team_tally_events where id = (select value::uuid from tt_ids where key = 'event')),
  'flights',
  'one Flight done of two leaves the night running'
);

reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select lives_ok(
  $$select public.team_tally_mark_done((select value from tt_ids where key = 'token_chr'), (select value::uuid from tt_ids where key = 'flight_B'))$$,
  'a captain marks the last Flight done'
);
reset role;
select is(
  (select status from public.team_tally_events where id = (select value::uuid from tt_ids where key = 'event')),
  'finished',
  'the last Flight Matchup done ends the night'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "24242424-0000-0000-0000-00000000000a", "role": "authenticated"}';
select lives_ok(
  $$select public.team_tally_organizer_reopen((select value::uuid from tt_ids where key = 'flight_B'))$$,
  'the Organizer can reopen a Flight after the night ends'
);
select is(
  (select status from public.team_tally_events where id = (select value::uuid from tt_ids where key = 'event')),
  'flights',
  'which puts the night back into its Flights'
);

-- ---- a second night: Seed now, and the Organizer's order on a full tie --------------
insert into tt_ids
select 'event2', public.team_tally_save_event(
  null, 'Thursday Team Night', date '2026-10-15',
  '[
    {"nickname": null, "homeCourt": "1", "captain": "Anna Leigh Waters", "slotA": "Ben Johns", "slotB": "Tyra Black", "slotC": "Collin Johns"},
    {"nickname": null, "homeCourt": "2", "captain": "Catherine Parenteau", "slotA": "Federico Staksrud", "slotB": "Jorja Johnson", "slotC": "Andrei Daescu"},
    {"nickname": null, "homeCourt": "3", "captain": "Anna Bright", "slotA": "Hayden Patriquin", "slotB": "Lea Jansen", "slotC": "Gabriel Tardio"},
    {"nickname": null, "homeCourt": "4", "captain": "Jessie Irvine", "slotA": "Christian Alshon", "slotB": "Kaitlyn Christian", "slotC": "JW Johnson"}
  ]'::jsonb,
  '[{"red": 0, "blue": 1}, {"red": 2, "blue": 3}]'::jsonb
)::text;
insert into tt_ids select 'e2_team_' || home_court, id::text from public.team_tally_teams
  where event_id = (select value::uuid from tt_ids where key = 'event2');

select throws_ok(
  $$select public.team_tally_organizer_set_tie_order((select value::uuid from tt_ids where key = 'event2'),
      array[(select value::uuid from tt_ids where key = 'team_ben')])$$,
  '22023',
  'That Team isn''t in this Team Event.',
  'the Organizer orders only this night''s Teams'
);
select lives_ok(
  $$select public.team_tally_organizer_set_tie_order((select value::uuid from tt_ids where key = 'event2'),
      array[(select value::uuid from tt_ids where key = 'e2_team_4'), (select value::uuid from tt_ids where key = 'e2_team_2')])$$,
  'the Organizer orders Teams level on every count'
);

set local request.jwt.claims = '{"sub": "24242424-0000-0000-0000-00000000000b", "role": "authenticated"}';
select throws_ok(
  $$select public.team_tally_organizer_seed_now((select value::uuid from tt_ids where key = 'event2'))$$,
  'P0002',
  null,
  'another User cannot seed A''s night'
);

set local request.jwt.claims = '{"sub": "24242424-0000-0000-0000-00000000000a", "role": "authenticated"}';
-- Nothing scored: every Team on 0, so the Organizer's order, then setup order.
select lives_ok(
  $$select public.team_tally_organizer_seed_now((select value::uuid from tt_ids where key = 'event2'))$$,
  'Seed now places the Flights with no Matchup done'
);
select results_eq(
  $$select m.flight_letter, m.court_one || ' & ' || m.court_two, m.red_team_id::text, m.blue_team_id::text
    from public.team_tally_matchups m
    where m.event_id = (select value::uuid from tt_ids where key = 'event2') and m.stage = 'flight' order by m.number$$,
  $$values
      ('A', '1 & 2', (select value from tt_ids where key = 'e2_team_4'), (select value from tt_ids where key = 'e2_team_2')),
      ('B', '3 & 4', (select value from tt_ids where key = 'e2_team_1'), (select value from tt_ids where key = 'e2_team_3'))$$,
  'the Organizer''s order first, then the rest in setup order'
);
select throws_ok(
  $$select public.team_tally_organizer_set_tie_order((select value::uuid from tt_ids where key = 'event2'),
      array[(select value::uuid from tt_ids where key = 'e2_team_1')])$$,
  '22023',
  'The Flights are already placed.',
  'and once placed, the order holds'
);

select * from finish();

rollback;

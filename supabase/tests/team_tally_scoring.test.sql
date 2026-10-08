-- Team Tally: Score Links and live scoring (issue #623). What this pins down:
--
--   * a Score Link token reads its own Team Event (and which Team it is), and
--     writes scores only for the Games of a Matchup its Team plays in;
--   * either Team of a Matchup can enter or correct any of its six Games, and
--     each write records which Team made it;
--   * a score no Game can end on (a side past 11 leading by more than 2) is
--     refused with the reason, everywhere, the Organizer included;
--   * a Score Link renames or reorders its own Team's slots A, B and C, but
--     never moves a Round that already has a score;
--   * the Organizer scores and edits slots for every Team of their own Team
--     Event, recorded as the Organizer; another User cannot;
--   * a Game or slot change sends a "changed" broadcast on the Team Event's
--     Realtime topic, with no data in it.
--
-- Names are PPA Tour pros: this repo is public.

begin;

create extension if not exists pgtap with schema extensions;

select plan(43);

select has_function('public', 'team_tally_score_link_event', array['text'], 'team_tally_score_link_event(text) exists');
select has_function('public', 'team_tally_score_game', array['text', 'uuid', 'integer', 'integer'], 'team_tally_score_game exists');
select has_function('public', 'team_tally_set_slots', array['text', 'text', 'text', 'text'], 'team_tally_set_slots exists');
select has_function('public', 'team_tally_organizer_event', array['uuid'], 'team_tally_organizer_event exists');
select has_function('public', 'team_tally_organizer_score_game', array['uuid', 'integer', 'integer'], 'team_tally_organizer_score_game exists');
select has_function('public', 'team_tally_organizer_set_slots', array['uuid', 'text', 'text', 'text'], 'team_tally_organizer_set_slots exists');

insert into auth.users (id, instance_id, aud, role, email) values
  ('23232323-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tt-scoring-a@example.com'),
  ('23232323-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tt-scoring-b@example.com');

create temporary table tt_ids (key text primary key, value text) on commit drop;
grant select, insert, update on tt_ids to authenticated, anon;

-- ---- Organizer A builds a four-Team night -----------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "23232323-0000-0000-0000-00000000000a", "role": "authenticated"}';

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

insert into tt_ids select 'token_ben', score_token from public.team_tally_teams where home_court = '16';
insert into tt_ids select 'token_fed', score_token from public.team_tally_teams where home_court = '19';
insert into tt_ids select 'team_ben', id::text from public.team_tally_teams where home_court = '16';
insert into tt_ids select 'team_fed', id::text from public.team_tally_teams where home_court = '19';
insert into tt_ids select 'team_hay', id::text from public.team_tally_teams where home_court = '17';
insert into tt_ids select 'public_token', public_token from public.team_tally_events;
insert into tt_ids
select 'm1_r' || g.round || '_' || g.kind, g.id::text
from public.team_tally_games g join public.team_tally_matchups m on m.id = g.matchup_id
where m.number = 1;
insert into tt_ids
select 'm2_r1_captains', g.id::text
from public.team_tally_games g join public.team_tally_matchups m on m.id = g.matchup_id
where m.number = 2 and g.round = 1 and g.kind = 'captains';

-- ---- a captain with Ben's Score Link -------------------------------------------
reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  public.team_tally_score_link_event((select value from tt_ids where key = 'token_ben')) ->> 'myTeamId',
  (select value from tt_ids where key = 'team_ben'),
  'a Score Link reads its Team Event and knows which Team it is'
);
select is(
  jsonb_array_length(public.team_tally_score_link_event((select value from tt_ids where key = 'token_ben')) -> 'matchups'),
  2,
  'a Score Link reads every Matchup, for the standings'
);
select ok(
  position(
    (select value from tt_ids where key = 'token_fed')
    in public.team_tally_score_link_event((select value from tt_ids where key = 'token_ben'))::text
  ) = 0,
  'a Score Link read never carries another Team''s Score Link token'
);
select ok(
  position(
    (select value from tt_ids where key = 'public_token')
    in public.team_tally_score_link_event((select value from tt_ids where key = 'token_ben'))::text
  ) = 0,
  'a Score Link read never carries the Public Link token'
);
select is(
  public.team_tally_score_link_event('not-the-token-not-the-token-not-the-token'),
  null,
  'a wrong Score Link token reads nothing'
);
select is(
  public.team_tally_score_link_event((select value from tt_ids where key = 'public_token')),
  null,
  'the Public Link token is not a Score Link token'
);

select lives_ok(
  $$select public.team_tally_score_game((select value from tt_ids where key = 'token_ben'),
      (select value::uuid from tt_ids where key = 'm1_r1_captains'), 11, 8)$$,
  'a Score Link scores a Game in its own Matchup'
);
select lives_ok(
  $$select public.team_tally_score_game((select value from tt_ids where key = 'token_fed'),
      (select value::uuid from tt_ids where key = 'm1_r1_teammates'), 9, 11)$$,
  'the other Team''s Score Link scores a Game in the same Matchup'
);
select throws_ok(
  $$select public.team_tally_score_game((select value from tt_ids where key = 'token_ben'),
      (select value::uuid from tt_ids where key = 'm2_r1_captains'), 11, 4)$$,
  '42501',
  'That Game isn''t in your Matchup.',
  'a Score Link cannot score another Matchup''s Game'
);
select throws_ok(
  $$select public.team_tally_score_game((select value from tt_ids where key = 'token_ben'),
      (select value::uuid from tt_ids where key = 'm1_r2_captains'), 13, 9)$$,
  '22023',
  '13-9 can''t happen: the game ends at 11-9',
  'an impossible score is refused with the reason'
);
select throws_ok(
  $$select public.team_tally_score_game((select value from tt_ids where key = 'token_ben'),
      (select value::uuid from tt_ids where key = 'm1_r2_captains'), 10, 14)$$,
  '22023',
  '10-14 can''t happen: the game ends at 10-12',
  'the reason keeps the sides as typed'
);
select throws_ok(
  $$select public.team_tally_score_game('not-the-token-not-the-token-not-the-token',
      (select value::uuid from tt_ids where key = 'm1_r2_captains'), 11, 9)$$,
  '42501',
  null,
  'a wrong token scores nothing'
);
select lives_ok(
  $$select public.team_tally_score_game((select value from tt_ids where key = 'token_ben'),
      (select value::uuid from tt_ids where key = 'm1_r2_captains'), 12, 11)$$,
  'a time-capped 12-11 saves'
);
select lives_ok(
  $$select public.team_tally_score_game((select value from tt_ids where key = 'token_ben'),
      (select value::uuid from tt_ids where key = 'm1_r2_teammates'), 9, 9)$$,
  'a tie saves'
);
-- Federico's captain corrects a Game Ben's captain entered.
select lives_ok(
  $$select public.team_tally_score_game((select value from tt_ids where key = 'token_fed'),
      (select value::uuid from tt_ids where key = 'm1_r1_captains'), 11, 9)$$,
  'either Team corrects a Game in its Matchup'
);

select is(
  (select g ->> 'redScore' || '-' || (g ->> 'blueScore') || ' ' || (g ->> 'lastEditedByKind') || ' ' || (g ->> 'lastEditedByTeamId')
   from jsonb_array_elements(
     public.team_tally_public_event((select value from tt_ids where key = 'public_token')) -> 'matchups' -> 0 -> 'games'
   ) as g
   where g ->> 'id' = (select value from tt_ids where key = 'm1_r1_captains')),
  '11-9 team ' || (select value from tt_ids where key = 'team_fed'),
  'the Public Link shows the corrected score and the Team that last edited it'
);

-- Slots. Round 1 and Round 2 have scores now; Round 3 does not.
select lives_ok(
  $$select public.team_tally_set_slots((select value from tt_ids where key = 'token_ben'),
      'Anna Leigh Waters', 'Collin Johns', 'Tyra Black')$$,
  'a Score Link renames a slot whose Round has no score'
);
select throws_ok(
  $$select public.team_tally_set_slots((select value from tt_ids where key = 'token_ben'),
      'Lea Jansen', 'Collin Johns', 'Tyra Black')$$,
  '22023',
  'Round 1 already has a score, so Player A stays Anna Leigh Waters.',
  'a rename of a scored Round''s slot is refused'
);
select throws_ok(
  $$select public.team_tally_set_slots((select value from tt_ids where key = 'token_ben'),
      'Anna Leigh Waters', 'Tyra Black', 'Collin Johns')$$,
  '22023',
  'Round 2 already has a score, so Player B stays Collin Johns.',
  'a reorder that moves a scored Round is refused'
);
select throws_ok(
  $$select public.team_tally_set_slots((select value from tt_ids where key = 'token_ben'),
      'Anna Leigh Waters', 'Collin Johns', '  ')$$,
  '22023',
  'Player C needs a name.',
  'a slot cannot be left without a name'
);
select throws_ok(
  $$select public.team_tally_set_slots('not-the-token-not-the-token-not-the-token', 'A', 'B', 'C')$$,
  '42501',
  null,
  'a wrong token edits no slots'
);

select throws_ok(
  $$select public.team_tally_organizer_score_game((select value::uuid from tt_ids where key = 'm1_r3_captains'), 11, 2)$$,
  '42501',
  null,
  'anon cannot score as the Organizer'
);
select throws_ok(
  $$select count(*) from public.team_tally_games$$,
  '42501',
  null,
  'a Score Link holder still has no table access'
);

reset role;

select is(
  (select name from public.team_tally_player_slots
   where team_id = (select value::uuid from tt_ids where key = 'team_ben') and position = 'C'),
  'Tyra Black',
  'the rename is saved'
);
select is(
  (select red_score || '-' || blue_score from public.team_tally_games where id = (select value::uuid from tt_ids where key = 'm1_r2_captains')),
  '12-11',
  'a refused score leaves the Game as it was'
);
select is(
  (select last_edited_by_team_id::text from public.team_tally_games where id = (select value::uuid from tt_ids where key = 'm1_r2_captains')),
  (select value from tt_ids where key = 'team_ben'),
  'each write records the Team that made it'
);
select ok(
  (select count(*) > 0 from realtime.messages
   where topic = 'team-tally:' || (select value from tt_ids where key = 'event')
     and event = 'changed'
     and private = false),
  'a score change broadcasts on the Team Event''s topic'
);
select is(
  (select count(*)::int from realtime.messages
   where topic = 'team-tally:' || (select value from tt_ids where key = 'event')
     and (payload - 'id') <> '{}'::jsonb),
  0,
  'the broadcast carries no data, only that something changed'
);

-- ---- the Organizer ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "23232323-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(
  public.team_tally_organizer_event((select value::uuid from tt_ids where key = 'event')) ->> 'name',
  'Tuesday Team Night',
  'the Organizer reads their running Team Event'
);
select lives_ok(
  $$select public.team_tally_organizer_score_game((select value::uuid from tt_ids where key = 'm2_r1_captains'), 11, 6)$$,
  'the Organizer scores any Matchup''s Game'
);
select is(
  (select coalesce(last_edited_by_kind, '') || coalesce(last_edited_by_team_id::text, '') from public.team_tally_games
   where id = (select value::uuid from tt_ids where key = 'm2_r1_captains')),
  'organizer',
  'an Organizer''s score is recorded as the Organizer''s'
);
select throws_ok(
  $$select public.team_tally_organizer_score_game((select value::uuid from tt_ids where key = 'm2_r1_captains'), 15, 7)$$,
  '22023',
  '15-7 can''t happen: the game ends at 11-7',
  'the Organizer cannot save an impossible score either'
);
select throws_ok(
  $$update public.team_tally_games set red_score = 14, blue_score = 10
    where id = (select value::uuid from tt_ids where key = 'm2_r1_captains')$$,
  '23514',
  null,
  'nor write one straight to the table'
);
select lives_ok(
  $$select public.team_tally_organizer_set_slots((select value::uuid from tt_ids where key = 'team_hay'),
      'Tyra Black', 'Lea Jansen', 'Gabriel Tardio')$$,
  'the Organizer reorders another Team''s unscored Rounds'
);
select throws_ok(
  $$select public.team_tally_organizer_set_slots((select value::uuid from tt_ids where key = 'team_hay'),
      'Gabriel Tardio', 'Tyra Black', 'Lea Jansen')$$,
  '22023',
  'Round 1 already has a score, so Player A stays Tyra Black.',
  'the Organizer cannot move a scored Round either'
);

-- ---- another User ----------------------------------------------------------------
set local request.jwt.claims = '{"sub": "23232323-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is(
  public.team_tally_organizer_event((select value::uuid from tt_ids where key = 'event')),
  null,
  'another User cannot read A''s running Team Event'
);
select throws_ok(
  $$select public.team_tally_organizer_score_game((select value::uuid from tt_ids where key = 'm2_r1_captains'), 11, 0)$$,
  'P0002',
  null,
  'another User cannot score A''s Games'
);

select * from finish();

rollback;

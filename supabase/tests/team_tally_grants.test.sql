-- Team Tally: who may call which function (PR #629 review). What this pins
-- down:
--
--   * a link holder (anon) calls only the token functions: the two reads, a
--     score, a roster, Matchup done and the Dreambreaker;
--   * a signed-in User calls those and the Organizer's functions;
--   * nobody calls an internal helper or a trigger function directly. They
--     are SECURITY DEFINER and trust their caller to have checked who may
--     write, so a grant on one would be a way round every token check.
--
-- Exhaustive on purpose: a new team_tally_ function fails the count below
-- until it is listed here with the roles it is meant for.

begin;

create extension if not exists pgtap with schema extensions;

select plan(71);

create temporary table tt_expected (fn text, args text[], anon boolean, signed_in boolean) on commit drop;
insert into tt_expected values
  -- Link holders and signed-in Users.
  ('team_tally_public_event', array['text'], true, true),
  ('team_tally_score_link_event', array['text'], true, true),
  ('team_tally_score_game', array['text', 'uuid', 'integer', 'integer'], true, true),
  ('team_tally_set_slots', array['text', 'text', 'text', 'text'], true, true),
  ('team_tally_mark_done', array['text', 'uuid'], true, true),
  ('team_tally_set_dreambreaker', array['text', 'uuid', 'uuid'], true, true),
  ('team_tally_score_problem', array['integer', 'integer'], true, true),
  -- The signed-in Organizer.
  ('team_tally_save_event', array['uuid', 'text', 'date', 'jsonb', 'jsonb'], false, true),
  ('team_tally_owns_event', array['uuid'], false, true),
  ('team_tally_organizer_event', array['uuid'], false, true),
  ('team_tally_organizer_score_game', array['uuid', 'integer', 'integer'], false, true),
  ('team_tally_organizer_set_slots', array['uuid', 'text', 'text', 'text'], false, true),
  ('team_tally_organizer_mark_done', array['uuid'], false, true),
  ('team_tally_organizer_reopen', array['uuid'], false, true),
  ('team_tally_organizer_set_dreambreaker', array['uuid', 'uuid'], false, true),
  ('team_tally_organizer_seed_now', array['uuid'], false, true),
  ('team_tally_organizer_set_tie_order', array['uuid', 'uuid[]'], false, true),
  ('team_tally_organizer_swap_flight_courts', array['uuid', 'uuid'], false, true),
  ('team_tally_organizer_put_ahead', array['uuid', 'uuid'], false, true),
  -- Internal.
  ('team_tally_event_doc', array['uuid'], false, false),
  ('team_tally_team_for_token', array['text'], false, false),
  ('team_tally_team_in_matchup', array['text', 'uuid'], false, false),
  ('team_tally_write_score', array['uuid', 'integer', 'integer', 'uuid'], false, false),
  ('team_tally_write_slots', array['uuid', 'text', 'text', 'text'], false, false),
  ('team_tally_write_dreambreaker', array['uuid', 'uuid'], false, false),
  ('team_tally_finish_matchup', array['uuid', 'uuid'], false, false),
  ('team_tally_seed_flights', array['uuid'], false, false),
  ('team_tally_seed_order', array['uuid'], false, false),
  ('team_tally_seed_keys', array['uuid'], false, false),
  ('team_tally_lock_event', array['uuid'], false, false),
  ('team_tally_done_problem', array['uuid'], false, false),
  ('team_tally_owns_matchup', array['uuid'], false, false),
  ('team_tally_games_done_lock', array[]::text[], false, false),
  ('team_tally_player_slots_done_lock', array[]::text[], false, false),
  ('team_tally_broadcast_change', array[]::text[], false, false);

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'team\_tally\_%'),
  (select count(*)::int from tt_expected),
  'every Team Tally function is listed here with the roles it is for'
);

select function_privs_are(
  'public', e.fn, e.args, 'anon',
  case when e.anon then array['EXECUTE'] else array[]::text[] end,
  format('%s: anon %s', e.fn, case when e.anon then 'may call it' else 'holds no grant' end)
)
from tt_expected e
order by e.fn;

select function_privs_are(
  'public', e.fn, e.args, 'authenticated',
  case when e.signed_in then array['EXECUTE'] else array[]::text[] end,
  format('%s: a signed-in User %s', e.fn, case when e.signed_in then 'may call it' else 'holds no grant' end)
)
from tt_expected e
order by e.fn;

select * from finish();

rollback;

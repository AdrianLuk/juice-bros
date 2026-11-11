-- Mic Drop: who can reach what (spec #666). What this pins down:
--
--   * `anon` has no table access at all, and reaches a Poll only through the
--     two Guest Link functions;
--   * a signed-in account can't read the allowlist or any Vote row, can't
--     write a table directly, and can't host unless it is on the allowlist;
--   * a Host reads only their own Polls and Contestants;
--   * nobody calls an internal helper or the trigger function directly. They
--     are SECURITY DEFINER and trust their caller to have checked who may
--     write, so a grant on one would be a way round every check.
--
-- Names are PPA Tour pros: this repo is public.

begin;

create extension if not exists pgtap with schema extensions;

select plan(46);

select has_table('public', 'mic_drop_hosts', 'the Host allowlist is a table');
select has_table('public', 'mic_drop_polls', 'Polls are a table');
select has_table('public', 'mic_drop_contestants', 'Contestants are a table');
select has_table('public', 'mic_drop_votes', 'Votes are a table');

insert into auth.users (id, instance_id, aud, role, email) values
  ('33333333-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'md-host-a@example.com'),
  ('33333333-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'md-host-b@example.com'),
  ('33333333-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'md-not-a-host@example.com');

insert into public.mic_drop_hosts (user_id) values
  ('33333333-0000-0000-0000-00000000000a'),
  ('33333333-0000-0000-0000-00000000000b');

-- Somewhere to keep ids across role switches.
create temporary table md_ids (key text primary key, value text) on commit drop;
grant select, insert on md_ids to authenticated, anon;

-- ---- as Host A ---------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-0000-0000-0000-00000000000a", "role": "authenticated"}';

insert into md_ids select 'poll', public.mic_drop_create_poll('Karaoke Night') ->> 'id';
insert into md_ids select 'token', guest_token from public.mic_drop_polls;
insert into md_ids
select 'contestant', public.mic_drop_add_contestant((select value::uuid from md_ids where key = 'poll'), 'Ben Johns')::text;

select is((select count(*)::int from public.mic_drop_polls), 1, 'a Host reads their own Poll');

-- ---- as Host B -----------------------------------------------------------------
set local request.jwt.claims = '{"sub": "33333333-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is((select count(*)::int from public.mic_drop_polls), 0, 'another Host can''t read A''s Poll');
select is((select count(*)::int from public.mic_drop_contestants), 0, 'another Host can''t read A''s Contestants');

-- ---- as a signed-in account that isn't a Host ------------------------------------
set local request.jwt.claims = '{"sub": "33333333-0000-0000-0000-00000000000c", "role": "authenticated"}';

select throws_ok(
  $$select count(*) from public.mic_drop_hosts$$,
  '42501', null, 'a signed-in account can''t read the Host allowlist'
);
select throws_ok(
  $$select count(*) from public.mic_drop_votes$$,
  '42501', null, 'a signed-in account can''t read Vote rows'
);
select throws_ok(
  $$insert into public.mic_drop_polls (owner_id, name)
    values ('33333333-0000-0000-0000-00000000000c', 'Planted')$$,
  '42501', null, 'a signed-in account can''t write a Poll directly'
);
select throws_ok(
  $$select public.mic_drop_create_poll('Karaoke Night')$$,
  '42501', 'This account can''t host Mic Drop Polls.', 'an account off the allowlist can''t create a Poll'
);
select throws_ok(
  $$select public.mic_drop_host_poll((select value::uuid from md_ids where key = 'poll'))$$,
  '42501', null, 'a signed-in account can''t call the internal Host helper'
);

-- ---- as anon, holding the Guest Link ----------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok($$select count(*) from public.mic_drop_hosts$$, '42501', null, 'anon has no access to the Host allowlist');
select throws_ok($$select count(*) from public.mic_drop_polls$$, '42501', null, 'anon has no access to the Poll table');
select throws_ok($$select count(*) from public.mic_drop_contestants$$, '42501', null, 'anon has no access to the Contestant table');
select throws_ok($$select count(*) from public.mic_drop_votes$$, '42501', null, 'anon has no access to the Vote table');
select throws_ok(
  $$select public.mic_drop_create_poll('Karaoke Night')$$,
  '42501', null, 'anon can''t call a Host function'
);
select is(
  public.mic_drop_guest_poll((select value from md_ids where key = 'token')) ->> 'name',
  'Karaoke Night',
  'the Guest Link token reads the Poll'
);
select is(
  public.mic_drop_guest_poll('0123456789abcdef0123456789abcdef'),
  null,
  'a wrong Guest Link token reads as no Poll'
);

-- ---- who may execute what ------------------------------------------------------------
reset role;

-- Exhaustive on purpose, like team_tally_grants.test.sql: a new mic_drop_
-- function fails the count below until it is listed here with its roles.
create temporary table md_expected (fn text, args text[], anon boolean, signed_in boolean) on commit drop;
insert into md_expected values
  -- Guest Link holders and signed-in accounts.
  ('mic_drop_guest_poll', array['text', 'text'], true, true),
  ('mic_drop_cast_vote', array['text', 'text', 'uuid'], true, true),
  -- Signed-in accounts (the functions check the allowlist themselves).
  ('mic_drop_is_host', array[]::text[], false, true),
  ('mic_drop_create_poll', array['text'], false, true),
  ('mic_drop_add_contestant', array['uuid', 'text'], false, true),
  ('mic_drop_remove_contestant', array['uuid'], false, true),
  ('mic_drop_set_open', array['uuid', 'boolean'], false, true),
  -- Internal.
  ('mic_drop_require_host', array[]::text[], false, false),
  ('mic_drop_host_poll', array['uuid'], false, false),
  ('mic_drop_open_host_poll', array['uuid'], false, false),
  ('mic_drop_clean_name', array['text', 'text'], false, false),
  ('mic_drop_guest_uuid', array['text'], false, false),
  ('mic_drop_broadcast_change', array[]::text[], false, false);

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'mic\_drop\_%'),
  (select count(*)::int from md_expected),
  'every Mic Drop function is listed here with the roles it is for'
);

select function_privs_are(
  'public', e.fn, e.args, 'anon',
  case when e.anon then array['EXECUTE'] else array[]::text[] end,
  format('%s: anon %s', e.fn, case when e.anon then 'may call it' else 'holds no grant' end)
)
from md_expected e
order by e.fn;

select function_privs_are(
  'public', e.fn, e.args, 'authenticated',
  case when e.signed_in then array['EXECUTE'] else array[]::text[] end,
  format('%s: a signed-in account %s', e.fn, case when e.signed_in then 'may call it' else 'holds no grant' end)
)
from md_expected e
order by e.fn;

select * from finish();

rollback;

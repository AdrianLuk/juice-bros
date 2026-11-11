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

select plan(25);

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
  '42501', 'This account can''t host Mic Drop polls.', 'an account off the allowlist can''t create a Poll'
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

select ok(has_function_privilege('anon', 'public.mic_drop_guest_poll(text, text)', 'execute'), 'anon can read a Poll by token');
select ok(has_function_privilege('anon', 'public.mic_drop_cast_vote(text, text, uuid)', 'execute'), 'anon can vote by token');
select ok(not has_function_privilege('anon', 'public.mic_drop_add_contestant(uuid, text)', 'execute'), 'anon can''t add a Contestant');
select ok(not has_function_privilege('anon', 'public.mic_drop_set_open(uuid, boolean)', 'execute'), 'anon can''t close a Poll');
select ok(not has_function_privilege('authenticated', 'public.mic_drop_guest_uuid(text)', 'execute'), 'nobody calls the Guest id helper directly');
select ok(not has_function_privilege('authenticated', 'public.mic_drop_broadcast_change()', 'execute'), 'nobody calls the broadcast trigger function directly');

select * from finish();

rollback;

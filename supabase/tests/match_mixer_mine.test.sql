-- Match Mixer: My Mixers (#691). What this pins down, where the TS db-tests
-- can't reach (no API role can add a superadmin):
--
--   * an organizer's list is their own Live Mixers, newest first, with the
--     clock's finish showing on an old night;
--   * another organizer's nights are never in it;
--   * a superadmin's list is every Live Mixer;
--   * signed out, and the anon role itself, can't call it.
--
-- Names are PPA Tour pros: this repo is public.

begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

select has_function('public', 'match_mixer_my_mixers', array[]::text[], 'My Mixers is one function');

insert into auth.users (id, instance_id, aud, role, email) values
  ('69169169-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mm-mine-owner@example.com'),
  ('69169169-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mm-mine-superadmin@example.com'),
  ('69169169-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mm-mine-someone@example.com');

insert into public.match_mixer_superadmins (user_id) values ('69169169-0000-0000-0000-00000000000b');

-- Ben Johns ran one three days ago and one an hour ago; Anna Leigh Waters ran
-- one two days ago.
insert into public.match_mixer_live_mixers (config, organizer_token, player_token, owner_id, went_live_at) values
  ('a board', 'mine-organizer0000000000000000a1', 'mine-player0000000000000000000a1', '69169169-0000-0000-0000-00000000000a', now() - interval '3 days'),
  ('a board', 'mine-organizer0000000000000000a2', 'mine-player0000000000000000000a2', '69169169-0000-0000-0000-00000000000a', now() - interval '1 hour'),
  ('a board', 'mine-organizer0000000000000000c1', 'mine-player0000000000000000000c1', '69169169-0000-0000-0000-00000000000c', now() - interval '2 days');

-- ---- grants ---------------------------------------------------------------------
select is(has_function_privilege('anon', 'public.match_mixer_my_mixers()', 'execute'), false, 'the anon role can''t call it');
select is(has_function_privilege('authenticated', 'public.match_mixer_my_mixers()', 'execute'), true, 'a signed-in role can');

-- ---- signed out -------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok($$select public.match_mixer_my_mixers()$$, '42501', null, 'signed out, My Mixers is refused');

-- ---- the organizer ------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "69169169-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(jsonb_array_length(public.match_mixer_my_mixers()), 2, 'the organizer sees their two nights');
select is(
  public.match_mixer_my_mixers() -> 0 ->> 'organizerToken',
  'mine-organizer0000000000000000a2',
  'the newest first, with the Organizer Link''s token to open it'
);
select is(public.match_mixer_my_mixers() -> 0 ->> 'finishedAt', null, 'an hour in, the night is still running');
select isnt(
  public.match_mixer_my_mixers() -> 1 ->> 'finishedAt',
  null,
  'three days on, the clock has finished it'
);
select is(
  (select count(*) from jsonb_array_elements(public.match_mixer_my_mixers()) night
   where night ->> 'organizerToken' = 'mine-organizer0000000000000000c1'),
  0::bigint,
  'and another organizer''s night is not in it'
);

-- ---- someone who isn't a superadmin sees only theirs --------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "69169169-0000-0000-0000-00000000000c", "role": "authenticated"}';

select is(jsonb_array_length(public.match_mixer_my_mixers()), 1, 'another organizer sees only their own night');

-- ---- the superadmin ------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "69169169-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is(
  (select count(*) from jsonb_array_elements(public.match_mixer_my_mixers()) night
   where night ->> 'organizerToken' in (
     'mine-organizer0000000000000000a1',
     'mine-organizer0000000000000000a2',
     'mine-organizer0000000000000000c1'
   )),
  3::bigint,
  'a superadmin sees every organizer''s nights'
);

select * from finish();

rollback;

-- Match Mixer: the 12-hour auto-finish and the superadmin (#690). What this
-- pins down, where the TS db-tests can't reach (no API role can backdate a
-- Live Mixer or add a superadmin):
--
--   * a Live Mixer 12 hours past going live reads as finished through either
--     link and refuses every write, with nobody having tapped Finish Mixer;
--   * a signed-in superadmin on either link runs the night as the Organizer
--     Link does, finished or not, and still never sees the Organizer Link's
--     token through the Player Link;
--   * nobody else reaches the superadmin list or its check.
--
-- Names are PPA Tour pros: this repo is public.

begin;

create extension if not exists pgtap with schema extensions;

select plan(26);

select has_table('public', 'match_mixer_superadmins', 'the superadmins are a table');

insert into auth.users (id, instance_id, aud, role, email) values
  ('69069069-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mm-owner@example.com'),
  ('69069069-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mm-superadmin@example.com'),
  ('69069069-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mm-someone@example.com');

insert into public.match_mixer_superadmins (user_id) values ('69069069-0000-0000-0000-00000000000b');

-- Ben Johns's night: went live 11 hours 50 minutes ago.
insert into public.match_mixer_live_mixers (id, config, organizer_token, player_token, owner_id, went_live_at) values (
  '69069069-1111-0000-0000-000000000001',
  'a board',
  'organizer0000000000000000000000a',
  'player000000000000000000000000a',
  '69069069-0000-0000-0000-00000000000a',
  now() - interval '11 hours 50 minutes'
);

-- ---- signed out, before the 12 hours ------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  public.match_mixer_live_mixer('player000000000000000000000000a') ->> 'finishedAt',
  null,
  'at 11 hours 50 minutes the night is still running'
);
select is(
  (public.match_mixer_live_mixer('player000000000000000000000000a') ->> 'superadmin')::boolean,
  false,
  'and a signed-out link isn''t a superadmin'
);
select lives_ok(
  $$select public.match_mixer_append('organizer0000000000000000000000a', 'score_entered', '{"round": 0, "court": 0, "score": [11, 7]}')$$,
  'and the Organizer Link scores'
);
select throws_ok(
  $$select count(*) from public.match_mixer_superadmins$$,
  '42501', null, 'signed out, the superadmin list is shut'
);
select throws_ok(
  $$select public.match_mixer_is_superadmin()$$,
  '42501', null, 'and so is its check'
);

-- ---- signed out, past the 12 hours --------------------------------------------
reset role;
update public.match_mixer_live_mixers
set went_live_at = now() - interval '12 hours 10 minutes'
where id = '69069069-1111-0000-0000-000000000001';
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  (public.match_mixer_live_mixer('organizer0000000000000000000000a') ->> 'finishedAt')::timestamptz,
  now() - interval '10 minutes',
  'past 12 hours the Organizer Link reads it finished, at the 12-hour mark, with nobody tapping'
);
select isnt(
  public.match_mixer_live_mixer('player000000000000000000000000a') ->> 'finishedAt',
  null,
  'and so does the Player Link'
);
select throws_ok(
  $$select public.match_mixer_append('organizer0000000000000000000000a', 'score_entered', '{"round": 0, "court": 1, "score": [11, 7]}')$$,
  '55000', null, 'the Organizer Link can''t score'
);
select throws_ok(
  $$select public.match_mixer_append('organizer0000000000000000000000a', 'round_started', '{"round": 1}')$$,
  '55000', null, 'or start a Round'
);
select throws_ok(
  $$select public.match_mixer_append('organizer0000000000000000000000a', 'game_rule_changed', '{"to": 21, "winBy": 2}')$$,
  '55000', null, 'or change the Game Rule'
);
select throws_ok(
  $$select public.match_mixer_append('player000000000000000000000000a', 'score_cleared', '{"round": 0, "court": 0}')$$,
  '55000', null, 'and the Player Link can''t clear a score'
);

-- ---- signed in, not a superadmin ---------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "69069069-0000-0000-0000-00000000000c", "role": "authenticated"}';

select is(
  (public.match_mixer_live_mixer('player000000000000000000000000a') ->> 'superadmin')::boolean,
  false,
  'a signed-in account that isn''t a superadmin reads the Player Link as a player'
);
select throws_ok(
  $$select public.match_mixer_append('player000000000000000000000000a', 'round_started', '{"round": 1}')$$,
  '42501', null, 'and can''t start a Round with it'
);
select throws_ok(
  $$select public.match_mixer_append('organizer0000000000000000000000a', 'score_entered', '{"round": 0, "court": 1, "score": [11, 7]}')$$,
  '55000', null, 'or score on a finished night with the Organizer Link'
);
select throws_ok(
  $$select count(*) from public.match_mixer_superadmins$$,
  '42501', null, 'signed in, the superadmin list is shut'
);

-- ---- the superadmin, through the Player Link, on a finished night ------------
set local request.jwt.claims = '{"sub": "69069069-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is(
  (public.match_mixer_live_mixer('player000000000000000000000000a') ->> 'superadmin')::boolean,
  true,
  'the superadmin reads the Player Link as a superadmin'
);
select is(
  public.match_mixer_live_mixer('player000000000000000000000000a') ->> 'role',
  'player',
  'still knowing which link it is'
);
select unalike(
  public.match_mixer_live_mixer('player000000000000000000000000a')::text,
  '%organizer0000000000000000000000a%',
  'and never handed the Organizer Link''s token'
);
select lives_ok(
  $$select public.match_mixer_append('player000000000000000000000000a', 'round_started', '{"round": 1}')$$,
  'the superadmin starts a Round on a finished night'
);
select lives_ok(
  $$select public.match_mixer_append('player000000000000000000000000a', 'game_rule_changed', '{"to": 15, "winBy": 2}')$$,
  'changes the Game Rule'
);
select lives_ok(
  $$select public.match_mixer_append('player000000000000000000000000a', 'score_entered', '{"round": 3, "court": 0, "score": [15, 9]}')$$,
  'and scores any Game in any Round'
);
select lives_ok(
  $$select public.match_mixer_append('player000000000000000000000000a', 'finished', '{"note": "dropped"}')$$,
  'and taps Finish Mixer'
);

reset role;
select is(
  (select payload from public.match_mixer_events
   where live_mixer_id = '69069069-1111-0000-0000-000000000001' and kind = 'finished'),
  '{}'::jsonb,
  'which records a finished event, its payload rebuilt rather than kept'
);
select isnt(
  (select finished_at from public.match_mixer_live_mixers where id = '69069069-1111-0000-0000-000000000001'),
  null,
  'and stamps finished_at'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "69069069-0000-0000-0000-00000000000b", "role": "authenticated"}';
select lives_ok(
  $$select public.match_mixer_append('organizer0000000000000000000000a', 'score_cleared', '{"round": 0, "court": 0}')$$,
  'after Finish Mixer the superadmin still fixes a score'
);

select * from finish();

rollback;

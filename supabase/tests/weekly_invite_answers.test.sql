-- Answering from the Weekly Invite with no sign-in (issue #580, ADR 0022).
-- What this proves:
--
--   * `weekly_invite_links` is service_role-only: no session can read a token;
--   * a link can only be minted for one of the Standing Game's Regulars;
--   * reading a link never writes, and says whether the game has started;
--   * a token answers exactly one Slot as exactly one User: its own Regular's
--     Response, changeable, regardless of that Regular's Visibility;
--   * the token is dead once the Slot starts, once the Slot is deleted, and
--     once the Regular stops being the organizer's Connection;
--   * a yes through the link joins the Regulars like any other yes.

begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

select has_table('public', 'weekly_invite_links', 'weekly_invite_links table exists');
select ok(
  not has_table_privilege('authenticated', 'public.weekly_invite_links', 'select')
    and not has_table_privilege('anon', 'public.weekly_invite_links', 'select'),
  'no session can read a weekly invite token'
);
select ok(
  not has_function_privilege('authenticated', 'public.answer_weekly_invite(uuid, public.response_answer)', 'execute')
    and not has_function_privilege('anon', 'public.answer_weekly_invite(uuid, public.response_answer)', 'execute'),
  'only the service role can answer through a token'
);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000580', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy-answers@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000580', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben-answers@example.com'),
  ('cccccccc-0000-0000-0000-000000000580', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal-answers@example.com');

insert into public.connections (requester_id, addressee_id, status) values
  ('aaaaaaaa-0000-0000-0000-000000000580', 'bbbbbbbb-0000-0000-0000-000000000580', 'accepted'),
  ('cccccccc-0000-0000-0000-000000000580', 'aaaaaaaa-0000-0000-0000-000000000580', 'accepted');

-- Amy hides her games from Ben: an override of `none` on their Connection.
insert into public.visibility_overrides (connection_id, owner_id, level)
select id, 'aaaaaaaa-0000-0000-0000-000000000580', 'none'
from public.connections
where requester_id = 'aaaaaaaa-0000-0000-0000-000000000580'
  and addressee_id = 'bbbbbbbb-0000-0000-0000-000000000580';

insert into public.standing_games (id, owner_id, weekday, start_hour, end_hour, time_zone)
values ('66666666-0000-0000-0000-000000000580', 'aaaaaaaa-0000-0000-0000-000000000580', 2, 20, 22, 'America/Toronto');

-- 2031-10-28 and 2031-11-04 are Tuesdays.
do $$
begin
  perform public.post_standing_game_week('66666666-0000-0000-0000-000000000580', '2031-10-28');
  perform public.post_standing_game_week('66666666-0000-0000-0000-000000000580', '2031-11-04');
end;
$$;

insert into public.standing_game_regulars (standing_game_id, user_id)
values ('66666666-0000-0000-0000-000000000580', 'bbbbbbbb-0000-0000-0000-000000000580');

-- Ben's link to the Oct 28 game, with a known token.
insert into public.weekly_invite_links (slot_id, user_id, token)
select id, 'bbbbbbbb-0000-0000-0000-000000000580', '11111111-0000-0000-0000-000000000580'
from public.slots
where standing_game_id = '66666666-0000-0000-0000-000000000580'
  and proposed_start = '2031-10-28 20:00 America/Toronto';

select throws_ok(
  $$insert into public.weekly_invite_links (slot_id, user_id)
    select id, 'cccccccc-0000-0000-0000-000000000580' from public.slots
    where standing_game_id = '66666666-0000-0000-0000-000000000580' limit 1$$,
  '23514',
  null,
  'a link is never minted for someone who is not a Regular'
);

select is(
  (select state from public.read_weekly_invite('11111111-0000-0000-0000-000000000580')),
  'open',
  'a fresh link reads as open'
);
select is(
  (select count(*)::int from public.read_weekly_invite('99999999-0000-0000-0000-000000000580')),
  0,
  'an unknown token reads as nothing'
);
select is(
  (select count(*)::int from public.responses where user_id = 'bbbbbbbb-0000-0000-0000-000000000580'),
  0,
  'reading a link writes no Response'
);

select is(
  public.answer_weekly_invite('11111111-0000-0000-0000-000000000580', 'maybe'),
  'answered',
  'a Regular who cannot see the organizer''s games still answers through their link'
);
select is(
  (select answer::text from public.responses r
   join public.slots s on s.id = r.slot_id
   where r.user_id = 'bbbbbbbb-0000-0000-0000-000000000580'
     and s.proposed_start = '2031-10-28 20:00 America/Toronto'),
  'maybe',
  'the answer is the Regular''s own User Response, not a Guest one'
);
select is(
  (select count(*)::int from public.responses r
   join public.slots s on s.id = r.slot_id
   where s.standing_game_id = '66666666-0000-0000-0000-000000000580' and r.guest_name is not null),
  0,
  'no Guest Response is recorded'
);

select is(
  public.answer_weekly_invite('11111111-0000-0000-0000-000000000580', 'yes'),
  'answered',
  'the same link changes the answer'
);
select is(
  (select array_agg(r.answer::text) from public.responses r
   where r.user_id = 'bbbbbbbb-0000-0000-0000-000000000580'),
  array['yes'],
  'changing the answer updates the one Response in place'
);
select is(
  (select count(*)::int from public.responses r
   join public.slots s on s.id = r.slot_id
   where s.proposed_start = '2031-11-04 20:00 America/Toronto'),
  0,
  'the token never answers the Standing Game''s other game'
);
select is(
  (select count(*)::int from public.responses r
   join public.slots s on s.id = r.slot_id
   where s.standing_game_id = '66666666-0000-0000-0000-000000000580'
     and r.user_id is distinct from 'bbbbbbbb-0000-0000-0000-000000000580'),
  0,
  'the token never answers as any other User'
);
select ok(
  exists (
    select 1 from public.standing_game_regulars
    where standing_game_id = '66666666-0000-0000-0000-000000000580'
      and user_id = 'bbbbbbbb-0000-0000-0000-000000000580'
  ),
  'a yes through the link keeps the answerer a Regular'
);

select is(
  public.answer_weekly_invite('99999999-0000-0000-0000-000000000580', 'yes'),
  'invalid',
  'an unknown token answers nothing'
);

-- The game starts.
update public.slots
set proposed_start = now() - interval '1 minute', proposed_end = now() + interval '1 hour'
where id = (select slot_id from public.weekly_invite_links where token = '11111111-0000-0000-0000-000000000580');

select is(
  (select state from public.read_weekly_invite('11111111-0000-0000-0000-000000000580')),
  'started',
  'a link to a game that has started reads as started'
);
select is(
  public.answer_weekly_invite('11111111-0000-0000-0000-000000000580', 'no'),
  'started',
  'once the game starts the token changes nothing'
);

-- Back to the future, then Amy unfriends Ben.
update public.slots
set proposed_start = '2031-10-28 20:00 America/Toronto', proposed_end = '2031-10-28 22:00 America/Toronto'
where id = (select slot_id from public.weekly_invite_links where token = '11111111-0000-0000-0000-000000000580');
delete from public.connections
where requester_id = 'aaaaaaaa-0000-0000-0000-000000000580'
  and addressee_id = 'bbbbbbbb-0000-0000-0000-000000000580';

select is(
  public.answer_weekly_invite('11111111-0000-0000-0000-000000000580', 'no'),
  'invalid',
  'once the Regular is no longer a Connection the token is dead'
);

-- The week is skipped: the Slot is deleted.
delete from public.slots
where id = (select slot_id from public.weekly_invite_links where token = '11111111-0000-0000-0000-000000000580');

select is(
  (select count(*)::int from public.weekly_invite_links where token = '11111111-0000-0000-0000-000000000580'),
  0,
  'deleting the game deletes its links'
);

select * from finish();

rollback;

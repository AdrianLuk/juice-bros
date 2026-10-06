-- BB-1 review fixes (spec #576, migration 20261006160000). What this proves:
--
--   * taking someone off a Standing Game's Regulars kills their Weekly Invite
--     token: the answer page reads nothing, an answer writes nothing, and a
--     yes can't put them back on the list;
--   * "Make this weekly" covers the original one-off game's date: the new
--     Standing Game records it as a week with no Slot and no skip mark, never
--     posts it, and only its owner can do that, only with their own one-off
--     game that hasn't started.

begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000001600', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy-fixes@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000001600', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben-fixes@example.com');

insert into public.connections (requester_id, addressee_id, status) values
  ('aaaaaaaa-0000-0000-0000-000000001600', 'bbbbbbbb-0000-0000-0000-000000001600', 'accepted');

insert into public.standing_games (id, owner_id, weekday, start_hour, end_hour, time_zone)
values ('66666666-0000-0000-0000-000000001600', 'aaaaaaaa-0000-0000-0000-000000001600', 2, 20, 22, 'America/Toronto');

-- 2031-10-28 is a Tuesday.
select public.post_standing_game_week('66666666-0000-0000-0000-000000001600', '2031-10-28');

insert into public.standing_game_regulars (standing_game_id, user_id)
values ('66666666-0000-0000-0000-000000001600', 'bbbbbbbb-0000-0000-0000-000000001600');

insert into public.weekly_invite_links (slot_id, user_id, token)
select id, 'bbbbbbbb-0000-0000-0000-000000001600', '11111111-0000-0000-0000-000000001600'
from public.slots
where standing_game_id = '66666666-0000-0000-0000-000000001600';

select is(
  (select state from public.read_weekly_invite('11111111-0000-0000-0000-000000001600')),
  'open',
  'a Regular''s link opens the game'
);

-- Amy takes Ben off the list.
delete from public.standing_game_regulars
where standing_game_id = '66666666-0000-0000-0000-000000001600'
  and user_id = 'bbbbbbbb-0000-0000-0000-000000001600';

select is(
  (select count(*)::int from public.read_weekly_invite('11111111-0000-0000-0000-000000001600')),
  0,
  'once off the Regulars list, the link reads as nothing'
);
select is(
  public.answer_weekly_invite('11111111-0000-0000-0000-000000001600', 'yes'),
  'invalid',
  'once off the Regulars list, the link answers nothing'
);
select is(
  (select count(*)::int from public.responses where user_id = 'bbbbbbbb-0000-0000-0000-000000001600'),
  0,
  'the dead link wrote no Response'
);
select ok(
  not exists (
    select 1 from public.standing_game_regulars
    where standing_game_id = '66666666-0000-0000-0000-000000001600'
      and user_id = 'bbbbbbbb-0000-0000-0000-000000001600'
  ),
  'a yes through the dead link does not undo the organizer''s removal'
);

-- Amy puts Ben back: the same link works again.
insert into public.standing_game_regulars (standing_game_id, user_id)
values ('66666666-0000-0000-0000-000000001600', 'bbbbbbbb-0000-0000-0000-000000001600');

select is(
  (select state from public.read_weekly_invite('11111111-0000-0000-0000-000000001600')),
  'open',
  'back on the list, the link opens the game again'
);

-- "Make this weekly": Amy's one-off game on Tuesday 2031-11-11, a second
-- Standing Game on Tuesdays, and a one-off of Ben's.
insert into public.slots (id, owner_id, proposed_start, proposed_end, time_zone) values
  ('77777777-0000-0000-0000-000000001600', 'aaaaaaaa-0000-0000-0000-000000001600',
   '2031-11-11 18:00 America/Toronto', '2031-11-11 20:00 America/Toronto', 'America/Toronto'),
  ('77777777-0000-0000-0000-000000001601', 'aaaaaaaa-0000-0000-0000-000000001600',
   '2031-11-13 18:00 America/Toronto', '2031-11-13 20:00 America/Toronto', 'America/Toronto'),
  ('77777777-0000-0000-0000-000000001602', 'bbbbbbbb-0000-0000-0000-000000001600',
   '2031-11-18 18:00 America/Toronto', '2031-11-18 20:00 America/Toronto', 'America/Toronto'),
  ('77777777-0000-0000-0000-000000001603', 'aaaaaaaa-0000-0000-0000-000000001600',
   '2031-11-25 18:00 America/Toronto', '2031-11-25 20:00 America/Toronto', 'America/Toronto');

insert into public.standing_games (id, owner_id, weekday, start_hour, end_hour, time_zone)
values ('66666666-0000-0000-0000-000000001601', 'aaaaaaaa-0000-0000-0000-000000001600', 2, 18, 20, 'America/Toronto');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000001600", "role": "authenticated"}';

select is(
  public.cover_standing_game_date_with_slot('66666666-0000-0000-0000-000000001601', '77777777-0000-0000-0000-000000001600'),
  '2031-11-11'::date,
  'the original game''s date is covered'
);
select is(
  public.cover_standing_game_date_with_slot('66666666-0000-0000-0000-000000001601', '77777777-0000-0000-0000-000000001600'),
  null,
  'covering it again records nothing new'
);
select is(
  public.cover_standing_game_date_with_slot('66666666-0000-0000-0000-000000001601', '77777777-0000-0000-0000-000000001601'),
  null,
  'a game on another weekday covers nothing'
);
select is(
  public.post_standing_game_week('66666666-0000-0000-0000-000000001601', '2031-11-11'),
  null,
  'the covered date never posts a second game'
);
select throws_ok(
  $$select public.cover_standing_game_date_with_slot('66666666-0000-0000-0000-000000001601', '77777777-0000-0000-0000-000000001602')$$,
  '42501',
  null,
  'a friend''s game can''t be used to cover a date'
);
select throws_ok(
  $$select public.cover_standing_game_date_with_slot('66666666-0000-0000-0000-000000001601',
      (select id from public.slots where standing_game_id = '66666666-0000-0000-0000-000000001600'))$$,
  '23514',
  null,
  'a game a Standing Game posted can''t be made weekly'
);

set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000001600", "role": "authenticated"}';
select throws_ok(
  $$select public.cover_standing_game_date_with_slot('66666666-0000-0000-0000-000000001601', '77777777-0000-0000-0000-000000001603')$$,
  '42501',
  null,
  'nobody covers a date on someone else''s Standing Game'
);

reset role;

select is(
  (select row(slot_id, skipped_at) is null
   from public.standing_game_weeks
   where standing_game_id = '66666666-0000-0000-0000-000000001601' and game_date = '2031-11-11'),
  true,
  'the covered week has no Slot and no skip mark'
);
select is(
  (select standing_game_id from public.slots where id = '77777777-0000-0000-0000-000000001600'),
  null,
  'the original game is not adopted'
);

-- The game Amy started from has already begun.
update public.slots
set proposed_start = now() - interval '1 minute', proposed_end = now() + interval '1 hour'
where id = '77777777-0000-0000-0000-000000001603';

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000001600", "role": "authenticated"}';
select is(
  public.cover_standing_game_date_with_slot('66666666-0000-0000-0000-000000001601', '77777777-0000-0000-0000-000000001603'),
  null,
  'a game that has started covers nothing'
);
reset role;

select * from finish();

rollback;

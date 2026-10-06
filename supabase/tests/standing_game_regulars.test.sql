-- Regulars and the Weekly Invite (issue #579). What this proves:
--
--   * a Standing Game's Regulars are owner-only, and only the organizer's
--     accepted Connections can be on the list (never the organizer);
--   * answering yes to one of its posted Slots adds the answerer, from any
--     path that writes `responses`; no and maybe never remove anyone, and a
--     yes to an ordinary Slot adds nobody;
--   * ending the Connection takes the Regular off the list;
--   * the "Weekly game invites" preference defaults on, and
--     `weekly_invite_sends` allows one send per Slot, User and channel.

begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select has_table('public', 'standing_game_regulars', 'standing_game_regulars table exists');
select has_table('public', 'weekly_invite_sends', 'weekly_invite_sends table exists');
select col_default_is(
  'public', 'notification_preferences', 'weekly_invite_enabled', 'true',
  'Weekly game invites defaults on'
);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000579', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy-regulars@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000579', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben-regulars@example.com'),
  ('cccccccc-0000-0000-0000-000000000579', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal-regulars@example.com'),
  ('dddddddd-0000-0000-0000-000000000579', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dee-regulars@example.com');

-- Ben and Cal are Amy's friends (calendar default, so they see her Slots);
-- Dee only has a pending request in.
insert into public.connections (requester_id, addressee_id, status) values
  ('aaaaaaaa-0000-0000-0000-000000000579', 'bbbbbbbb-0000-0000-0000-000000000579', 'accepted'),
  ('cccccccc-0000-0000-0000-000000000579', 'aaaaaaaa-0000-0000-0000-000000000579', 'accepted'),
  ('dddddddd-0000-0000-0000-000000000579', 'aaaaaaaa-0000-0000-0000-000000000579', 'pending');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000579", "role": "authenticated"}';

insert into public.standing_games (id, owner_id, weekday, start_hour, end_hour, time_zone)
values ('66666666-0000-0000-0000-000000000579', 'aaaaaaaa-0000-0000-0000-000000000579', 2, 20, 22, 'America/Toronto');

-- 2031-10-28 is a Tuesday.
select isnt(
  public.post_standing_game_week('66666666-0000-0000-0000-000000000579', '2031-10-28'),
  null,
  'the week posts'
);

insert into public.slots (id, owner_id, proposed_start, proposed_end, time_zone)
values ('77777777-0000-0000-0000-000000000579', 'aaaaaaaa-0000-0000-0000-000000000579',
        '2031-10-30 20:00 America/Toronto', '2031-10-30 22:00 America/Toronto', 'America/Toronto');

select lives_ok(
  $$insert into public.standing_game_regulars (standing_game_id, user_id)
    values ('66666666-0000-0000-0000-000000000579', 'bbbbbbbb-0000-0000-0000-000000000579')$$,
  'the organizer adds a friend as a Regular'
);
select throws_ok(
  $$insert into public.standing_game_regulars (standing_game_id, user_id)
    values ('66666666-0000-0000-0000-000000000579', 'dddddddd-0000-0000-0000-000000000579')$$,
  '23514',
  null,
  'someone who is not an accepted Connection cannot be a Regular'
);
select throws_ok(
  $$insert into public.standing_game_regulars (standing_game_id, user_id)
    values ('66666666-0000-0000-0000-000000000579', 'aaaaaaaa-0000-0000-0000-000000000579')$$,
  '23514',
  null,
  'the organizer is never their own Regular'
);

-- Cal, not a Regular yet, answers yes to the posted game and to the one-off.
set local request.jwt.claims = '{"sub": "cccccccc-0000-0000-0000-000000000579", "role": "authenticated"}';

select is(
  (select count(*)::int from public.standing_game_regulars),
  0,
  'a friend cannot read the organizer''s Regulars'
);

insert into public.responses (slot_id, user_id, answer)
select id, 'cccccccc-0000-0000-0000-000000000579', 'yes'
from public.slots where standing_game_id = '66666666-0000-0000-0000-000000000579';

insert into public.responses (slot_id, user_id, answer)
values ('77777777-0000-0000-0000-000000000579', 'cccccccc-0000-0000-0000-000000000579', 'yes');

-- Ben, already a Regular, says no this week.
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000579", "role": "authenticated"}';

insert into public.responses (slot_id, user_id, answer)
select id, 'bbbbbbbb-0000-0000-0000-000000000579', 'no'
from public.slots where standing_game_id = '66666666-0000-0000-0000-000000000579';

select throws_ok(
  $$insert into public.standing_game_regulars (standing_game_id, user_id)
    values ('66666666-0000-0000-0000-000000000579', 'bbbbbbbb-0000-0000-0000-000000000579')$$,
  '42501',
  null,
  'a friend cannot add themselves to someone else''s Regulars'
);

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000579", "role": "authenticated"}';

select set_eq(
  $$select user_id from public.standing_game_regulars where standing_game_id = '66666666-0000-0000-0000-000000000579'$$,
  $$values ('bbbbbbbb-0000-0000-0000-000000000579'::uuid), ('cccccccc-0000-0000-0000-000000000579'::uuid)$$,
  'a yes to a posted game joins the answerer, and a no removes nobody'
);

-- Cal changes their mind to maybe: still a Regular.
set local request.jwt.claims = '{"sub": "cccccccc-0000-0000-0000-000000000579", "role": "authenticated"}';
update public.responses set answer = 'maybe'
where user_id = 'cccccccc-0000-0000-0000-000000000579';

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000579", "role": "authenticated"}';
select is(
  (select count(*)::int from public.standing_game_regulars where user_id = 'cccccccc-0000-0000-0000-000000000579'),
  1,
  'changing a yes to maybe keeps the Regular'
);

-- Amy unfriends Ben.
delete from public.connections
where requester_id = 'aaaaaaaa-0000-0000-0000-000000000579'
  and addressee_id = 'bbbbbbbb-0000-0000-0000-000000000579';

select set_eq(
  $$select user_id from public.standing_game_regulars where standing_game_id = '66666666-0000-0000-0000-000000000579'$$,
  $$values ('cccccccc-0000-0000-0000-000000000579'::uuid)$$,
  'ending the Connection removes the Regular'
);

select lives_ok(
  $$delete from public.standing_game_regulars where user_id = 'cccccccc-0000-0000-0000-000000000579'$$,
  'the organizer removes a Regular by hand'
);
select is(
  (select count(*)::int from public.standing_game_regulars),
  0,
  'the list is empty after removing the last Regular'
);

reset role;

insert into public.weekly_invite_sends (slot_id, user_id, channel)
select id, 'cccccccc-0000-0000-0000-000000000579', 'email'
from public.slots where standing_game_id = '66666666-0000-0000-0000-000000000579';

select throws_ok(
  $$insert into public.weekly_invite_sends (slot_id, user_id, channel)
    select id, 'cccccccc-0000-0000-0000-000000000579', 'email'
    from public.slots where standing_game_id = '66666666-0000-0000-0000-000000000579'$$,
  '23505',
  null,
  'one Weekly Invite per Slot, User and channel'
);

select * from finish();
rollback;

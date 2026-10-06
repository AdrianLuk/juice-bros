-- Skipping a Standing Game's week (issue #578, ADR 0023). What this proves:
--
--   * a week skipped before it is posted is never posted, and the week after
--     it posts as usual;
--   * un-skipping a future date lets it post again, and can never un-record a
--     posted week;
--   * skipping a posted week deletes its Slot (Responses cascade), keeps the
--     week recorded as skipped, and it is not posted again;
--   * an ordinary Slot can't be "skipped", a date off the weekday or already
--     gone is refused, and nobody but the owner can skip or un-skip.

begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

select has_column('public', 'standing_game_weeks', 'skipped_at', 'standing_game_weeks.skipped_at exists');

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000005780', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy-skip@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000005780', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben-skip@example.com');

insert into public.connections (requester_id, addressee_id, status) values
  ('aaaaaaaa-0000-0000-0000-000000005780', 'bbbbbbbb-0000-0000-0000-000000005780', 'accepted');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000005780", "role": "authenticated"}';

-- Tuesdays 8 to 10pm.
insert into public.standing_games (id, owner_id, weekday, start_hour, end_hour, time_zone)
values ('66666666-0000-0000-0000-000000005780', 'aaaaaaaa-0000-0000-0000-000000005780', 2, 20, 22, 'America/Toronto');

-- 2031-11-04 and 2031-11-11 are Tuesdays.
select is(
  public.skip_standing_game_date('66666666-0000-0000-0000-000000005780', '2031-11-04'),
  'skipped',
  'a week not posted yet can be skipped'
);
select is(
  public.post_standing_game_week('66666666-0000-0000-0000-000000005780', '2031-11-04'),
  null,
  'a skipped week is never posted'
);
select isnt(
  public.post_standing_game_week('66666666-0000-0000-0000-000000005780', '2031-11-11'),
  null,
  'the week after a skipped one posts as usual'
);
select is(
  public.skip_standing_game_date('66666666-0000-0000-0000-000000005780', '2031-11-11'),
  'posted',
  'skipping by date a week already posted says so and changes nothing'
);
select is(
  public.unskip_standing_game_date('66666666-0000-0000-0000-000000005780', '2031-11-11'),
  false,
  'un-skip never un-records a posted week'
);

select is(
  public.unskip_standing_game_date('66666666-0000-0000-0000-000000005780', '2031-11-04'),
  true,
  'a future skipped date can be un-skipped'
);
select isnt(
  public.post_standing_game_week('66666666-0000-0000-0000-000000005780', '2031-11-04'),
  null,
  'an un-skipped date posts again'
);

-- Ben says yes to the Nov 11 game, then Amy skips it.
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000005780", "role": "authenticated"}';
insert into public.responses (slot_id, user_id, answer)
select id, 'bbbbbbbb-0000-0000-0000-000000005780', 'yes'
from public.slots
where standing_game_id = '66666666-0000-0000-0000-000000005780'
  and (proposed_start at time zone 'America/Toronto')::date = '2031-11-11';

select throws_ok(
  $$select public.skip_posted_standing_game_week(
      (select id from public.slots where standing_game_id = '66666666-0000-0000-0000-000000005780'
         and (proposed_start at time zone 'America/Toronto')::date = '2031-11-11'))$$,
  '42501',
  null,
  'nobody but the owner can skip a posted week'
);

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000005780", "role": "authenticated"}';

select is(
  public.skip_posted_standing_game_week(
    (select id from public.slots where standing_game_id = '66666666-0000-0000-0000-000000005780'
       and (proposed_start at time zone 'America/Toronto')::date = '2031-11-11')),
  '2031-11-11'::date,
  'skipping a posted week returns its date'
);
select is(
  (select count(*)::int from public.slots
     where standing_game_id = '66666666-0000-0000-0000-000000005780'
       and (proposed_start at time zone 'America/Toronto')::date = '2031-11-11'),
  0,
  'the skipped week''s Slot is deleted'
);
select results_eq(
  $$select slot_id is null, skipped_at is not null from public.standing_game_weeks
      where standing_game_id = '66666666-0000-0000-0000-000000005780' and game_date = '2031-11-11'$$,
  $$values (true, true)$$,
  'the week stays recorded, as skipped, with no Slot'
);
select is(
  public.post_standing_game_week('66666666-0000-0000-0000-000000005780', '2031-11-11'),
  null,
  'a posted-then-skipped week is not posted again'
);

select throws_ok(
  $$select public.skip_standing_game_date('66666666-0000-0000-0000-000000005780', '2031-11-05')$$,
  '23514',
  null,
  'a date off the weekday is refused'
);
select throws_ok(
  $$select public.skip_standing_game_date('66666666-0000-0000-0000-000000005780', '2020-01-07')$$,
  '23514',
  null,
  'a date already gone is refused'
);

insert into public.slots (id, owner_id, proposed_start, proposed_end, time_zone)
values ('77777777-0000-0000-0000-000000005780', 'aaaaaaaa-0000-0000-0000-000000005780',
        '2031-11-12 20:00 America/Toronto', '2031-11-12 22:00 America/Toronto', 'America/Toronto');
select throws_ok(
  $$select public.skip_posted_standing_game_week('77777777-0000-0000-0000-000000005780')$$,
  '23514',
  null,
  'an ordinary game can''t be skipped, only deleted'
);

set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000005780", "role": "authenticated"}';
select throws_ok(
  $$select public.skip_standing_game_date('66666666-0000-0000-0000-000000005780', '2031-11-18')$$,
  '42501',
  null,
  'nobody but the owner can skip a date'
);

select * from finish();
rollback;

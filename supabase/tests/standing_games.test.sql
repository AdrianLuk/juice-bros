-- Standing Games (issue #577, ADR 0023). What this proves:
--
--   * `standing_games` is owner-only: a Connection who can see the owner's
--     Slots still cannot read the template;
--   * `post_standing_game_week` posts a plain Slot carrying the template's
--     fields, at the same wall-clock hour on both sides of a DST change, with
--     an end at or before the start landing on the next day;
--   * posting is idempotent per (Standing Game, date) by the unique key, an
--     ended Standing Game posts nothing, a date off its weekday is refused,
--     and nobody but the owner (or service_role) can post for it;
--   * the posted Slot is visible to the friend exactly as any Slot is.

begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

select has_table('public', 'standing_games', 'standing_games table exists');
select has_table('public', 'standing_game_weeks', 'standing_game_weeks table exists');
select has_column('public', 'slots', 'standing_game_id', 'slots.standing_game_id exists');

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000577', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy-standing@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000577', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben-standing@example.com');

-- Accepted Connection, both on the `calendar` default (ADR 0021): Ben sees
-- Amy's Slots.
insert into public.connections (requester_id, addressee_id, status) values
  ('aaaaaaaa-0000-0000-0000-000000000577', 'bbbbbbbb-0000-0000-0000-000000000577', 'accepted');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000577", "role": "authenticated"}';

insert into public.orgs (id, owner_id, name, time_zone)
values ('55555555-0000-0000-0000-000000000577', 'aaaaaaaa-0000-0000-0000-000000000577', 'Tuesday Club', 'America/Toronto');

-- Tuesdays 8 to 10pm, and a late Thursday 10pm to 1am.
insert into public.standing_games (id, owner_id, weekday, start_hour, end_hour, time_zone, division, intended_org_id, notes, rotation_buffer, reminder_offset_minutes)
values
  ('66666666-0000-0000-0000-000000000577', 'aaaaaaaa-0000-0000-0000-000000000577', 2, 20, 22, 'America/Toronto', 'mixed', '55555555-0000-0000-0000-000000000577', 'Bring balls', 2, 1440),
  ('66666666-0000-0000-0000-000000000578', 'aaaaaaaa-0000-0000-0000-000000000577', 4, 22, 1, 'America/Toronto', 'open', null, null, 0, 60);

-- Tue Oct 28 2031 (EDT) and Tue Nov 4 2031 (EST, after DST ends Nov 2).
select isnt(
  public.post_standing_game_week('66666666-0000-0000-0000-000000000577', '2031-10-28'),
  null,
  'posting a due week returns the new Slot'
);
select isnt(
  public.post_standing_game_week('66666666-0000-0000-0000-000000000577', '2031-11-04'),
  null,
  'the week after the DST change posts too'
);

select is(
  public.post_standing_game_week('66666666-0000-0000-0000-000000000577', '2031-10-28'),
  null,
  'posting the same week again does nothing'
);
select is(
  (select count(*)::int from public.slots where standing_game_id = '66666666-0000-0000-0000-000000000577'),
  2,
  'a rerun leaves one Slot per week'
);

select is(
  (select array_agg(to_char(proposed_start at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI') order by proposed_start)
     from public.slots where standing_game_id = '66666666-0000-0000-0000-000000000577'),
  array['2031-10-28 20:00', '2031-11-04 20:00'],
  '8pm stays 8pm on the Toronto clock across the DST change'
);

select results_eq(
  $$select time_zone, division, intended_org_id, intended_org_name, notes, rotation_buffer, reminder_offset_minutes
      from public.slots where standing_game_id = '66666666-0000-0000-0000-000000000577' order by proposed_start limit 1$$,
  $$values ('America/Toronto'::text, 'mixed'::text, '55555555-0000-0000-0000-000000000577'::uuid, 'Tuesday Club'::text, 'Bring balls'::text, 2, 1440)$$,
  'a posted Slot copies the template''s zone, division, Intended Org, notes, buffer and reminder offset'
);

-- 2031-10-30 is a Thursday.
select isnt(
  public.post_standing_game_week('66666666-0000-0000-0000-000000000578', '2031-10-30'),
  null,
  'a late Thursday posts'
);
select is(
  (select to_char(proposed_end at time zone 'America/Toronto', 'YYYY-MM-DD HH24:MI')
     from public.slots where standing_game_id = '66666666-0000-0000-0000-000000000578'),
  '2031-10-31 01:00',
  'an end before the start lands on the next day'
);

select throws_ok(
  $$select public.post_standing_game_week('66666666-0000-0000-0000-000000000577', '2031-10-29')$$,
  '23514',
  null,
  'a date off the Standing Game''s weekday is refused'
);

update public.standing_games set ended_at = now() where id = '66666666-0000-0000-0000-000000000578';
select is(
  public.post_standing_game_week('66666666-0000-0000-0000-000000000578', '2031-11-06'),
  null,
  'an ended Standing Game posts nothing'
);

set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000577", "role": "authenticated"}';

select is(
  (select count(*)::int from public.standing_games),
  0,
  'a friend cannot read the owner''s Standing Games'
);
select is(
  (select count(*)::int from public.standing_game_weeks),
  0,
  'a friend cannot read the owner''s posted weeks'
);
select is(
  (select count(*)::int from public.slots where standing_game_id = '66666666-0000-0000-0000-000000000577'),
  2,
  'the friend sees the posted Slots, as any Slot'
);
select throws_ok(
  $$select public.post_standing_game_week('66666666-0000-0000-0000-000000000577', '2031-11-11')$$,
  '42501',
  null,
  'nobody but the owner can post a week'
);

select * from finish();
rollback;

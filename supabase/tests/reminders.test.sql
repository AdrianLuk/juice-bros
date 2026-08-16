-- Reminder (issue #11, CONTEXT.md). Three pieces to prove at this layer:
--
--   * `slots.reminder_offset_minutes` carries a bound — the send job trusts
--     it's never a nonsense number without re-checking in application code;
--   * `notification_preferences` is owner-managed, the same "yours and
--     nobody else's" shape every other Booking Buddy table starts from
--     (ADR 0003);
--   * `reminder_sends`, like `guest_rsvp_log` before it, is reachable by
--     nobody through `authenticated` — the send job runs entirely through
--     `service_role`, which this file cannot exercise directly (it bypasses
--     RLS by Supabase's own platform guarantee), only prove nothing else can.

begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

select has_column('public', 'slots', 'reminder_offset_minutes', 'slots.reminder_offset_minutes exists');
select has_table('public', 'notification_preferences', 'notification_preferences table exists');
select has_table('public', 'reminder_sends', 'reminder_sends table exists');

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy-reminders@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben-reminders@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000061", "role": "authenticated"}';

-- A Slot's own reminder_offset_minutes respects its bound (0–10080 minutes).
select throws_ok(
  $$insert into public.slots (owner_id, proposed_start, proposed_end, time_zone, reminder_offset_minutes)
    values ('aaaaaaaa-0000-0000-0000-000000000061', '2031-11-01 09:00:00+00', '2031-11-01 10:30:00+00', 'America/Toronto', 10081)$$,
  '23514',
  null,
  'a reminder offset past the 7-day bound is refused'
);

insert into public.slots (id, owner_id, proposed_start, proposed_end, time_zone)
values (
  '77777777-0000-0000-0000-000000000061',
  'aaaaaaaa-0000-0000-0000-000000000061',
  '2031-11-01 09:00:00+00',
  '2031-11-01 10:30:00+00',
  'America/Toronto'
);

select is(
  (select reminder_offset_minutes from public.slots where id = '77777777-0000-0000-0000-000000000061'),
  60,
  'a new slot defaults to a 60-minute reminder offset'
);

-- Amy can create and read her own notification preferences.
insert into public.notification_preferences (user_id, email_enabled)
values ('aaaaaaaa-0000-0000-0000-000000000061', false);

select is(
  (select email_enabled from public.notification_preferences
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000061'),
  false,
  'the owner can create and read their own notification preferences'
);

-- Ben: a Connection, even an accepted one with the most open Visibility,
-- still has no access to Amy's notification preferences — this table isn't
-- part of what Visibility opens up at all.
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000062", "role": "authenticated"}';

select is(
  (select count(*)::int from public.notification_preferences
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000061'),
  0,
  'another User cannot read someone else''s notification preferences'
);

select throws_ok(
  $$insert into public.notification_preferences (user_id, email_enabled)
    values ('aaaaaaaa-0000-0000-0000-000000000061', true)$$,
  '42501',
  null,
  'another User cannot create a notification preferences row on someone else''s behalf'
);

-- An UPDATE filtered by `using` matches zero rows rather than raising (the
-- same lesson every other RLS test file already carries) — assert the value
-- is unchanged, not that the statement throws.
update public.notification_preferences
  set email_enabled = true
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000061';

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000061", "role": "authenticated"}';

select is(
  (select email_enabled from public.notification_preferences
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000061'),
  false,
  'a friend''s attempted update of someone else''s notification preferences is silently filtered, not applied'
);

-- reminder_sends: no policy grants `authenticated` anything, same posture as
-- guest_rsvp_log — nothing in the app reads this through a User's own
-- session, and the send job never runs as one.
select throws_ok(
  $$select count(*) from public.reminder_sends$$,
  '42501',
  null,
  'no authenticated User can read the reminder send log'
);

select throws_ok(
  $$insert into public.reminder_sends (slot_id, user_id, channel)
    values ('77777777-0000-0000-0000-000000000061', 'aaaaaaaa-0000-0000-0000-000000000061', 'email')$$,
  '42501',
  null,
  'no authenticated User can write to the reminder send log either'
);

select * from finish();

rollback;

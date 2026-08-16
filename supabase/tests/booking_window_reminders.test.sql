-- Booking Window Reminder (issue #36) — a second, distinct Reminder from
-- #11's, telling a Slot's organizer when it's time to go reserve a court,
-- not attendees that a confirmed game is coming up. Four things to prove:
--
--   * an Org's Booking Window fields are set together or not at all, and
--     the time is on the same half-hour grid every other time entry in this
--     app uses;
--   * a Slot's `intended_org_id`, if set, must belong to the same owner —
--     `assert_slot_intended_org_coherent`;
--   * `slot_booking_windows` computes the right instant, in the Org's own
--     zone, from a known fixture;
--   * `booking_window_reminder_sends` (and the view) are unreachable via
--     `authenticated` — the send job runs entirely through `service_role`,
--     the same posture `guest_rsvp_log`/`reminder_sends` already established.

begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

select has_column('public', 'orgs', 'booking_window_days_before', 'orgs.booking_window_days_before exists');
select has_column('public', 'orgs', 'booking_window_time', 'orgs.booking_window_time exists');
select has_column('public', 'slots', 'intended_org_id', 'slots.intended_org_id exists');
select has_table('public', 'booking_window_reminder_sends', 'booking_window_reminder_sends table exists');
select has_view('public', 'slot_booking_windows', 'slot_booking_windows view exists');

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000071', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy-window@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000072', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben-window@example.com');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000071", "role": "authenticated"}';

insert into public.orgs (id, owner_id, name, time_zone)
values (
  '55555555-0000-0000-0000-000000000073',
  'aaaaaaaa-0000-0000-0000-000000000071',
  'Half-set Club',
  'America/Toronto'
);

-- Both-or-neither on an Org's Booking Window fields.
select throws_ok(
  $$update public.orgs set booking_window_days_before = 3
    where id = '55555555-0000-0000-0000-000000000073'$$,
  '23514',
  null,
  'a booking window needs both fields, not just one'
);

-- Off the half-hour grid.
select throws_ok(
  $$insert into public.orgs (owner_id, name, time_zone, booking_window_days_before, booking_window_time) values
    ('aaaaaaaa-0000-0000-0000-000000000071', 'Off-Grid Club', 'America/Toronto', 3, '06:15')$$,
  '23514',
  null,
  'a booking window time off the half-hour grid is refused'
);

insert into public.orgs (id, owner_id, name, time_zone, booking_window_days_before, booking_window_time)
values (
  '55555555-0000-0000-0000-000000000071',
  'aaaaaaaa-0000-0000-0000-000000000071',
  'Rally Point',
  'America/Toronto',
  3,
  '06:00'
);

-- Inserted as Ben himself — Amy inserting a row naming Ben's own owner_id
-- would be filtered by the same RLS this whole test exists to prove.
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000072", "role": "authenticated"}';

insert into public.orgs (id, owner_id, name, time_zone)
values (
  '55555555-0000-0000-0000-000000000072',
  'bbbbbbbb-0000-0000-0000-000000000072',
  'Ben''s Club',
  'America/Toronto'
);

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000071", "role": "authenticated"}';

-- A Slot's intended Org must belong to the same owner as the Slot.
select throws_ok(
  $$insert into public.slots (owner_id, proposed_start, proposed_end, time_zone, intended_org_id)
    values ('aaaaaaaa-0000-0000-0000-000000000071', '2031-11-08 09:00:00 America/Toronto', '2031-11-08 10:30:00 America/Toronto', 'America/Toronto', '55555555-0000-0000-0000-000000000072')$$,
  '23514',
  null,
  'a slot cannot point its intended org at someone else''s org'
);

insert into public.slots (id, owner_id, proposed_start, proposed_end, time_zone, intended_org_id)
values (
  '77777777-0000-0000-0000-000000000071',
  'aaaaaaaa-0000-0000-0000-000000000071',
  '2031-11-08 09:00:00 America/Toronto',
  '2031-11-08 10:30:00 America/Toronto',
  'America/Toronto',
  '55555555-0000-0000-0000-000000000071'
);

select is(
  (select intended_org_id from public.slots where id = '77777777-0000-0000-0000-000000000071'),
  '55555555-0000-0000-0000-000000000071'::uuid,
  'a slot can point its intended org at one of the owner''s own orgs'
);

-- service_role-only objects: unreachable via authenticated, same posture as
-- reminder_sends/guest_rsvp_log.
select throws_ok(
  $$select count(*) from public.booking_window_reminder_sends$$,
  '42501',
  null,
  'no authenticated User can read the booking window send log'
);

select throws_ok(
  $$insert into public.booking_window_reminder_sends (slot_id) values ('77777777-0000-0000-0000-000000000071')$$,
  '42501',
  null,
  'no authenticated User can write to the booking window send log either'
);

select throws_ok(
  $$select count(*) from public.slot_booking_windows$$,
  '42501',
  null,
  'no authenticated User can read the booking windows view either'
);

-- The view's own date math: 3 days before Nov 8 at 9am (Toronto), at 6am,
-- in the org's own zone. Read as the table owner (bypassing RLS, `reset
-- role`), the same way pgTAP always proves a computation exists and is
-- correct before separately proving who can and can't see it.
reset role;

select is(
  (select window_opens_at from public.slot_booking_windows
   where slot_id = '77777777-0000-0000-0000-000000000071'),
  '2031-11-05 06:00:00 America/Toronto'::timestamptz,
  'the booking window opens the configured days before the slot, at the configured time, in the org''s own zone'
);

select * from finish();

rollback;

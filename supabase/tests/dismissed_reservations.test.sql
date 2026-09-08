-- Dismissed reservation (issue #437, CONTEXT.md's Import Candidate entry) —
-- the slot a User said no to on the Sync bookings review screen, recorded so
-- *both* import sources honour the decision. Owner-only per ADR 0003's coarse
-- RLS pattern, the same shape processed_messages.test.sql / calendar_feed.test.sql
-- already exercise: seed as the table owner, then re-check as `authenticated`
-- carrying each User's own JWT.
--
-- What this pins down:
--
--   * the table has the wall-clock slot shape the reviews compare on — Org,
--     date, start time, and a nullable court label;
--   * the same slot can be recorded twice, because the two sources write the
--     same court differently ("#9 - Hard" against "#9") and the match is made
--     by court *number* at read time, not by a database key;
--   * the indexes the per-Org read and the orgs cascade need are present;
--   * the coherence trigger stops a row being hung off someone else's Org;
--   * RLS is "mine and nobody else's", there is no update grant — a dismissal
--     is never rewritten in place — but there is a delete grant, so a User can
--     take one back from the review screen (issue #444);
--   * deleting the Org, or the User, cascades the dismissals away.

begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

-- Shape -----------------------------------------------------------------------

select has_table('public', 'dismissed_reservations', 'dismissed_reservations table exists (#437)');
select has_column('public', 'dismissed_reservations', 'owner_id', 'dismissed_reservations.owner_id exists — RLS keys on it, matching processed_messages / org_feed_events');
select has_column('public', 'dismissed_reservations', 'org_id', 'dismissed_reservations.org_id exists');
select has_column('public', 'dismissed_reservations', 'slot_date', 'dismissed_reservations.slot_date exists — the reservation''s own calendar day in the Org''s zone');
select has_column('public', 'dismissed_reservations', 'slot_start_time', 'dismissed_reservations.slot_start_time exists');
select has_column('public', 'dismissed_reservations', 'court_label', 'dismissed_reservations.court_label exists — the dismissing source''s own court text');
select col_is_null('public', 'dismissed_reservations', 'court_label', 'court_label is nullable — a source that named no court matches any court in the slot');
select col_is_pk('public', 'dismissed_reservations', 'id', 'id is the primary key');
select has_index(
  'public', 'dismissed_reservations', 'dismissed_reservations_owner_org',
  'the per-Org read both reviews make is indexed'
);
select has_index(
  'public', 'dismissed_reservations', 'dismissed_reservations_org_id',
  'org_id is indexed — the referencing side of the orgs cascade'
);

-- Fixtures ------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-d15d-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dismiss-owner@example.com'),
  ('b0000000-d15d-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dismiss-stranger@example.com');

insert into public.orgs (id, owner_id, name, time_zone) values
  ('a0000000-0000-0000-0000-0000000d15d0', 'a0000000-d15d-0000-0000-000000000001', 'Dismiss owner club', 'America/Toronto'),
  ('b0000000-0000-0000-0000-0000000d15d0', 'b0000000-d15d-0000-0000-000000000002', 'Stranger club', 'America/Toronto');

insert into public.dismissed_reservations (owner_id, org_id, slot_date, slot_start_time, court_label)
values (
  'a0000000-d15d-0000-0000-000000000001',
  'a0000000-0000-0000-0000-0000000d15d0',
  '2031-10-01',
  '18:00',
  '#9 - Hard'
);

select is(
  (select court_label from public.dismissed_reservations
   where owner_id = 'a0000000-d15d-0000-0000-000000000001'),
  '#9 - Hard',
  'the dismissing source''s court text is stored verbatim — the match normalises it to a number at read time'
);

-- No uniqueness on the slot: the feed writes "#9" for the reservation the
-- email wrote "#9 - Hard" for, so a key could never dedupe the two anyway.
select lives_ok(
  $$ insert into public.dismissed_reservations (owner_id, org_id, slot_date, slot_start_time, court_label)
     values ('a0000000-d15d-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000d15d0',
             '2031-10-01', '18:00', '#9') $$,
  'the same slot can be dismissed from both sources — the read is a filter, not a count'
);

select lives_ok(
  $$ insert into public.dismissed_reservations (owner_id, org_id, slot_date, slot_start_time)
     values ('a0000000-d15d-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000d15d0',
             '2031-10-02', '10:00') $$,
  'a facility that labels no courts can dismiss a slot with no court'
);

-- The coherence trigger: owner_id must match the Org's owner. RLS can't cover
-- this — the insert is on a table the User may write and the policy only looks
-- at owner_id.
select throws_ok(
  $$ insert into public.dismissed_reservations (owner_id, org_id, slot_date, slot_start_time)
     values ('a0000000-d15d-0000-0000-000000000001', 'b0000000-0000-0000-0000-0000000d15d0',
             '2031-10-03', '18:00') $$,
  '23514',
  null,
  'a dismissal cannot be hung off an Org belonging to someone else'
);

-- Row Level Security ------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-d15d-0000-0000-000000000001", "role": "authenticated"}';

select is(
  (select count(*)::int from public.dismissed_reservations),
  3,
  'the owner sees their own dismissals'
);

select lives_ok(
  $$ insert into public.dismissed_reservations (owner_id, org_id, slot_date, slot_start_time, court_label)
     values ('a0000000-d15d-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000d15d0',
             '2031-10-04', '19:00', '#3') $$,
  'the owner can record their own dismissal'
);

select throws_ok(
  $$ insert into public.dismissed_reservations (owner_id, org_id, slot_date, slot_start_time)
     values ('b0000000-d15d-0000-0000-000000000002', 'b0000000-0000-0000-0000-0000000d15d0',
             '2031-10-05', '18:00') $$,
  '42501',
  null,
  'recording a dismissal under someone else''s owner_id is refused, not silently misattributed'
);

-- Never rewritten in place: a dismissal is either standing or gone.
select throws_ok(
  $$ update public.dismissed_reservations set court_label = '#1' $$,
  '42501',
  null,
  'there is no update grant — a dismissal is never rewritten'
);

-- But it can be taken back (issue #444). The un-dismiss deletes *every* row
-- matching the slot, because both sources record their own with their own
-- court text and leaving one behind would leave the slot suppressed.
select lives_ok(
  $$ delete from public.dismissed_reservations
     where slot_date = '2031-10-01' and slot_start_time = '18:00' $$,
  'the owner can take their own dismissal back — both sources'' rows at once'
);

select is(
  (select count(*)::int from public.dismissed_reservations
   where slot_date = '2031-10-01'),
  0,
  'both rows for that slot are gone, so the next sync offers the reservation again'
);

reset role;
set local request.jwt.claims = '{"sub": "b0000000-d15d-0000-0000-000000000002", "role": "authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from public.dismissed_reservations),
  0,
  'a different signed-in User sees none of it'
);

reset role;

-- Cascades --------------------------------------------------------------------

select is(
  (select count(*)::int from public.dismissed_reservations
   where owner_id = 'a0000000-d15d-0000-0000-000000000001'),
  2,
  'the owner''s remaining dismissals are still there — the stranger''s zero count above was RLS'
);

-- Removing the Facility takes its dismissals with it: there is no reservation
-- at an Org the User no longer has.
delete from public.orgs where id = 'a0000000-0000-0000-0000-0000000d15d0';

select is(
  (select count(*)::int from public.dismissed_reservations
   where owner_id = 'a0000000-d15d-0000-0000-000000000001'),
  0,
  'deleting the Org cascades its dismissals away'
);

insert into public.orgs (id, owner_id, name, time_zone)
values ('a0000000-0000-0000-0000-0000000d15d1', 'a0000000-d15d-0000-0000-000000000001', 'Second club', 'America/Toronto');

insert into public.dismissed_reservations (owner_id, org_id, slot_date, slot_start_time)
values ('a0000000-d15d-0000-0000-000000000001', 'a0000000-0000-0000-0000-0000000d15d1', '2031-11-01', '18:00');

delete from auth.users where id = 'a0000000-d15d-0000-0000-000000000001';

select is(
  (select count(*)::int from public.dismissed_reservations
   where owner_id = 'a0000000-d15d-0000-0000-000000000001'),
  0,
  'deleting the User cascades their dismissals away too'
);

select * from finish();

rollback;

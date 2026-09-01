-- Calendar Feed storage (issue #293 / spec #288, CONTEXT.md's Calendar Feed
-- entry) — `orgs.calendar_feed_url` plus the `org_feed_events` seen-event
-- history. Owner-only per ADR 0003's coarse-RLS pattern, the same shape
-- mailbox_links.test.sql / orgs_and_bookings.test.sql already exercise: seed as
-- the table owner, then re-check as `authenticated` carrying each User's own
-- JWT.
--
-- What this pins down:
--
--   * `orgs.calendar_feed_url` exists, is nullable, and is a plain text column
--     (the app encrypts before it ever reaches here — token-encryption.ts);
--   * `org_feed_events` has the shape from the spec, `status` is constrained
--     and has no default (every upsert names it), and (owner_id, org_id, uid)
--     is unique — one row per reservation per feed;
--   * the indexes the sync read and the two FK cascades need are present;
--   * RLS is "mine and nobody else's" — a stranger reads nothing and a
--     stranger's delete silently matches zero rows;
--   * the coherence trigger stops a row being hung off someone else's Org;
--   * deleting the Org cascades its feed events away; deleting the owner does
--     too; deleting a linked Booking nulls `booking_id` but keeps the row.

begin;

create extension if not exists pgtap with schema extensions;

select plan(39);

-- Shape -----------------------------------------------------------------------

select has_column('public', 'orgs', 'calendar_feed_url', 'orgs.calendar_feed_url exists (#293)');
select col_is_null('public', 'orgs', 'calendar_feed_url', 'calendar_feed_url is nullable — most Orgs never get a feed');
select col_type_is('public', 'orgs', 'calendar_feed_url', 'text', 'calendar_feed_url is text — ciphertext, encrypted app-side before it lands here');

select has_table('public', 'org_feed_events', 'org_feed_events table exists');
select has_column('public', 'org_feed_events', 'owner_id', 'org_feed_events.owner_id exists — RLS keys on it, matching mailbox_links / bookings');
select has_column('public', 'org_feed_events', 'org_id', 'org_feed_events.org_id exists');
select has_column('public', 'org_feed_events', 'uid', 'org_feed_events.uid exists — the VEVENT UID');
select has_column('public', 'org_feed_events', 'sequence', 'org_feed_events.sequence exists');
select has_column('public', 'org_feed_events', 'starts_at', 'org_feed_events.starts_at exists — the cancellation-window check and pruning read it');
select has_column('public', 'org_feed_events', 'status', 'org_feed_events.status exists');
select has_column('public', 'org_feed_events', 'booking_id', 'org_feed_events.booking_id exists — provenance, set when status = imported');
select has_column('public', 'org_feed_events', 'first_seen_at', 'org_feed_events.first_seen_at exists');
select has_column('public', 'org_feed_events', 'last_seen_at', 'org_feed_events.last_seen_at exists — bumped every sync, the mutable column');

select col_is_pk('public', 'org_feed_events', 'id', 'id is the primary key');
select col_hasnt_default('public', 'org_feed_events', 'status', 'status has no default — every upsert states pending/imported/dismissed');
select col_is_unique(
  'public', 'org_feed_events',
  ARRAY['owner_id', 'org_id', 'uid'],
  'one row per reservation per feed — (owner_id, org_id, uid) is unique'
);
select has_index(
  'public', 'org_feed_events', 'org_feed_events_owner_org_uid',
  'the unique index whose leading (owner_id, org_id) also serves the per-Org sync read'
);
select has_index(
  'public', 'org_feed_events', 'org_feed_events_org_id',
  'org_id is indexed — the referencing side of the orgs cascade'
);
select has_index(
  'public', 'org_feed_events', 'org_feed_events_booking_id',
  'booking_id is indexed — the referencing side of the bookings set-null'
);

-- Fixtures ------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email) values
  ('a0000000-feed-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'feed-owner@example.com'),
  ('b0000000-feed-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'feed-stranger@example.com'),
  ('c0000000-feed-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'feed-cascade@example.com');

insert into public.orgs (id, owner_id, name, time_zone) values
  ('a0000000-0000-0000-0000-00000000feed', 'a0000000-feed-0000-0000-000000000001', 'Feed owner club', 'America/Toronto'),
  ('a0000000-0000-0000-0000-00000000dfed', 'a0000000-feed-0000-0000-000000000001', 'Feed owner second club', 'America/Toronto'),
  ('b0000000-0000-0000-0000-00000000feed', 'b0000000-feed-0000-0000-000000000002', 'Stranger club', 'America/Toronto'),
  ('c0000000-0000-0000-0000-00000000feed', 'c0000000-feed-0000-0000-000000000003', 'Cascade club', 'America/Toronto');

insert into public.bookings (id, org_id, owner_id, court_label, starts_at, ends_at) values
  ('a0000000-0000-0000-0000-0000000b0011', 'a0000000-0000-0000-0000-00000000feed', 'a0000000-feed-0000-0000-000000000001', 'Court 3', '2031-10-01 18:00:00 America/Toronto', '2031-10-01 19:00:00 America/Toronto'),
  -- A Booking of the owner's own, but in their *other* Org.
  ('a0000000-0000-0000-0000-0000000b0022', 'a0000000-0000-0000-0000-00000000dfed', 'a0000000-feed-0000-0000-000000000001', 'Court 4', '2031-10-02 18:00:00 America/Toronto', '2031-10-02 19:00:00 America/Toronto');

-- calendar_feed_url round-trips (the app stores ciphertext; the column doesn't
-- care what the string is).
update public.orgs set calendar_feed_url = 'iv.authTag.ciphertext'
where id = 'a0000000-0000-0000-0000-00000000feed';

select is(
  (select calendar_feed_url from public.orgs where id = 'a0000000-0000-0000-0000-00000000feed'),
  'iv.authTag.ciphertext',
  'a feed URL (ciphertext) can be stored on an Org and read back'
);

select lives_ok(
  $$ update public.orgs set calendar_feed_url = null where id = 'a0000000-0000-0000-0000-00000000feed' $$,
  'clearing the feed URL back to null is allowed'
);

-- org_feed_events insert / defaults / constraints.
insert into public.org_feed_events (owner_id, org_id, uid, starts_at, status)
values (
  'a0000000-feed-0000-0000-000000000001',
  'a0000000-0000-0000-0000-00000000feed',
  'VEVENT-UID-1',
  '2031-10-01 18:00:00 America/Toronto',
  'pending'
);

select is(
  (select sequence from public.org_feed_events where uid = 'VEVENT-UID-1'),
  0,
  'sequence defaults to 0'
);

select is(
  (select first_seen_at = last_seen_at from public.org_feed_events where uid = 'VEVENT-UID-1'),
  true,
  'first_seen_at and last_seen_at both default to now() on first insert'
);

select throws_ok(
  $$ insert into public.org_feed_events (owner_id, org_id, uid, starts_at, status)
     values ('a0000000-feed-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000feed',
             'VEVENT-UID-2', '2031-10-02 18:00:00 America/Toronto', 'not-a-real-status') $$,
  '23514',
  null,
  'status is constrained to pending/imported/dismissed'
);

select throws_ok(
  $$ insert into public.org_feed_events (owner_id, org_id, uid, starts_at, status)
     values ('a0000000-feed-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000feed',
             'VEVENT-UID-1', '2031-10-01 18:00:00 America/Toronto', 'imported') $$,
  '23505',
  null,
  'the same UID for the same (owner, Org) cannot be recorded twice — the diff upserts onto this row'
);

-- The coherence trigger: owner_id must match the Org's owner. RLS can't cover
-- this — the insert is on a table the User may write and the policy only looks
-- at owner_id.
select throws_ok(
  $$ insert into public.org_feed_events (owner_id, org_id, uid, starts_at, status)
     values ('a0000000-feed-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000feed',
             'VEVENT-UID-X', '2031-10-03 18:00:00 America/Toronto', 'pending') $$,
  '23514',
  null,
  'a feed event cannot be hung off an Org belonging to someone else'
);

-- The same trigger guards booking_id: a linked Booking has to be the row's own
-- User's, in the row's own Org. Here the Booking is the owner's but sits in
-- their *other* Org.
select throws_ok(
  $$ update public.org_feed_events set status = 'imported',
       booking_id = 'a0000000-0000-0000-0000-0000000b0022'
     where uid = 'VEVENT-UID-1' $$,
  '23514',
  null,
  'a feed event cannot be linked to a Booking in a different Org'
);

-- booking_id: on delete set null keeps the seen-event row (the event is still
-- in the feed) but drops the stale link.
update public.org_feed_events
set status = 'imported', booking_id = 'a0000000-0000-0000-0000-0000000b0011'
where uid = 'VEVENT-UID-1';

delete from public.bookings where id = 'a0000000-0000-0000-0000-0000000b0011';

select is(
  (select count(*)::int from public.org_feed_events where uid = 'VEVENT-UID-1'),
  1,
  'deleting the linked Booking leaves the seen-event row in place'
);
select is(
  (select booking_id from public.org_feed_events where uid = 'VEVENT-UID-1'),
  null,
  'and nulls its booking_id rather than cascading the row away'
);

-- Row Level Security ------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "a0000000-feed-0000-0000-000000000001", "role": "authenticated"}';

select is(
  (select count(*)::int from public.org_feed_events
   where owner_id in ('a0000000-feed-0000-0000-000000000001', 'b0000000-feed-0000-0000-000000000002')),
  1,
  'the owner sees their own feed events'
);

select lives_ok(
  $$ insert into public.org_feed_events (owner_id, org_id, uid, starts_at, status)
     values ('a0000000-feed-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000feed',
             'VEVENT-UID-OWNED', '2031-10-05 18:00:00 America/Toronto', 'pending') $$,
  'the owner can insert their own feed event'
);

-- Put a real feed URL back on the owner's Org (it was cleared earlier) so the
-- stranger check below is an actual RLS assertion rather than a vacuous count
-- against a table with no feed URLs at all.
update public.orgs set calendar_feed_url = 'iv.authTag.ciphertext'
where id = 'a0000000-0000-0000-0000-00000000feed';

select throws_ok(
  $$ insert into public.org_feed_events (owner_id, org_id, uid, starts_at, status)
     values ('b0000000-feed-0000-0000-000000000002', 'b0000000-0000-0000-0000-00000000feed',
             'VEVENT-UID-EVIL', '2031-10-06 18:00:00 America/Toronto', 'pending') $$,
  '42501',
  null,
  'recording a feed event under someone else''s owner_id is refused, not silently misattributed'
);

reset role;
set local request.jwt.claims = '{"sub": "b0000000-feed-0000-0000-000000000002", "role": "authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from public.org_feed_events
   where owner_id = 'a0000000-feed-0000-0000-000000000001'),
  0,
  'a different signed-in User sees none of it'
);

select is(
  (select count(*)::int from public.orgs where calendar_feed_url is not null),
  0,
  'and cannot see whether another User has configured a feed (RLS hides the Org row entirely)'
);

select lives_ok(
  $$ delete from public.org_feed_events where owner_id = 'a0000000-feed-0000-0000-000000000001' $$,
  'the delete statement itself does not error'
);

reset role;

select is(
  (select count(*)::int from public.orgs where calendar_feed_url is not null),
  1,
  'the owner''s feed URL is still there — the stranger''s zero count above was RLS, not a missing value'
);

select is(
  (select count(*)::int from public.org_feed_events where owner_id = 'a0000000-feed-0000-0000-000000000001'),
  2,
  'but RLS silently matched zero rows — the other User''s feed events are untouched'
);

-- Cascades --------------------------------------------------------------------

-- Deleting the Org takes its feed events with it: a feed for a facility the
-- User has removed has nothing to diff against.
delete from public.orgs where id = 'a0000000-0000-0000-0000-00000000feed';

select is(
  (select count(*)::int from public.org_feed_events where owner_id = 'a0000000-feed-0000-0000-000000000001'),
  0,
  'deleting an Org cascades its feed events away'
);

-- Deleting the owner does too (the same on delete cascade, via auth.users).
insert into public.org_feed_events (owner_id, org_id, uid, starts_at, status)
values (
  'c0000000-feed-0000-0000-000000000003',
  'c0000000-0000-0000-0000-00000000feed',
  'VEVENT-UID-CASCADE',
  '2031-10-07 18:00:00 America/Toronto',
  'pending'
);

delete from auth.users where id = 'c0000000-feed-0000-0000-000000000003';

select is(
  (select count(*)::int from public.org_feed_events where uid = 'VEVENT-UID-CASCADE'),
  0,
  'deleting the owner cascades their feed events away'
);

select * from finish();

rollback;

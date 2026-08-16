-- A Slot Link (issue #10, CONTEXT.md) grants a Guest access to exactly one
-- Slot, with no account and no Connection. Two rules live at this layer:
--
--   * only the Slot's owner can create, read, or manage their own Slot Link
--     — `slots.test.sql`/`slot_bookings.test.sql`'s "at least slots
--     Visibility" boundary doesn't apply here at all: even a friend who can
--     see the Slot itself has no access to its Slot Link;
--   * `guest_rsvp_log` (the Q7 abuse-detection audit trail) is reachable by
--     nobody through `authenticated` — not even the Slot's own owner — since
--     the Guest path runs entirely through the admin (service_role) client
--     in application code, the same posture ADR 0003 already established for
--     `place_cache`. There is nothing to prove about `service_role` itself
--     here: it bypasses RLS by Supabase's own platform guarantee, the same
--     reason `place_cache`'s writes were never pgTAP-covered either.

begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

select has_table('public', 'slot_links', 'slot_links table exists');
select has_table('public', 'guest_rsvp_log', 'guest_rsvp_log table exists');

-- Amy owns the Slot. Ben is in a Friend Group of Amy's defaulting to
-- `calendar` — the most permissive Visibility there is — to prove even that
-- doesn't reach a Slot Link.
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'amy-link@example.com'),
  ('bbbbbbbb-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben-link@example.com');

insert into public.connections (id, requester_id, addressee_id, status) values
  ('44444444-0000-0000-0000-000000000051', 'aaaaaaaa-0000-0000-0000-000000000051', 'bbbbbbbb-0000-0000-0000-000000000052', 'accepted');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000051", "role": "authenticated"}';

insert into public.friend_groups (id, owner_id, name, default_visibility)
values ('66666666-0000-0000-0000-000000000051', 'aaaaaaaa-0000-0000-0000-000000000051', 'Link crew', 'calendar');

insert into public.friend_group_members (group_id, connection_id)
values ('66666666-0000-0000-0000-000000000051', '44444444-0000-0000-0000-000000000051');

insert into public.slots (id, owner_id, proposed_start, proposed_end, time_zone)
values (
  '77777777-0000-0000-0000-000000000051',
  'aaaaaaaa-0000-0000-0000-000000000051',
  '2031-10-18 13:00:00+00',
  '2031-10-18 14:30:00+00',
  'America/Toronto'
);

insert into public.slot_links (id, slot_id, token)
values (
  '55555555-0000-0000-0000-000000000051',
  '77777777-0000-0000-0000-000000000051',
  'tok-owner-created-51'
);

select is(
  (select count(*)::int from public.slot_links
   where slot_id = '77777777-0000-0000-0000-000000000051'),
  1,
  'the owner can create a slot link for their own slot'
);

select throws_ok(
  $$insert into public.slot_links (slot_id, token)
    values ('77777777-0000-0000-0000-000000000051', 'tok-second-attempt-51')$$,
  '23505',
  null,
  'a slot can only have one slot link'
);

-- Ben: calendar-visible friend — the most open Visibility grants — still has
-- no access to Amy's Slot Link at all. A Slot Link is not part of what
-- Visibility opens up (CONTEXT.md: it's a separate, unguessable-token grant).
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-0000-0000-000000000052", "role": "authenticated"}';

select is(
  (select count(*)::int from public.slot_links
   where slot_id = '77777777-0000-0000-0000-000000000051'),
  0,
  'a friend with even calendar Visibility into the owner cannot see their slot link'
);

select throws_ok(
  $$insert into public.slot_links (slot_id, token)
    values ('77777777-0000-0000-0000-000000000051', 'tok-friend-attempt-51')$$,
  '42501',
  null,
  'a friend cannot create a slot link for someone else''s slot'
);

-- Back to Amy: she can read and manage her own row regardless of who else
-- was just refused.
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-0000-0000-000000000051", "role": "authenticated"}';

select is(
  (select token from public.slot_links
   where slot_id = '77777777-0000-0000-0000-000000000051'),
  'tok-owner-created-51',
  'the owner can read their own slot link'
);

-- guest_rsvp_log: no policy grants `authenticated` access at all — not even
-- the Slot's own owner, since nothing in the app reads this through a User's
-- own session today (see the file header).
select throws_ok(
  $$select count(*) from public.guest_rsvp_log$$,
  '42501',
  null,
  'no authenticated User — not even a slot owner — can read the guest RSVP audit log'
);

select throws_ok(
  $$insert into public.guest_rsvp_log (slot_link_id, guest_name)
    values ('55555555-0000-0000-0000-000000000051', 'June')$$,
  '42501',
  null,
  'no authenticated User can write to the guest RSVP audit log either'
);

-- The owner can delete their own slot link — same "for all" policy already
-- proven above for select/insert, covering the last operation it grants.
delete from public.slot_links
  where slot_id = '77777777-0000-0000-0000-000000000051';

select is(
  (select count(*)::int from public.slot_links
   where slot_id = '77777777-0000-0000-0000-000000000051'),
  0,
  'the owner can delete their own slot link'
);

select * from finish();

rollback;

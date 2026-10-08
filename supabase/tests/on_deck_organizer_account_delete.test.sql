-- Deleting an Organizer's account. What this pins down:
--
--   * it succeeds while their Club has an open Session whose log holds their
--     own events. `operator_user_id` used to be `on delete set null`, which
--     Postgres ran before the Club cascade reached the rows, and the
--     organizer-names-an-account CHECK refused the null;
--   * the Club, its Sessions and the whole event log go with the account.

begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000d0e1e', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'organizer-delete@example.test');

insert into public.on_deck_clubs (id, owner_id, name, venue_name) values
  ('00000000-0000-0000-0000-0000000c1b01', '00000000-0000-0000-0000-0000000d0e1e',
   'Delete Club', 'Delete Venue');

insert into public.on_deck_sessions
  (id, club_id, venue_name, court_count, group_cap, floor_mode, time_zone)
values
  ('00000000-0000-0000-0000-00000005e551', '00000000-0000-0000-0000-0000000c1b01',
   'Delete Venue', 4, 4, 'hybrid', 'UTC');

insert into public.on_deck_session_events
  (session_id, type, operator_kind, operator_user_id, payload)
values
  ('00000000-0000-0000-0000-00000005e551', 'COURT_FINISHED', 'organizer',
   '00000000-0000-0000-0000-0000000d0e1e', '{"court": 1}'),
  ('00000000-0000-0000-0000-00000005e551', 'PLAYER_QUEUED', 'player',
   null, '{"token": "delete-test-token"}');

select lives_ok(
  $$ delete from auth.users where id = '00000000-0000-0000-0000-0000000d0e1e' $$,
  'an Organizer with their own events in an open Session can delete their account'
);

select is(
  (select count(*)::int from public.on_deck_session_events
    where session_id = '00000000-0000-0000-0000-00000005e551'),
  0,
  'the event log goes with the account'
);

select is(
  (select count(*)::int from public.on_deck_sessions
    where id = '00000000-0000-0000-0000-00000005e551'),
  0,
  'the Session goes with the account'
);

select is(
  (select count(*)::int from public.on_deck_clubs
    where id = '00000000-0000-0000-0000-0000000c1b01'),
  0,
  'the Club goes with the account'
);

select * from finish();

rollback;

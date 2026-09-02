-- On Deck: Realtime sync upgrade (issue #252). What this pins down:
--
--   * `on_deck_session_events` is a member of the `supabase_realtime`
--     publication, so a client can subscribe to its inserts;
--   * no other On Deck table joined the publication (Realtime is scoped to the
--     event log — the one thing every surface re-folds);
--   * the table's SELECT policies are unchanged, so the channel a client opens
--     is gated exactly as a REST read is: an open Session's events are
--     readable with no account (ADR 0006), a closed Session's are not.
--
-- The fold, the event schema, and every write path are untouched by this
-- ticket and stay covered by their own suites.

begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

-- The event log is published for Realtime.
select is(
  (select count(*)::int
   from pg_publication_tables
   where pubname = 'supabase_realtime'
     and schemaname = 'public'
     and tablename = 'on_deck_session_events'),
  1,
  'on_deck_session_events is on the supabase_realtime publication'
);

-- The Clubs and Sessions tables are not — Realtime is scoped to the log.
select is(
  (select count(*)::int
   from pg_publication_tables
   where pubname = 'supabase_realtime'
     and schemaname = 'public'
     and tablename in ('on_deck_clubs', 'on_deck_sessions')),
  0,
  'neither on_deck_clubs nor on_deck_sessions joined the publication'
);

-- REPLICA IDENTITY FULL — so a DELETE's old row image carries session_id and
-- Realtime can match the channel filter (operator Undo #247 is a DELETE).
select is(
  (select relreplident from pg_class where oid = 'public.on_deck_session_events'::regclass),
  'f',
  'on_deck_session_events is REPLICA IDENTITY FULL, so DELETE notifies match the session filter'
);

-- RLS is still on, and the SELECT policies are the foundation's two (open
-- Session public, Organizer reads their own Club's) plus nothing new.
select is(
  (select relrowsecurity from pg_class where oid = 'public.on_deck_session_events'::regclass),
  true,
  'RLS stays enabled on on_deck_session_events'
);

select is(
  (select count(*)::int
   from pg_policies
   where schemaname = 'public'
     and tablename = 'on_deck_session_events'
     and cmd = 'SELECT'),
  2,
  'the two foundation SELECT policies are all there is — Realtime added none'
);

-- The channel authorizes like a REST read. Seed an open and a closed Session.
insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-0000-0000-0000000002c0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vanessa-rt@example.com');

insert into public.on_deck_clubs (id, owner_id, name, venue_name) values
  ('c1c1c1c1-0000-0000-0000-0000000002c0', '11111111-0000-0000-0000-0000000002c0', 'RT Club', 'Ramsden Park');

insert into public.on_deck_sessions (id, club_id, venue_name, court_count, group_cap, floor_mode, status, closed_at) values
  ('50000000-0000-0000-0000-0000000002c0', 'c1c1c1c1-0000-0000-0000-0000000002c0', 'Ramsden Park', 8, 4, 'hybrid', 'open', null),
  ('5c000000-0000-0000-0000-0000000002c0', 'c1c1c1c1-0000-0000-0000-0000000002c0', 'Ramsden Park', 8, 4, 'hybrid', 'closed', now());

insert into public.on_deck_session_events (session_id, type, operator_kind, operator_user_id) values
  ('50000000-0000-0000-0000-0000000002c0', 'SESSION_STARTED', 'organizer', '11111111-0000-0000-0000-0000000002c0'),
  ('5c000000-0000-0000-0000-0000000002c0', 'SESSION_STARTED', 'organizer', '11111111-0000-0000-0000-0000000002c0');

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

-- anon (a Player's phone) sees the open Session's events — the same predicate
-- Realtime evaluates per subscriber.
select is(
  (select count(*)::int from public.on_deck_session_events
   where session_id = '50000000-0000-0000-0000-0000000002c0'),
  1,
  'anon reads an open Session''s events, so the realtime channel delivers them'
);

-- ...but not the closed Session's — a client only ever receives its own
-- Session's events, and never a wrapped-up one.
select is(
  (select count(*)::int from public.on_deck_session_events
   where session_id = '5c000000-0000-0000-0000-0000000002c0'),
  0,
  'anon cannot read a closed Session''s events, so the channel would not deliver them'
);

select * from finish();

rollback;

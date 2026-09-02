-- On Deck: Session pre-creation and Club defaults (issue #254). What this pins:
--
--   * an Organizer can edit their Club's saved defaults through
--     `on_deck_update_club_defaults` (the one write path onto a Club), and
--     only their own Club moves;
--   * an Organizer can create / edit / delete a `scheduled` Session for their
--     own Club, at most one per date, and never for a Club that is not theirs;
--   * `on_deck_start_session` promotes a due `scheduled` Session — opening it
--     with its own venue / court count, not the Club defaults — and otherwise
--     builds a fresh Session as before;
--   * a `scheduled` Session is the owner's alone to read (not public like an
--     open one), and its row shape (no start time, a planned date) is enforced.

begin;

create extension if not exists pgtap with schema extensions;

select plan(32);

-- Vanessa owns a Club (8 courts); Cal is an unrelated Organizer (6 courts).
insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vanessa-254@example.com'),
  ('22222222-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cal-254@example.com');

insert into public.on_deck_clubs (id, owner_id, name, venue_name, court_count, group_cap, floor_mode) values
  ('c1c1c1c1-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'TO Pickleball Club', 'Ramsden Park', 8, 4, 'hybrid'),
  ('c2c2c2c2-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 'Cal''s Club', 'Some Other Park', 6, 3, 'self-serve');

-- ---- schema shape --------------------------------------------------------

select has_column('public', 'on_deck_sessions', 'scheduled_for',
  'on_deck_sessions carries a scheduled_for date');

select col_is_null('public', 'on_deck_sessions', 'started_at',
  'started_at is nullable now — a scheduled Session has no start time');

select has_index(
  'public', 'on_deck_sessions', 'on_deck_sessions_one_scheduled_per_day',
  'one scheduled Session per Club per date is a real partial unique index'
);

-- A scheduled Session must have a date and no start time.
select throws_ok(
  $$insert into public.on_deck_sessions
      (club_id, venue_name, court_count, group_cap, floor_mode, status, started_at, scheduled_for)
    values ('c1c1c1c1-0000-0000-0000-000000000001', 'Ramsden Park', 8, 4, 'hybrid', 'scheduled', now(), current_date)$$,
  '23514', null,
  'a scheduled Session cannot carry a start time'
);
select throws_ok(
  $$insert into public.on_deck_sessions
      (club_id, venue_name, court_count, group_cap, floor_mode, status, started_at, scheduled_for)
    values ('c1c1c1c1-0000-0000-0000-000000000001', 'Ramsden Park', 8, 4, 'hybrid', 'scheduled', null, null)$$,
  '23514', null,
  'a scheduled Session needs a planned date'
);

-- ---- as Vanessa: Club defaults ------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-0000-0000-0000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$select public.on_deck_update_club_defaults('Trinity Bellwoods', 10, 5)$$,
  'an Organizer can edit their Club''s saved defaults'
);

select row_eq(
  $$select venue_name, court_count, group_cap
    from public.on_deck_clubs where id = 'c1c1c1c1-0000-0000-0000-000000000001'$$,
  row('Trinity Bellwoods'::text, 10, 5),
  'the new defaults persisted'
);

select is(
  (select owner_id from public.on_deck_clubs where id = 'c1c1c1c1-0000-0000-0000-000000000001'),
  '11111111-0000-0000-0000-000000000001'::uuid,
  'the owner is untouched by a defaults edit'
);

select throws_ok(
  $$select public.on_deck_update_club_defaults('Ramsden Park', 50, 4)$$,
  '23514', null,
  'the table CHECK constraints backstop an out-of-range court count'
);

-- ---- as Vanessa: scheduling a Session ----------------------------------
-- A Session for today, with its own venue and a court count distinct from the
-- Club default (10, just set above).
select lives_ok(
  $$select public.on_deck_create_scheduled_session(
      'c1c1c1c1-0000-0000-0000-000000000001', current_date, 'Christie Pits', 6
    )$$,
  'an Organizer can schedule a Session for their own Club'
);

select row_eq(
  $$select status, started_at is null, scheduled_for = current_date,
           venue_name, court_count, group_cap, floor_mode
    from public.on_deck_sessions where club_id = 'c1c1c1c1-0000-0000-0000-000000000001'$$,
  row('scheduled'::text, true, true, 'Christie Pits'::text, 6, 5, 'hybrid'::text),
  'the scheduled Session carries its own venue / court count; group cap + floor mode come from the Club'
);

-- One per date.
select throws_ok(
  $$select public.on_deck_create_scheduled_session(
      'c1c1c1c1-0000-0000-0000-000000000001', current_date, 'Somewhere Else', 4
    )$$,
  '23505', null,
  'a second scheduled Session for the same date is refused'
);

-- Not for a Club that is not yours.
select throws_ok(
  $$select public.on_deck_create_scheduled_session(
      'c2c2c2c2-0000-0000-0000-000000000002', current_date + 1, 'Nope', 4
    )$$,
  '42501', null,
  'an Organizer cannot schedule a Session for another Organizer''s Club'
);

-- Edit the scheduled Session.
select lives_ok(
  $$select public.on_deck_update_scheduled_session(
      (select id from public.on_deck_sessions where club_id = 'c1c1c1c1-0000-0000-0000-000000000001'),
      current_date, 'Christie Pits', 7
    )$$,
  'an Organizer can edit their not-yet-open Session'
);

select is(
  (select court_count from public.on_deck_sessions where club_id = 'c1c1c1c1-0000-0000-0000-000000000001'),
  7,
  'the edit persisted'
);

-- ---- as an anonymous Player: a scheduled Session is not public ---------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  (select count(*)::int from public.on_deck_sessions
   where club_id = 'c1c1c1c1-0000-0000-0000-000000000001'),
  0,
  'a scheduled Session is invisible with no account — unlike an open one'
);

select throws_ok(
  $$select public.on_deck_update_club_defaults('Hacked', 1, 2)$$,
  '42501', null,
  'the defaults RPC is not callable with no account'
);

-- ---- as Cal: another Organizer cannot touch Vanessa's ------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-0000-0000-0000-000000000002", "role": "authenticated"}';

select is(
  (select count(*)::int from public.on_deck_sessions
   where club_id = 'c1c1c1c1-0000-0000-0000-000000000001'),
  0,
  'an unrelated Organizer cannot see another Club''s scheduled Session'
);

-- Cal names Vanessa's scheduled Session by id (banked as the superuser, since
-- RLS hides it from him) and still cannot edit it.
set local role postgres;
create temporary table _van_sched on commit drop as
  select s.id from public.on_deck_sessions s
  where s.club_id = 'c1c1c1c1-0000-0000-0000-000000000001' and s.status = 'scheduled';
set local role authenticated;

select throws_ok(
  $$select public.on_deck_update_scheduled_session(
      (select id from _van_sched), current_date, 'Cal was here', 2
    )$$,
  '42501', null,
  'an unrelated Organizer cannot edit another Club''s scheduled Session'
);

select lives_ok(
  $$select public.on_deck_update_club_defaults('Cal Park', 4, 3)$$,
  'Cal edits his own defaults'
);

set local role postgres;
select is(
  (select venue_name from public.on_deck_clubs where id = 'c1c1c1c1-0000-0000-0000-000000000001'),
  'Trinity Bellwoods',
  'Vanessa''s Club is untouched by Cal editing his own'
);
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-0000-0000-0000-000000000002", "role": "authenticated"}';

-- Cal schedules one for tomorrow, then Start with no due Session builds fresh.
select public.on_deck_create_scheduled_session(
  'c2c2c2c2-0000-0000-0000-000000000002', current_date + 1, 'Future Park', 9
);

select lives_ok(
  $$select public.on_deck_start_session('c2c2c2c2-0000-0000-0000-000000000002')$$,
  'Start with no *due* scheduled Session opens a fresh one'
);

select row_eq(
  $$select status, court_count, venue_name
    from public.on_deck_sessions
    where club_id = 'c2c2c2c2-0000-0000-0000-000000000002' and status = 'open'$$,
  row('open'::text, 4, 'Cal Park'::text),
  'the fresh Session came from the Club defaults, not the future scheduled one'
);

select is(
  (select count(*)::int from public.on_deck_sessions
   where club_id = 'c2c2c2c2-0000-0000-0000-000000000002' and status = 'scheduled'),
  1,
  'the future scheduled Session is still waiting'
);

-- ---- as Vanessa: Start promotes the due scheduled Session --------------
set local request.jwt.claims = '{"sub": "11111111-0000-0000-0000-000000000001", "role": "authenticated"}';

-- The scheduled Session was created while the Club group cap was 5. Change it
-- now — the promote must pick up the *current* Club value (group cap and Floor
-- Mode are Club settings, not frozen at schedule time).
select public.on_deck_update_club_defaults('Trinity Bellwoods', 10, 6);

-- The scheduled Session's id, banked before Start so we can prove Start
-- *promoted* that row rather than opening a fresh one.
select results_eq(
  $$select id from public.on_deck_sessions
    where club_id = 'c1c1c1c1-0000-0000-0000-000000000001' and status = 'scheduled'$$,
  $$select public.on_deck_start_session('c1c1c1c1-0000-0000-0000-000000000001')$$,
  'Start opens the due scheduled Session itself — same row id, not a new one'
);

select row_eq(
  $$select status, court_count, venue_name, group_cap,
           started_at is not null, scheduled_for is null
    from public.on_deck_sessions
    where club_id = 'c1c1c1c1-0000-0000-0000-000000000001'$$,
  row('open'::text, 7, 'Christie Pits'::text, 6, true, true),
  'the promoted Session carries its own venue / court count, but the Club''s current group cap'
);

select is(
  (select payload->>'courtCount' from public.on_deck_session_events se
   join public.on_deck_sessions s on s.id = se.session_id
   where s.club_id = 'c1c1c1c1-0000-0000-0000-000000000001' and se.type = 'SESSION_STARTED'),
  '7',
  'the SESSION_STARTED payload reflects the scheduled Session''s court count'
);

select is(
  (select payload->>'groupCap' from public.on_deck_session_events se
   join public.on_deck_sessions s on s.id = se.session_id
   where s.club_id = 'c1c1c1c1-0000-0000-0000-000000000001' and se.type = 'SESSION_STARTED'),
  '6',
  'the SESSION_STARTED payload carries the Club''s current group cap, not the frozen one'
);

-- Start again while a Session is already open trips the one-open-per-Club index.
select throws_ok(
  $$select public.on_deck_start_session('c1c1c1c1-0000-0000-0000-000000000001')$$,
  '23505', null,
  'a second Start while a Session is open is refused by the one-open-per-Club index'
);

select is(
  (select count(*)::int from public.on_deck_sessions
   where club_id = 'c1c1c1c1-0000-0000-0000-000000000001'),
  1,
  'no fresh Session was created alongside the promoted one'
);

-- Delete path: a closed/open Session is never removed here, a scheduled one is.
select throws_ok(
  $$select public.on_deck_delete_scheduled_session(
      (select id from public.on_deck_sessions
       where club_id = 'c1c1c1c1-0000-0000-0000-000000000001')
    )$$,
  '42501', null,
  'the delete RPC refuses a Session that is not scheduled'
);

set local request.jwt.claims = '{"sub": "22222222-0000-0000-0000-000000000002", "role": "authenticated"}';
select lives_ok(
  $$select public.on_deck_delete_scheduled_session(
      (select id from public.on_deck_sessions
       where club_id = 'c2c2c2c2-0000-0000-0000-000000000002' and status = 'scheduled')
    )$$,
  'an Organizer can drop their own planned Session'
);

select finish();
rollback;

-- On Deck: an Organizer creates their own Club (issue #515). What this pins:
--
--   * the public write path is a `security definer` RPC and nothing else —
--     `on_deck_clubs` gains no INSERT grant for any role, so a signed-in
--     stranger still cannot write a row naming whatever `owner_id` they like;
--   * one Club per owner survives the new door. The second attempt is refused
--     with a sentence, not a constraint name, because the function checks
--     before it inserts — and the unique index is still there behind it;
--   * an unauthenticated caller is refused for want of an `auth.uid()`, and
--     `anon` is refused for want of a grant. Those are two different facts and
--     this file asserts both, because the wrong one passes for the wrong
--     reason;
--   * which values the RPC validates itself (a 22023 the form can phrase) and
--     which ones only the table's own CHECK constraints refuse (a 23514);
--   * what a two-field create leaves behind: venue name copied from the Club
--     name, group cap and Floor Mode on the schema's defaults, and the clock
--     deliberately null so the Organizer's browser can fill it in later;
--   * Settings can reach everything that create guessed — the name and the
--     Floor Mode included, which `on_deck_update_club_defaults` could not
--     touch while Clubs were seeded by hand.

begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-0000-0000-000000000515', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'organizer-515@example.com'),
  ('22222222-0000-0000-0000-000000000515', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stranger-515@example.com');

-- ---- the shape of the door -------------------------------------------------

select has_function(
  'public', 'on_deck_create_club', array['text', 'integer'],
  'on_deck_create_club(text, integer) exists'
);

-- The whole reason this function exists: its callers hold no INSERT on the
-- table, so without definer rights every assertion below would fail.
select is_definer(
  'public', 'on_deck_create_club', array['text', 'integer'],
  'and runs as definer, because nobody who calls it may insert a Club'
);

select function_privs_are(
  'public', 'on_deck_create_club', array['text', 'integer'], 'authenticated',
  array['EXECUTE'],
  'a signed-in Organizer may call it'
);

select function_privs_are(
  'public', 'on_deck_create_club', array['text', 'integer'], 'anon',
  array[]::text[],
  'and a caller with no account holds no grant on it at all'
);

-- ---- and the door it is not: the table's grants are unchanged --------------

-- Exhaustive lists rather than "has no INSERT", so a stray UPDATE grant added
-- later fails here too. REFERENCES, TRIGGER and TRUNCATE are not ours: they
-- are Supabase's default privileges, which every table in this project carries
-- for these roles and which PostgREST exposes no way to use. The DML column is
-- the one this ticket could have moved, and it does not.
select table_privs_are(
  'public', 'on_deck_clubs', 'authenticated',
  array['SELECT', 'REFERENCES', 'TRIGGER', 'TRUNCATE'],
  'an Organizer still only reads the Club table — creation granted no INSERT'
);

select table_privs_are(
  'public', 'on_deck_clubs', 'anon',
  array['REFERENCES', 'TRIGGER', 'TRUNCATE'],
  'and a Player still cannot read one row of it, let alone write'
);

select table_privs_are(
  'public', 'on_deck_clubs', 'service_role',
  array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'REFERENCES', 'TRIGGER', 'TRUNCATE'],
  'service_role remains the only role that can write the table directly'
);

-- ---- nobody signed in ------------------------------------------------------

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

-- Refused for want of a *grant*. Distinct from the refusal below, which is the
-- function's own check: an anon caller never gets far enough to run it.
select throws_ok(
  $$select public.on_deck_create_club('Drive-by Pickleball', 4)$$,
  '42501',
  'permission denied for function on_deck_create_club',
  'a caller with no account cannot even reach the function'
);

reset role;

-- A session on the `authenticated` role with no `sub` claim — a token the
-- gateway accepted but that names no user. Refused by the function itself.
set local role authenticated;
set local request.jwt.claims = '{"role": "authenticated"}';

select throws_ok(
  $$select public.on_deck_create_club('Nameless Pickleball', 4)$$,
  '42501',
  'not signed in',
  'and a token naming no user is refused by the function, not by a grant'
);

reset role;

-- ---- the Organizer, creating their first Club ------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-0000-0000-0000-000000000515", "role": "authenticated"}';

-- The posture this function is written around, restated as a test: an
-- Organizer cannot insert their own Club row, however honest the values.
select throws_ok(
  $$insert into public.on_deck_clubs (owner_id, name, venue_name, court_count)
    values ('11111111-0000-0000-0000-000000000515', 'Direct', 'Direct', 4)$$,
  '42501',
  'permission denied for table on_deck_clubs',
  'the Organizer cannot write the table directly, which is why the RPC exists'
);

select lives_ok(
  $$select public.on_deck_create_club('  Riverside   Pickleball  ', 6)$$,
  'but they can create their own Club, in two fields'
);

select is(
  (select name from public.on_deck_clubs where owner_id = '11111111-0000-0000-0000-000000000515'),
  'Riverside Pickleball',
  'the name is trimmed and its runs of whitespace collapsed'
);

select is(
  (select venue_name from public.on_deck_clubs where owner_id = '11111111-0000-0000-0000-000000000515'),
  'Riverside Pickleball',
  'the venue starts as the Club''s own name, which is right for a club with one home'
);

select is(
  (select court_count from public.on_deck_clubs where owner_id = '11111111-0000-0000-0000-000000000515'),
  6,
  'the court count is the one they gave'
);

select is(
  (select group_cap from public.on_deck_clubs where owner_id = '11111111-0000-0000-0000-000000000515'),
  4,
  'the group cap they were not asked for takes the schema''s default'
);

select is(
  (select floor_mode from public.on_deck_clubs where owner_id = '11111111-0000-0000-0000-000000000515'),
  'hybrid',
  'and so does Floor Mode'
);

-- Null on purpose, not an oversight: `on_deck_adopt_club_time_zone` reads the
-- zone off the Organizer's own browser on their first visit (issue #469), and
-- it can only ever fill a blank one. A create form that guessed a zone here
-- would be a guess nothing is allowed to correct.
select is(
  (select time_zone from public.on_deck_clubs where owner_id = '11111111-0000-0000-0000-000000000515'),
  null,
  'the clock is left unset, for the Organizer''s browser to adopt'
);

-- ---- one per owner ---------------------------------------------------------

-- 23505, not the 42501 the unauthenticated cases raise. A uniqueness
-- collision and "we do not know who you are" are different facts, and the
-- caller acts on them differently: one lands the Organizer on the Club they
-- already have, the other is an error.
select throws_ok(
  $$select public.on_deck_create_club('A Second Club', 4)$$,
  '23505',
  'this account already has a Club',
  'a second Club for the same account is refused, in a sentence'
);

select is(
  (select count(*)::int from public.on_deck_clubs where owner_id = '11111111-0000-0000-0000-000000000515'),
  1,
  'and the account still owns exactly one'
);

-- ---- what the RPC validates ------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-0000-0000-0000-000000000515", "role": "authenticated"}';

select throws_ok(
  $$select public.on_deck_create_club('   ', 4)$$,
  '22023',
  'a club name is required',
  'a name of nothing but spaces is refused before the table sees it'
);

select throws_ok(
  $$select public.on_deck_create_club(repeat('x', 121), 4)$$,
  '22023',
  'a club name is at most 120 characters',
  'and so is one past the column''s limit'
);

select throws_ok(
  $$select public.on_deck_create_club('Zero Court Pickleball', 0)$$,
  '22023',
  'court count must be between 1 and 40',
  'a court count below the range is refused by the function'
);

select throws_ok(
  $$select public.on_deck_create_club('Too Many Courts', 41)$$,
  '22023',
  'court count must be between 1 and 40',
  'and so is one above it'
);

select is(
  (select count(*)::int from public.on_deck_clubs where owner_id = '22222222-0000-0000-0000-000000000515'),
  0,
  'none of those refusals left a row behind'
);

reset role;

-- ---- what the table backstops ----------------------------------------------

-- The same bad values, arriving by the one path that skips the function. The
-- point of asserting this separately is that the two layers refuse for
-- different reasons and return different errors, and a test that only pinned
-- the 22023 would still pass if the CHECK constraints were dropped.
select throws_ok(
  $$insert into public.on_deck_clubs (owner_id, name, venue_name, court_count)
    values ('22222222-0000-0000-0000-000000000515', 'Too Many Courts', 'Too Many Courts', 41)$$,
  '23514',
  null,
  'the table itself still refuses an out-of-range court count'
);

select throws_ok(
  $$insert into public.on_deck_clubs (owner_id, name, venue_name, court_count)
    values ('22222222-0000-0000-0000-000000000515', '   ', '   ', 4)$$,
  '23514',
  null,
  'and a blank name'
);

-- ---- everything create guessed is editable afterwards ----------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-0000-0000-0000-000000000515", "role": "authenticated"}';

select lives_ok(
  $$select public.on_deck_update_club_defaults('Riverside Pickleball Club', 'Riverside Community Centre', 10, 6, 'self-serve')$$,
  'Settings reaches the name and the Floor Mode as well as the Session defaults'
);

select results_eq(
  $$select name, venue_name, court_count, group_cap, floor_mode
    from public.on_deck_clubs
    where owner_id = '11111111-0000-0000-0000-000000000515'$$,
  $$values ('Riverside Pickleball Club'::text, 'Riverside Community Centre'::text, 10::integer, 6::integer, 'self-serve'::text)$$,
  'so no early guess is permanent'
);

reset role;

select * from finish();

rollback;

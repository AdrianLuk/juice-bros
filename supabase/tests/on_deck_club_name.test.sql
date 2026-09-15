-- On Deck: a Club's name on the link it gives away (issue #510). What this pins:
--
--   * `on_deck_clubs` stays owner-only. An anonymous Player still reads not one
--     row of it, which is the whole reason this function has to exist;
--   * `on_deck_club_name` hands that Player the single column their club's
--     printed sign already shows them, and nothing beside it;
--   * an id matching no Club comes back null rather than raising, so a link
--     that was mistyped and a link to a Club that never existed look the same
--     from outside;
--   * it is a public read and not a privileged one: a signed-in Organizer who
--     owns some other Club gets exactly the same answer as a stranger.

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

select has_function(
  'public', 'on_deck_club_name', array['uuid'],
  'on_deck_club_name(uuid) exists'
);

-- The security property the rest of this file leans on. Without definer rights
-- the function would read as its caller, which is precisely the role that RLS
-- gives nothing to, and every assertion below would pass by returning null.
select is_definer(
  'public', 'on_deck_club_name', array['uuid'],
  'and runs as definer, because its callers cannot read the table'
);

select function_privs_are(
  'public', 'on_deck_club_name', array['uuid'], 'anon', array['EXECUTE'],
  'a Player holding the link, with no account, may call it'
);

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-0000-0000-000000000510', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-510@example.com'),
  ('22222222-0000-0000-0000-000000000510', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stranger-510@example.com');

insert into public.on_deck_clubs (id, owner_id, name, venue_name, court_count, group_cap, floor_mode) values
  ('c5c5c5c5-0000-0000-0000-000000000510', '11111111-0000-0000-0000-000000000510', 'Riverside Pickleball Club', 'Riverside Community Centre', 6, 4, 'hybrid');

-- ---- the Player, who has nothing -------------------------------------------

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

-- Stronger than "RLS returns nothing": `anon` holds no grant on this table, so
-- the read is refused outright rather than filtered to zero rows. That is the
-- posture the function is written around, and it is worth pinning as such.
select throws_ok(
  $$select count(*) from public.on_deck_clubs$$,
  '42501',
  'permission denied for table on_deck_clubs',
  'anon cannot read the Club table at all'
);

select is(
  public.on_deck_club_name('c5c5c5c5-0000-0000-0000-000000000510'),
  'Riverside Pickleball Club',
  'but does get the name, which is already the biggest thing on their sign'
);

select is(
  public.on_deck_club_name('ffffffff-0000-0000-0000-000000000510'),
  null,
  'an id matching no Club is null rather than an error'
);

reset role;

-- ---- an Organizer of some other Club ----------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "22222222-0000-0000-0000-000000000510", "role": "authenticated"}';

select is(
  (select count(*)::int from public.on_deck_clubs),
  0,
  'somebody else''s Organizer reads none of this Club either'
);

select is(
  public.on_deck_club_name('c5c5c5c5-0000-0000-0000-000000000510'),
  'Riverside Pickleball Club',
  'and still gets the name, because this read is public on purpose'
);

reset role;

-- ---- the owner, unchanged ---------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-0000-0000-0000-000000000510", "role": "authenticated"}';

select is(
  (select count(*)::int from public.on_deck_clubs),
  1,
  'the owner still reads their own Club row, as they always could'
);

reset role;

select * from finish();

rollback;

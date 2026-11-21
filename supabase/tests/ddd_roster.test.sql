-- Dink Dine & Drink: the roster (issue #712). What this pins down:
--
--   * an outsider can't set a roster;
--   * an Organizer replaces the roster in one call: 4 Teams, players in
--     order, blank ratings kept blank; a second paste replaces the first;
--   * anything but 4 Teams is refused and leaves the old roster alone;
--   * out-of-range ratings are refused by the table;
--   * a link holder sees the Teams with their players, and no more.

begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, instance_id, aud, role, email) values
  ('71271271-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ddd-roster-organizer@example.com'),
  ('71271271-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ddd-roster-outsider@example.com');
insert into public.ddd_organizers (user_id) values ('71271271-0000-0000-0000-00000000000a');

-- A DDD to hang the roster on.
insert into public.ddd_events (id, name, event_date, play_venue, dine_venue)
values ('71271271-1111-0000-0000-000000000001', 'Roster DDD', '2026-11-28', 'Rec Hall', 'Noodle Bar');

create temporary table ddd_roster_four (teams jsonb) on commit drop;
insert into ddd_roster_four
select jsonb_agg(
  jsonb_build_object(
    'name', t,
    'players', jsonb_build_array(
      jsonb_build_object('name', t, 'gender', 'M', 'dupr', 4.258, 'duar', null, 'dusr', null),
      jsonb_build_object('name', t || ' partner', 'gender', 'F', 'dupr', 3.5, 'duar', 3.5, 'dusr', 3.0)
    )
  ) order by t
)
from unnest(array['Ann', 'Bo', 'Cy', 'Di']) as t;
grant all on ddd_roster_four to authenticated;

set local role authenticated;

-- ---- an outsider -------------------------------------------------------------
set local request.jwt.claims = '{"sub": "71271271-0000-0000-0000-00000000000c", "role": "authenticated"}';
select throws_ok(
  $$select public.ddd_replace_roster('71271271-1111-0000-0000-000000000001', (select teams from ddd_roster_four))$$,
  '42501',
  null,
  'an outsider can''t set a roster'
);

-- ---- an Organizer ------------------------------------------------------------
set local request.jwt.claims = '{"sub": "71271271-0000-0000-0000-00000000000a", "role": "authenticated"}';
select lives_ok(
  $$select public.ddd_replace_roster('71271271-1111-0000-0000-000000000001', (select teams from ddd_roster_four))$$,
  'an Organizer sets the roster'
);
select is(
  (select count(*)::int from public.ddd_players p join public.ddd_teams t on t.id = p.team_id
   where t.event_id = '71271271-1111-0000-0000-000000000001'),
  8,
  '4 Teams of 2 are saved'
);
select is(
  (select dupr || '/' || coalesce(duar::text, 'blank') from public.ddd_players where name = 'Ann'),
  '4.258/blank',
  'a blank rating stays blank'
);
select throws_ok(
  $$select public.ddd_replace_roster('71271271-1111-0000-0000-000000000001', '[]'::jsonb)$$,
  '22023',
  null,
  'anything but 4 Teams is refused'
);
select is(
  (select count(*)::int from public.ddd_teams where event_id = '71271271-1111-0000-0000-000000000001'),
  4,
  'and leaves the roster as it was'
);
select throws_ok(
  $$insert into public.ddd_players (team_id, position, name, gender, duar)
    select id, 9, 'Too good', 'M', 7.5 from public.ddd_teams limit 1$$,
  '23514',
  null,
  'a DUAR above 7.0 is refused by the table'
);
select lives_ok(
  $$select public.ddd_replace_roster('71271271-1111-0000-0000-000000000001', (select jsonb_agg(t order by t ->> 'name' desc) from jsonb_array_elements((select teams from ddd_roster_four)) t))$$,
  'pasting again replaces the roster'
);

-- ---- anon, holding a link ----------------------------------------------------
reset role;
create temporary table ddd_roster_token on commit drop as select public_token from public.ddd_events;
grant all on ddd_roster_token to anon;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(
  (public.ddd_link_event((select public_token from ddd_roster_token)) -> 'teams' -> 0 ->> 'name')
    || ' ' || jsonb_array_length(public.ddd_link_event((select public_token from ddd_roster_token)) -> 'teams' -> 0 -> 'players'),
  'Di 2',
  'a link shows the Teams in order, each with its players'
);

select * from finish();
rollback;

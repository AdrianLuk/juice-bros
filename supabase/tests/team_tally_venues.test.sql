-- Team Tally: Venues and who can reach them (issue #698). What this pins down:
--
--   * an Organizer saves, lists, renames and forgets their own Venues;
--   * two of their Venues can't share a name, however it is capitalised;
--   * another User can't read, change or delete them, or save one in their name;
--   * the Superadmin reads and fixes any Organizer's Venue;
--   * `anon` has no access at all;
--   * a Venue with no courts, or a grid that isn't one, is refused.

begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

select has_table('public', 'team_tally_venues', 'Venues are a table');

insert into auth.users (id, instance_id, aud, role, email) values
  ('69869869-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tt-venue-a@example.com'),
  ('69869869-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tt-venue-b@example.com'),
  ('69869869-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tt-venue-super@example.com');

-- ---- as Organizer A ----------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "69869869-0000-0000-0000-00000000000a", "role": "authenticated"}';

select lives_ok(
  $$insert into public.team_tally_venues (name, grid) values
      ('Rec Centre North', '{"courts": [{"row": 0, "col": 0, "number": 16}, {"row": 0, "col": 1, "number": 17}]}')$$,
  'an Organizer saves a Venue'
);
select is(
  (select owner_id from public.team_tally_venues),
  '69869869-0000-0000-0000-00000000000a'::uuid,
  'it is theirs'
);
select throws_ok(
  $$insert into public.team_tally_venues (name, grid) values
      ('  rec centre NORTH ', '{"courts": [{"row": 0, "col": 0, "number": 1}]}')$$,
  '23505',
  null,
  'a second Venue with the same name is refused'
);
select throws_ok(
  $$insert into public.team_tally_venues (name, grid) values ('Empty hall', '{"courts": []}')$$,
  '23514',
  null,
  'a Venue with no courts is refused'
);
select throws_ok(
  $$insert into public.team_tally_venues (name, grid) values ('Not a grid', '[1, 2]')$$,
  '23514',
  null,
  'a grid that is not one is refused'
);
select lives_ok(
  $$update public.team_tally_venues set name = 'North Hall' where name = 'Rec Centre North'$$,
  'they rename it'
);

-- ---- as Organizer B ----------------------------------------------------------
set local request.jwt.claims = '{"sub": "69869869-0000-0000-0000-00000000000b", "role": "authenticated"}';

select is((select count(*)::int from public.team_tally_venues), 0, 'another User lists none of A''s Venues');
update public.team_tally_venues set name = 'Taken' where name = 'North Hall';
delete from public.team_tally_venues where name = 'North Hall';
select throws_ok(
  $$insert into public.team_tally_venues (owner_id, name, grid) values
      ('69869869-0000-0000-0000-00000000000a', 'Planted', '{"courts": [{"row": 0, "col": 0, "number": 1}]}')$$,
  '42501',
  null,
  'nor saves one in A''s name'
);
select lives_ok(
  $$insert into public.team_tally_venues (name, grid) values
      ('North Hall', '{"courts": [{"row": 0, "col": 0, "number": 1}]}')$$,
  'and the same name is free for them'
);

-- ---- anon ------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$select count(*) from public.team_tally_venues$$,
  '42501',
  null,
  'anon can''t read Venues'
);

-- ---- the Superadmin ----------------------------------------------------------
reset role;
insert into public.team_tally_superadmins (user_id) values ('69869869-0000-0000-0000-00000000000c');
set local role authenticated;
set local request.jwt.claims = '{"sub": "69869869-0000-0000-0000-00000000000c", "role": "authenticated"}';

select is((select count(*)::int from public.team_tally_venues), 2, 'the Superadmin reads every Organizer''s Venues');
select lives_ok(
  $$update public.team_tally_venues set name = 'North Hall (fixed)'
    where owner_id = '69869869-0000-0000-0000-00000000000a'$$,
  'and fixes one'
);

-- ---- back as Organizer A -----------------------------------------------------
set local request.jwt.claims = '{"sub": "69869869-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is(
  (select name from public.team_tally_venues),
  'North Hall (fixed)',
  'B''s update and delete did nothing to A''s Venue, and the Superadmin''s fix stuck'
);
select lives_ok(
  $$delete from public.team_tally_venues where name = 'North Hall (fixed)'$$,
  'A forgets it'
);
select is((select count(*)::int from public.team_tally_venues), 0, 'and it is gone');

select * from finish();
rollback;

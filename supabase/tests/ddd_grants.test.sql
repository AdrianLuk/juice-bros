-- Dink Dine & Drink: who may call which function, and who may write the
-- Superadmin table (issue #711). What this pins down:
--
--   * a link holder (anon) calls only the token read;
--   * a signed-in User calls that and the Organizer's functions, each of
--     which checks the Organizer list itself;
--   * nobody but the SQL editor writes `ddd_superadmins`: not anon, not a
--     signed-in User, not service_role. The repo is public, so the one row is
--     added by hand on prod.
--
-- Exhaustive on purpose: a new ddd_ function fails the count below until it
-- is listed here with the roles it is meant for.

begin;

create extension if not exists pgtap with schema extensions;

select plan(25);

create temporary table ddd_expected (fn text, args text[], anon boolean, signed_in boolean) on commit drop;
insert into ddd_expected values
  -- Link holders and signed-in Users.
  ('ddd_link_event', array['text'], true, true),
  ('ddd_save_dreambreaker', array['text', 'uuid', 'uuid', 'integer', 'integer'], true, true),
  ('ddd_save_game', array['text', 'uuid', 'uuid', 'text', 'integer', 'integer'], true, true),
  -- The live broadcast trigger: nobody calls it.
  ('ddd_broadcast_change', array[]::text[], false, false),
  -- Signed-in Users; each refuses anyone off the Organizer list.
  ('ddd_is_organizer', array[]::text[], false, true),
  ('ddd_create_invite', array[]::text[], false, true),
  ('ddd_join', array['text'], false, true),
  ('ddd_save_event', array['uuid', 'text', 'date', 'text', 'text', 'text[]'], false, true),
  ('ddd_replace_roster', array['uuid', 'jsonb'], false, true),
  ('ddd_set_rotation', array['uuid', 'uuid[]'], false, true);

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'ddd\_%'),
  (select count(*)::int from ddd_expected),
  'every DDD function is listed here with the roles it is for'
);

select function_privs_are(
  'public', e.fn, e.args, 'anon',
  case when e.anon then array['EXECUTE'] else array[]::text[] end,
  format('%s: anon %s', e.fn, case when e.anon then 'may call it' else 'holds no grant' end)
)
from ddd_expected e
order by e.fn;

select function_privs_are(
  'public', e.fn, e.args, 'authenticated',
  case when e.signed_in then array['EXECUTE'] else array[]::text[] end,
  format('%s: a signed-in User %s', e.fn, case when e.signed_in then 'may call it' else 'holds no grant' end)
)
from ddd_expected e
order by e.fn;

select table_privs_are('public', 'ddd_superadmins', 'anon', array[]::text[], 'anon holds nothing on ddd_superadmins');
select table_privs_are('public', 'ddd_superadmins', 'authenticated', array[]::text[], 'a signed-in User holds nothing on ddd_superadmins');
select table_privs_are('public', 'ddd_superadmins', 'service_role', array[]::text[], 'service_role holds nothing on ddd_superadmins');

set local role service_role;
select throws_ok(
  $$insert into public.ddd_superadmins (user_id) values (gen_random_uuid())$$,
  '42501',
  null,
  'service_role can''t insert into ddd_superadmins'
);
reset role;

select * from finish();
rollback;

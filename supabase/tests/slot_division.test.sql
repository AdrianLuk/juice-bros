-- A Slot's Division (issue #80) — which gender composition its Capacity
-- signal is broken down by. Defaults to "open" so every existing Slot's
-- behaviour is unchanged; this test focuses on the column's own shape and
-- constraint, not slots.test.sql's RLS suite, which this column doesn't
-- alter.

begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select has_column('public', 'slots', 'division', 'slots.division exists');

insert into auth.users (id, instance_id, aud, role, email)
values (
  '99999999-9999-9999-9999-999999999999',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'division-owner@example.com'
);

insert into public.slots (id, owner_id, proposed_start, proposed_end, time_zone)
values (
  '99999999-0000-0000-0000-000000000080',
  '99999999-9999-9999-9999-999999999999',
  '2031-08-22 13:00:00+00',
  '2031-08-22 14:30:00+00',
  'America/Toronto'
);

select is(
  (select division from public.slots where id = '99999999-0000-0000-0000-000000000080'),
  'open',
  'division defaults to open — every existing slot keeps today''s plain count'
);

update public.slots set division = 'mixed' where id = '99999999-0000-0000-0000-000000000080';
select is(
  (select division from public.slots where id = '99999999-0000-0000-0000-000000000080'),
  'mixed',
  'division can be set to mixed'
);

update public.slots set division = 'mens' where id = '99999999-0000-0000-0000-000000000080';
select is(
  (select division from public.slots where id = '99999999-0000-0000-0000-000000000080'),
  'mens',
  'and to mens'
);

update public.slots set division = 'womens' where id = '99999999-0000-0000-0000-000000000080';
select is(
  (select division from public.slots where id = '99999999-0000-0000-0000-000000000080'),
  'womens',
  'and to womens'
);

select throws_ok(
  $$ update public.slots set division = 'coed' where id = '99999999-0000-0000-0000-000000000080' $$,
  '23514',
  null,
  'division is constrained to open/mixed/mens/womens'
);

-- Owner-editable via the same RLS policy the rest of the table already has —
-- a smoke test, not a full re-exercise of slots.test.sql's own RLS suite.
set local role authenticated;
set local request.jwt.claims = '{"sub": "99999999-9999-9999-9999-999999999999", "role": "authenticated"}';

select lives_ok(
  $$ update public.slots set division = 'open' where id = '99999999-0000-0000-0000-000000000080' $$,
  'the owner can set their own slot''s division through the existing update policy'
);

reset role;

select * from finish();

rollback;

-- A User's own Gender (issue #79) — optional, self-reported, owner-only per
-- the same RLS policies profiles.test.sql already exercises for the rest of
-- the table (this column adds no new policy, so this test focuses on the
-- column's own shape and constraint rather than repeating RLS end-to-end).

begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select has_column('public', 'profiles', 'gender', 'profiles.gender exists');

insert into auth.users (id, instance_id, aud, role, email)
values (
  '77777777-7777-7777-7777-777777777777',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'gender-owner@example.com'
);

select is(
  (select gender from public.profiles where id = '77777777-7777-7777-7777-777777777777'),
  null,
  'gender is unset by default, not a fourth value standing in for "unset"'
);

update public.profiles set gender = 'male' where id = '77777777-7777-7777-7777-777777777777';
select is(
  (select gender from public.profiles where id = '77777777-7777-7777-7777-777777777777'),
  'male',
  'gender can be set to male'
);

update public.profiles set gender = 'female' where id = '77777777-7777-7777-7777-777777777777';
select is(
  (select gender from public.profiles where id = '77777777-7777-7777-7777-777777777777'),
  'female',
  'and changed to female'
);

update public.profiles set gender = null where id = '77777777-7777-7777-7777-777777777777';
select is(
  (select gender from public.profiles where id = '77777777-7777-7777-7777-777777777777'),
  null,
  'and cleared back to unset — not a one-way choice'
);

select throws_ok(
  $$ update public.profiles set gender = 'nonbinary' where id = '77777777-7777-7777-7777-777777777777' $$,
  '23514',
  null,
  'gender is constrained to male/female'
);

-- Owner-editable via the same RLS policy the rest of the table already has —
-- a smoke test, not a full re-exercise of profiles.test.sql's own RLS suite.
set local role authenticated;
set local request.jwt.claims = '{"sub": "77777777-7777-7777-7777-777777777777", "role": "authenticated"}';

select lives_ok(
  $$ update public.profiles set gender = 'male' where id = '77777777-7777-7777-7777-777777777777' $$,
  'the owner can set their own gender through the existing update policy'
);

reset role;

select * from finish();

rollback;

-- Proves the RLS test harness itself is trustworthy before any real policy
-- depends on it.
--
-- The classic way an RLS suite gives false passes is by running as a role that
-- bypasses RLS, so every "unauthorized read returned nothing" assertion passes
-- for the wrong reason. This test pins down that `set role anon` genuinely
-- loses access that the owner has.

begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

create table public.rls_harness_probe (id int primary key, secret text);
insert into public.rls_harness_probe (id, secret) values (1, 'visible to owner only');

alter table public.rls_harness_probe enable row level security;
-- Deliberately no policy: default-deny, the posture every Booking Buddy table
-- starts from per ADR 0003.

grant select on public.rls_harness_probe to anon;

select is(
  (select count(*)::int from public.rls_harness_probe),
  1,
  'the table owner sees the row'
);

set local role anon;

select is(
  (select count(*)::int from public.rls_harness_probe),
  0,
  'anon sees nothing through a default-deny policy, even with SELECT granted'
);

reset role;

select is(
  (select count(*)::int from public.rls_harness_probe),
  1,
  'resetting the role restores the owner view, so role switching is real'
);

select * from finish();

rollback;

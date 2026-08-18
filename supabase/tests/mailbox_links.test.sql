-- Mailbox Link (issue #62, CONTEXT.md) — one Gmail OAuth grant per User,
-- owner-only per ADR 0003's coarse-RLS pattern (see profiles.test.sql for
-- the pattern this mirrors: seed as the table owner, then re-check as
-- `authenticated` carrying each User's own JWT).

begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select has_table('public', 'mailbox_links', 'mailbox_links table exists');
select has_column('public', 'mailbox_links', 'owner_id', 'mailbox_links.owner_id exists');
select has_column('public', 'mailbox_links', 'google_account_email', 'mailbox_links.google_account_email exists');
select has_column('public', 'mailbox_links', 'encrypted_refresh_token', 'mailbox_links.encrypted_refresh_token exists');
select has_column('public', 'mailbox_links', 'status', 'mailbox_links.status exists');
select col_is_pk('public', 'mailbox_links', 'owner_id', 'owner_id is the primary key — one Mailbox Link per User');

insert into auth.users (id, instance_id, aud, role, email)
values (
  '33333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'mailboxlink-owner@example.com'
);

insert into auth.users (id, instance_id, aud, role, email)
values (
  '44444444-4444-4444-4444-444444444444',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'mailboxlink-stranger@example.com'
);

insert into public.mailbox_links (owner_id, google_account_email, encrypted_refresh_token)
values (
  '33333333-3333-3333-3333-333333333333',
  'owner@gmail.com',
  'fake.iv.ciphertext'
);

select is(
  (select status from public.mailbox_links where owner_id = '33333333-3333-3333-3333-333333333333'),
  'active',
  'status defaults to active on connect'
);

select throws_ok(
  $$ insert into public.mailbox_links (owner_id, google_account_email, encrypted_refresh_token, status)
     values ('33333333-3333-3333-3333-333333333333', 'second@gmail.com', 'fake.iv.ciphertext', 'not-a-real-status') $$,
  '23514',
  null,
  'status is constrained to active/expired'
);

select throws_ok(
  $$ insert into public.mailbox_links (owner_id, google_account_email, encrypted_refresh_token)
     values ('33333333-3333-3333-3333-333333333333', 'dup@gmail.com', 'fake.iv.ciphertext') $$,
  '23505',
  null,
  'a second Mailbox Link for the same owner is refused — one per User'
);

-- Row Level Security, exercised the way a real request arrives: as the
-- `authenticated` role carrying a JWT whose `sub` is the acting User.
set local role authenticated;
set local request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select is(
  (select count(*)::int from public.mailbox_links
   where owner_id in ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444')),
  1,
  'the owner sees their own Mailbox Link'
);

select is(
  (select google_account_email from public.mailbox_links),
  'owner@gmail.com',
  'and can read its own columns'
);

reset role;
set local request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from public.mailbox_links
   where owner_id = '33333333-3333-3333-3333-333333333333'),
  0,
  'a different signed-in User sees none of it'
);

select lives_ok(
  $$ delete from public.mailbox_links where owner_id = '33333333-3333-3333-3333-333333333333' $$,
  'the delete statement itself does not error'
);

reset role;

select is(
  (select count(*)::int from public.mailbox_links where owner_id = '33333333-3333-3333-3333-333333333333'),
  1,
  'but RLS silently matched zero rows, not actually deleting the other User''s Mailbox Link'
);

select * from finish();

rollback;

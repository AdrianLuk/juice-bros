-- Processed Gmail message (issue #64, CONTEXT.md's Import Candidate entry) —
-- owner-only per ADR 0003's coarse-RLS pattern, same shape mailbox_links.test.sql
-- already exercises: seed as the table owner, then re-check as `authenticated`
-- carrying each User's own JWT.

begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select has_table('public', 'processed_gmail_messages', 'processed_gmail_messages table exists');
select has_column('public', 'processed_gmail_messages', 'owner_id', 'processed_gmail_messages.owner_id exists');
select has_column('public', 'processed_gmail_messages', 'gmail_message_id', 'processed_gmail_messages.gmail_message_id exists');
select has_column('public', 'processed_gmail_messages', 'outcome', 'processed_gmail_messages.outcome exists');

insert into auth.users (id, instance_id, aud, role, email)
values (
  '55555555-5555-5555-5555-555555555555',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'gmailsync-owner@example.com'
);

insert into auth.users (id, instance_id, aud, role, email)
values (
  '66666666-6666-6666-6666-666666666666',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'gmailsync-stranger@example.com'
);

insert into public.processed_gmail_messages (owner_id, gmail_message_id, outcome)
values (
  '55555555-5555-5555-5555-555555555555',
  'msg-1',
  'dismissed'
);

select throws_ok(
  $$ insert into public.processed_gmail_messages (owner_id, gmail_message_id, outcome)
     values ('55555555-5555-5555-5555-555555555555', 'msg-2', 'not-a-real-outcome') $$,
  '23514',
  null,
  'outcome is constrained to confirmed/dismissed/cancelled'
);

select throws_ok(
  $$ insert into public.processed_gmail_messages (owner_id, gmail_message_id, outcome)
     values ('55555555-5555-5555-5555-555555555555', 'msg-1', 'confirmed') $$,
  '23505',
  null,
  'the same message for the same owner cannot be recorded twice'
);

-- A second owner recording the same Gmail message id is a different row
-- entirely — the unique constraint is scoped per owner, not global.
select lives_ok(
  $$ insert into public.processed_gmail_messages (owner_id, gmail_message_id, outcome)
     values ('66666666-6666-6666-6666-666666666666', 'msg-1', 'confirmed') $$,
  'the same Gmail message id for a different owner is a separate row'
);

-- Row Level Security, exercised the way a real request arrives: as the
-- `authenticated` role carrying a JWT whose `sub` is the acting User.
set local role authenticated;
set local request.jwt.claims = '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select is(
  (select count(*)::int from public.processed_gmail_messages
   where owner_id in ('55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666')),
  1,
  'the owner sees only their own processed message'
);

select is(
  (select outcome from public.processed_gmail_messages where gmail_message_id = 'msg-1'),
  'dismissed',
  'and can read its own columns'
);

select lives_ok(
  $$ insert into public.processed_gmail_messages (owner_id, gmail_message_id, outcome)
     values ('55555555-5555-5555-5555-555555555555', 'msg-3', 'confirmed') $$,
  'the owner can record a new outcome as themselves'
);

-- Issue #65: confirming a cancellation candidate removes a Booking rather
-- than creating one, so it gets its own outcome value distinct from 'confirmed'.
select lives_ok(
  $$ insert into public.processed_gmail_messages (owner_id, gmail_message_id, outcome)
     values ('55555555-5555-5555-5555-555555555555', 'msg-cancel-1', 'cancelled') $$,
  'cancelled is an accepted outcome'
);

-- Issue #91: applying a matched Reservation Update edits an existing
-- Booking in place rather than creating or removing one, so it gets its own
-- outcome value too, distinct from both 'confirmed' and 'cancelled'.
select lives_ok(
  $$ insert into public.processed_gmail_messages (owner_id, gmail_message_id, outcome)
     values ('55555555-5555-5555-5555-555555555555', 'msg-update-1', 'updated') $$,
  'updated is an accepted outcome'
);

select throws_ok(
  $$ insert into public.processed_gmail_messages (owner_id, gmail_message_id, outcome)
     values ('66666666-6666-6666-6666-666666666666', 'msg-4', 'confirmed') $$,
  '42501',
  null,
  'recording an outcome for someone else''s owner_id is refused, not silently misattributed'
);

reset role;
set local request.jwt.claims = '{"sub": "66666666-6666-6666-6666-666666666666", "role": "authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from public.processed_gmail_messages
   where owner_id = '55555555-5555-5555-5555-555555555555'),
  0,
  'a different signed-in User sees none of it'
);

select throws_ok(
  $$ update public.processed_gmail_messages set outcome = 'confirmed' where owner_id = '66666666-6666-6666-6666-666666666666' $$,
  '42501',
  null,
  'there is no update grant — an outcome, once recorded, is never revisited'
);

reset role;

select * from finish();

rollback;

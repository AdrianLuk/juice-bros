-- Processed message (issue #64 / #281, CONTEXT.md's Import Candidate entry) —
-- owner-only per ADR 0003's coarse-RLS pattern, same shape mailbox_links.test.sql
-- already exercises: seed as the table owner, then re-check as `authenticated`
-- carrying each User's own JWT. Renamed from processed_gmail_messages in #281 so
-- a second mail provider shares the table.

begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

select has_table('public', 'processed_messages', 'processed_messages table exists (renamed from processed_gmail_messages in #281)');
select hasnt_table('public', 'processed_gmail_messages', 'the Gmail-specific table name is gone');
select has_column('public', 'processed_messages', 'owner_id', 'processed_messages.owner_id exists');
select has_column('public', 'processed_messages', 'provider', 'processed_messages.provider exists (#281)');
select has_column('public', 'processed_messages', 'provider_message_id', 'processed_messages.provider_message_id exists (renamed from gmail_message_id)');
select hasnt_column('public', 'processed_messages', 'gmail_message_id', 'the Gmail-specific column name is gone');
select has_column('public', 'processed_messages', 'outcome', 'processed_messages.outcome exists');
select has_column('public', 'processed_messages', 'booking_id', 'processed_messages.booking_id exists (#286) — the Booking a confirmed/updated email settled to');
select col_hasnt_default('public', 'processed_messages', 'provider', 'the backfill default was dropped — every insert names the provider');
select col_is_unique(
  'public', 'processed_messages',
  ARRAY['owner_id', 'provider', 'provider_message_id'],
  'uniqueness is (owner, provider, message id) so opaque ids from different providers cannot collide'
);

insert into auth.users (id, instance_id, aud, role, email)
values (
  '55555555-5555-5555-5555-555555555555',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'mailsync-owner@example.com'
);

insert into auth.users (id, instance_id, aud, role, email)
values (
  '66666666-6666-6666-6666-666666666666',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'mailsync-stranger@example.com'
);

insert into public.processed_messages (owner_id, provider, provider_message_id, outcome)
values (
  '55555555-5555-5555-5555-555555555555',
  'google',
  'msg-1',
  'dismissed'
);

select throws_ok(
  $$ insert into public.processed_messages (owner_id, provider, provider_message_id, outcome)
     values ('55555555-5555-5555-5555-555555555555', 'google', 'msg-2', 'not-a-real-outcome') $$,
  '23514',
  null,
  'outcome is constrained to confirmed/dismissed/cancelled/updated'
);

select throws_ok(
  $$ insert into public.processed_messages (owner_id, provider, provider_message_id, outcome)
     values ('55555555-5555-5555-5555-555555555555', 'google', 'msg-1', 'confirmed') $$,
  '23505',
  null,
  'the same message for the same owner and provider cannot be recorded twice'
);

-- The same opaque id from a different provider is a different message entirely —
-- the unique constraint is scoped per (owner, provider), not per (owner, id).
select lives_ok(
  $$ insert into public.processed_messages (owner_id, provider, provider_message_id, outcome)
     values ('55555555-5555-5555-5555-555555555555', 'microsoft', 'msg-1', 'confirmed') $$,
  'the same opaque message id under a different provider is a separate row'
);

-- A second owner recording the same message id is a different row too.
select lives_ok(
  $$ insert into public.processed_messages (owner_id, provider, provider_message_id, outcome)
     values ('66666666-6666-6666-6666-666666666666', 'google', 'msg-1', 'confirmed') $$,
  'the same message id for a different owner is a separate row'
);

-- A confirmed/updated row points at the Booking it settled to, and the FK
-- cascades on delete (#286): deleting the Booking drops the ledger row, so a
-- later sync sees that CourtReserve email as fresh and can re-offer it. This is
-- the whole reconcile-on-delete mechanism — no app code runs in the delete
-- path.
insert into public.orgs (id, owner_id, name, time_zone)
values ('a0000000-0000-0000-0000-0000000000aa', '55555555-5555-5555-5555-555555555555', 'Mailsync gym', 'America/Toronto');

insert into public.bookings (id, org_id, owner_id, court_label, starts_at, ends_at)
values (
  'b0000000-0000-0000-0000-0000000000bb',
  'a0000000-0000-0000-0000-0000000000aa',
  '55555555-5555-5555-5555-555555555555',
  'Court 7',
  '2031-09-25 18:00:00 America/Toronto',
  '2031-09-25 19:00:00 America/Toronto'
);

insert into public.processed_messages (owner_id, provider, provider_message_id, outcome, booking_id)
values (
  '55555555-5555-5555-5555-555555555555',
  'google',
  'msg-confirmed-with-booking',
  'confirmed',
  'b0000000-0000-0000-0000-0000000000bb'
);

delete from public.bookings where id = 'b0000000-0000-0000-0000-0000000000bb';

select is(
  (select count(*)::int from public.processed_messages
   where provider_message_id = 'msg-confirmed-with-booking'),
  0,
  'deleting the Booking cascades away its confirmed ledger row, re-opening the email to a later sync'
);

-- Row Level Security, exercised the way a real request arrives: as the
-- `authenticated` role carrying a JWT whose `sub` is the acting User.
set local role authenticated;
set local request.jwt.claims = '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}';

select is(
  (select outcome from public.processed_messages
   where provider_message_id = 'msg-1' and provider = 'google'),
  'dismissed',
  'the owner can read its own row'
);

select lives_ok(
  $$ insert into public.processed_messages (owner_id, provider, provider_message_id, outcome)
     values ('55555555-5555-5555-5555-555555555555', 'google', 'msg-cancel-1', 'cancelled') $$,
  'cancelled is an accepted outcome'
);

select lives_ok(
  $$ insert into public.processed_messages (owner_id, provider, provider_message_id, outcome)
     values ('55555555-5555-5555-5555-555555555555', 'google', 'msg-update-1', 'updated') $$,
  'updated is an accepted outcome'
);

select throws_ok(
  $$ insert into public.processed_messages (owner_id, provider, provider_message_id, outcome)
     values ('66666666-6666-6666-6666-666666666666', 'google', 'msg-4', 'confirmed') $$,
  '42501',
  null,
  'recording an outcome for someone else''s owner_id is refused, not silently misattributed'
);

reset role;
set local request.jwt.claims = '{"sub": "66666666-6666-6666-6666-666666666666", "role": "authenticated"}';
set local role authenticated;

select is(
  (select count(*)::int from public.processed_messages
   where owner_id = '55555555-5555-5555-5555-555555555555'),
  0,
  'a different signed-in User sees none of it'
);

-- No update grant: an outcome is never edited in place. A confirmed/updated
-- row can still leave the table — but only by the FK cascade when its Booking
-- is deleted (#286), never by a rewrite from a signed-in User.
select throws_ok(
  $$ update public.processed_messages set outcome = 'confirmed' where owner_id = '66666666-6666-6666-6666-666666666666' $$,
  '42501',
  null,
  'there is no update grant — an outcome is never rewritten, only cleared by the delete cascade'
);

reset role;

select * from finish();

rollback;

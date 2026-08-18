-- Processed Gmail message (issue #64, ADR-0009) — records what a User has
-- already decided about one CourtReserve confirmation email, so a later
-- "Sync from Email" never shows it again. Only confirmations reach here:
-- cancellations are issue #65's job, and a `not_a_booking`/`unparseable`
-- message is never actionable, so neither is worth remembering.
--
-- Deliberately its own table rather than a column on `bookings`: a dismissed
-- candidate never becomes a Booking at all (CONTEXT.md's Import Candidate
-- entry — "discarding one has no effect on any Booking"), so there is no
-- Booking row to hang the outcome off for that case. `gmail_message_id` is
-- Gmail's own id for the message, opaque to this app.

create table public.processed_gmail_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  gmail_message_id text not null,
  outcome text not null check (outcome in ('confirmed', 'dismissed')),
  processed_at timestamptz not null default now(),

  -- The de-dup key a sync checks against before ever re-parsing a message:
  -- one outcome per (owner, message), recorded once and never revisited.
  constraint processed_gmail_messages_unique_message unique (owner_id, gmail_message_id)
);

comment on table public.processed_gmail_messages is
  'A confirmed or dismissed CourtReserve confirmation email (issue #64), so a later sync never re-shows it. Cancellations are issue #65''s.';

-- What a sync's own "which ids have I already seen" read filters on.
create index processed_gmail_messages_owner_id on public.processed_gmail_messages (owner_id);

alter table public.processed_gmail_messages enable row level security;

create policy "a User sees only their own processed Gmail messages"
  on public.processed_gmail_messages for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- No update, no delete: an outcome is recorded once and never revisited —
-- there is no "un-dismiss" or "un-confirm" through this table.
grant select, insert on public.processed_gmail_messages to authenticated;

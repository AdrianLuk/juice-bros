-- Cancellation sync (issue #65) records a third outcome — confirming a
-- cancellation candidate removes a Booking rather than creating one, so
-- 'confirmed' (which #64's own comment ties to a Booking being created)
-- would misdescribe what happened. Dismissing a cancellation candidate
-- (matched or the "no match found" notice) still uses the existing
-- 'dismissed' outcome — that path is identical either way.

alter table public.processed_gmail_messages
  drop constraint processed_gmail_messages_outcome_check,
  add constraint processed_gmail_messages_outcome_check
    check (outcome in ('confirmed', 'dismissed', 'cancelled'));

comment on table public.processed_gmail_messages is
  'A confirmed, cancelled, or dismissed CourtReserve email (issues #64/#65), so a later sync never re-shows it.';

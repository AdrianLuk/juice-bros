-- Reservation Update sync (issue #91) records a fourth outcome — applying a
-- matched update edits an existing Booking's format/court in place, rather
-- than creating one ('confirmed') or removing one ('cancelled'). Dismissing
-- an update candidate (matched or the "no matching booking found" notice)
-- still uses the existing 'dismissed' outcome, same as the other two
-- candidate kinds — that path is identical either way.

alter table public.processed_gmail_messages
  drop constraint processed_gmail_messages_outcome_check,
  add constraint processed_gmail_messages_outcome_check
    check (outcome in ('confirmed', 'dismissed', 'cancelled', 'updated'));

comment on table public.processed_gmail_messages is
  'A confirmed, cancelled, updated, or dismissed CourtReserve email (issues #64/#65/#91), so a later sync never re-shows it.';

-- Reconcile a processed CourtReserve email against its Booking (issue #286).
--
-- Before this, "Sync from Email" filtered out every id in `processed_messages`
-- regardless of outcome. A `confirmed`/`updated` row said "there is a Booking
-- for this email" — but deleting that Booking in the Booking Buddy UI left the
-- row behind, so the email stayed permanently suppressed with nothing to show
-- for it, re-importable only by hand-editing prod.
--
-- Fix: a nullable `booking_id` FK with `on delete cascade`. Confirming an
-- import or applying an update sets it; deleting the Booking then removes the
-- ledger row via the cascade — no app code in the delete path — and the next
-- sync sees that email as fresh again. `dismissed`/`cancelled` rows leave it
-- null and are unaffected: their whole point is that no Booking exists.
--
-- Forward-only. Pre-migration `confirmed`/`updated` rows keep a null
-- `booking_id` and behave exactly as before (permanently filtered) — no
-- backfill, since there is no reliable way to re-pair an old ledger row with
-- the Booking it once created.

alter table public.processed_messages
  add column booking_id uuid references public.bookings (id) on delete cascade;

comment on column public.processed_messages.booking_id is
  'The Booking a confirmed/updated email settled to (issue #286). Null for '
  'dismissed/cancelled rows and for pre-#286 rows. on delete cascade: removing '
  'the Booking drops this row so a later sync re-offers the email.';

-- The referencing side of an `on delete cascade`, which Postgres does not index
-- for you: without it, deleting one Booking scans the whole ledger.
create index processed_messages_booking_id on public.processed_messages (booking_id);

comment on table public.processed_messages is
  'A confirmed, dismissed, cancelled or updated CourtReserve email (issue #64 / '
  '#65 / #91), so a later sync never re-shows it. provider + provider_message_id '
  'together are the opaque id. A confirmed/updated row carries booking_id and is '
  'removed by cascade when that Booking is deleted (issue #286), which re-opens '
  'the email to a future sync; dismissed/cancelled rows stay for good.';

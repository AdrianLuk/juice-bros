-- A Booking's format decides its own share of Capacity (ADR 0008, revised):
-- doubles holds four, singles holds two. Per-Booking rather than a flat
-- constant, because the same physical court is used differently by different
-- games — it's the User logging the reservation who actually knows which one
-- they played, not something the app can infer.

create type public.booking_format as enum ('singles', 'doubles');

alter table public.bookings
  add column format public.booking_format not null default 'doubles';

comment on column public.bookings.format is
  'Singles (2 players) or doubles (4 players) — what this court''s own share of a Slot''s Capacity is derived from (ADR 0008). Defaults to doubles, the common recreational case.';

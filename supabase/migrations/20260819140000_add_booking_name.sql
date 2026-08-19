-- Booking name (issue #94): a free-text label the User can give a Booking,
-- rendered above the facility name wherever the owner's dashboard already
-- shows one. Optional and unrelated to court_label — a court label
-- identifies which physical court, a name is whatever the User wants to call
-- the session itself ("Tuesday night rally"). Mirrors court_label's own
-- not-blank/length constraint pair (booking_court_not_blank/
-- booking_court_length) rather than inventing a new shape for an optional
-- text field. Bookings logged before this column existed are not
-- backfilled — they simply read null until someone edits them.

alter table public.bookings
  add column name text;

alter table public.bookings
  add constraint booking_name_not_blank check (name is null or btrim(name) <> ''),
  add constraint booking_name_length check (name is null or char_length(name) <= 60);

comment on column public.bookings.name is
  'A free-text label the User gave this Booking. Optional — null until they add one; not backfilled for Bookings logged before this column existed.';

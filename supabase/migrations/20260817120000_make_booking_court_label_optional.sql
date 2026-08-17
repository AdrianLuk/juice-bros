-- Not every facility labels its courts, and not every User bothers to note
-- one down — the court is a convenience for telling multiple same-time
-- Bookings apart, not something the rest of the schema depends on. Making it
-- optional needs no new check: `booking_court_not_blank` and
-- `booking_court_length` both already pass a null (only an empty or
-- over-long string trips them), so a User can still not write '' or
-- forty-plus characters in, just no longer required to write anything.

alter table public.bookings
  alter column court_label drop not null;

comment on column public.bookings.court_label is
  'Whatever the facility''s own booking screen calls this court. Optional — left null when the User didn''t note one down.';

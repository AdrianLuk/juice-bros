-- Second half of issue #20. Every write path stopped sending
-- bookings.time_zone as of the previous migration's deploy; this drops the
-- now-unused column. Rendering reads the Booking's Org instead.
alter table public.bookings drop column time_zone;

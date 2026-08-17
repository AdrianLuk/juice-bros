-- Every time picker in the app (Bookings, Slots, Availability Windows, and
-- this Org's own Booking Window) moved from a half-hour grid to an
-- on-the-hour one — see `datetime.ts`'s `HOUR_TIMES`/`isHourTime`. This is
-- the one time value the database itself constrains (`orgs.booking_window_time`,
-- a plain `text` column, not an instant), so it needs its own migration
-- rather than just an app-layer change.
--
-- Any existing row still holding a half-past value is rounded down to the
-- hour before the tighter constraint goes on, or the `alter table` below
-- would fail against it.

update public.orgs
  set booking_window_time = left(booking_window_time, 2) || ':00'
  where booking_window_time is not null
    and booking_window_time not like '__:00';

alter table public.orgs
  drop constraint orgs_booking_window_time_half_hour,
  add constraint orgs_booking_window_time_on_the_hour
    check (booking_window_time is null or booking_window_time ~ '^([01][0-9]|2[0-3]):00$');

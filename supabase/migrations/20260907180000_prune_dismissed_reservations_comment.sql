-- Pruning a dismissed reservation (issue #447) — no schema change, only the
-- table's own description catching up with it.
--
-- #444 gave the table a delete grant so a User could take a dismissal back,
-- and the comment written then said rows leave by that or by cascade. Each
-- sync now also deletes rows for slots that have already been and gone: both
-- reviews drop a past-dated candidate before they ever reach the dismissal
-- check, so such a row suppresses nothing and is dead weight from the day
-- after the reservation.
--
-- The prune runs opportunistically inside a sync (`pruneExpiredDismissedReservations`,
-- `dismissed-reservations.ts`) rather than on a schedule: a sync is the only
-- thing that reads this table, so an unread row costs nothing until one runs,
-- and a cron route would mean a new schedule and a new auth surface for a
-- table that tidies itself perfectly well at the moment of use.
--
-- The cutoff sits a full calendar day behind UTC's date. `slot_date` is
-- wall-clock in the Org's own zone and the reviews' past check is
-- calendar-day-only, so a slot dated "today" in the last zone on Earth is
-- still live while UTC has rolled over; a day of slack clears every zone and
-- costs nothing, since these rows are deleted for being worthless rather than
-- for being urgent.

comment on table public.dismissed_reservations is
  'A reservation the User dismissed on the Sync bookings review screen (issue '
  '#437), recorded as its Org + wall-clock slot + court so the *other* import '
  'source honours the dismissal too. Rows are compared with isSameReservation '
  '(import-candidate-shaping.ts), which reads the court by number, so the two '
  'sources'' differing court text still agrees. Never updated. Deleted when '
  'the User takes the dismissal back from the review screen''s list of what a '
  'sync suppressed (issue #444), when a sync prunes it for naming a slot that '
  'has already passed (issue #447), or by cascade when the Org or the User goes.';

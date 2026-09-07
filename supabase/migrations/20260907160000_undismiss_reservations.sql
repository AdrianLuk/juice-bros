-- Un-dismissing a reservation (issue #444) — the delete grant that turns
-- `dismissed_reservations` from a write-once ledger into a list a User can
-- take something back off.
--
-- #437 created the table write-once on purpose, matching `processed_messages`:
-- a dismissal was a decision recorded and never revisited. That posture was
-- tolerable while a dismissal hid one message. It stopped being tolerable when
-- the same row started suppressing a *slot* from both import sources, because
-- a cancel-and-rebook of the same slot — same Org, day, start time and court —
-- is a genuinely new reservation that now matches a dismissal recorded against
-- the old one, and is dropped by both sources with no way back.
--
-- So: a delete grant, and nothing else. Still no update — a dismissal is never
-- rewritten in place, it is either standing or gone. RLS already restricts
-- every command to the caller's own rows ("for all"), so the grant needs no
-- new policy.
--
-- What deletes a row is `offerDismissedReservationAgain`
-- (`actions/dismissed-reservations.ts`), from the "Offer this again" control
-- on the review screen's list of what a sync suppressed. It deletes *every*
-- dismissal matching the slot rather than one row by id: when both sources are
-- configured, each dismissal wrote its own row with its own court text
-- ("#9 - Hard" against "#9"), and leaving one behind would leave the slot
-- suppressed with nothing on screen still offering to un-suppress it.
--
-- Deliberately not done here: expiring a dismissal whose date has passed.
-- Worth doing as housekeeping (`org_feed_events` already documents pruning as
-- events age past), but it isn't the fix — the rebook that matters is of a
-- still-future slot.

grant delete on public.dismissed_reservations to authenticated;

comment on table public.dismissed_reservations is
  'A reservation the User dismissed on the Sync bookings review screen (issue '
  '#437), recorded as its Org + wall-clock slot + court so the *other* import '
  'source honours the dismissal too. Rows are compared with isSameReservation '
  '(import-candidate-shaping.ts), which reads the court by number, so the two '
  'sources'' differing court text still agrees. Never updated; deleted when '
  'the User takes the dismissal back from the review screen''s list of what a '
  'sync suppressed (issue #444), or by cascade when the Org or the User goes.';

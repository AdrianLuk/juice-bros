-- Notes: an optional free-text field on both Bookings and Slots, for detail
-- that doesn't belong anywhere else — court instructions, gear reminders, who
-- might be late. Mirrors booking_name's own not-blank/length constraint pair
-- (booking_name_not_blank/booking_name_length) rather than inventing a new
-- shape for an optional text field, just capped higher than name's 60
-- characters since notes is meant to hold more than a short label. One
-- migration for both tables — this is one feature/decision, not two.
--
-- A Booking's notes are entered and edited the same way its name is (the Log/
-- Edit Booking form). A Slot has no general edit flow once posted (its core
-- proposal fields are immutable), so its notes are settable at posting time
-- and, afterward, only through their own dedicated update (setSlotNotes) —
-- the same narrow post-creation-edit shape rotation_buffer and
-- intended_org_id already use.

alter table public.bookings
  add column notes text;

alter table public.bookings
  add constraint booking_notes_not_blank check (notes is null or btrim(notes) <> ''),
  add constraint booking_notes_length check (notes is null or char_length(notes) <= 500);

comment on column public.bookings.notes is
  'Optional free-text detail the User added to this Booking. Null until they add one; not backfilled for Bookings logged before this column existed.';

alter table public.slots
  add column notes text;

alter table public.slots
  add constraint slot_notes_not_blank check (notes is null or btrim(notes) <> ''),
  add constraint slot_notes_length check (notes is null or char_length(notes) <= 500);

comment on column public.slots.notes is
  'Optional free-text detail the owner added to this Slot, at posting time or afterward via setSlotNotes. Null until set.';

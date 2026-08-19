alter table public.slots
  add column division text not null default 'open'
    check (division in ('open', 'mixed', 'mens', 'womens'));

comment on column public.slots.division is
  'Which gender composition this Slot''s Capacity signal is broken down by (issue #80). "open" (the default, and every existing Slot before this column) keeps today''s plain count; mixed/mens/womens split the "yes" count by each Responder''s own Gender instead. Not constrained against the Slot''s own Format at the database level: Format lives per-Booking (ADR 0008), not per-Slot, and a Slot can have several Bookings of different formats attached (a multi-court game) — "mixed only makes sense for doubles" is an application-level nuance, not a row-level fact this column alone can check.';

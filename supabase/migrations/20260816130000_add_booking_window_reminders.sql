-- Booking Window Reminder (issue #36). A second, distinct Reminder from
-- #11's: that one tells attendees a confirmed game is coming up. This one
-- tells the *organizer* of a still-bare-proposal Slot that it's time to go
-- reserve a court, because most facilities (CourtReserve and similar) only
-- open bookings a fixed number of days ahead and fill up fast.
--
-- Three pieces:
--   * `orgs.booking_window_days_before`/`booking_window_time` — a fact about
--     the *facility*, set once, reused for every Slot there. Nullable
--     together: a User may never set one, and that Org simply never
--     produces a Booking Reminder.
--   * `slots.intended_org_id` — a bare-proposal Slot has no Org yet (that
--     only ever arrives via a real Booking, issue #9), so the organizer
--     picks which facility they're planning to book at. This is a Slot-level
--     hint, not a reservation — it does not touch ADR 0002's "no intended
--     state" rule, which is specifically about Bookings.
--   * `slot_booking_windows` (a view) — computes the instant a Slot's window
--     opens, the same way every other wall-clock/DST conversion in this app
--     is done: in Postgres, not JS (see `createSlot`'s
--     `"${date} ${time}:00 ${timeZone}"` trick, `assert_booking_coherent`).
--   * `booking_window_reminder_sends` — idempotency log, one row per Slot
--     (one recipient, one channel, unlike the attendee Reminder's per-User
--     `reminder_sends`).

alter table public.orgs
  add column booking_window_days_before integer,
  add column booking_window_time text,
  add constraint orgs_booking_window_coherent
    check ((booking_window_days_before is null) = (booking_window_time is null)),
  add constraint orgs_booking_window_days_bounds
    check (booking_window_days_before is null or booking_window_days_before between 0 and 30),
  -- Same half-hour grid as every other time entry in this app
  -- (`datetime.ts`'s `HALF_HOUR_TIMES`/`isHalfHourTime`) — a facility
  -- doesn't open bookings at "6:03am" any more than a court is reserved
  -- then.
  add constraint orgs_booking_window_time_half_hour
    check (booking_window_time is null or booking_window_time ~ '^([01][0-9]|2[0-3]):(00|30)$');

comment on column public.orgs.booking_window_days_before is
  'How many days before play this facility opens court bookings (issue #36). Null means no Booking Reminder for this Org.';
comment on column public.orgs.booking_window_time is
  'Time of day (this Org''s own time_zone, "HH:MM") the booking window opens.';

alter table public.slots
  add column intended_org_id uuid references public.orgs (id) on delete set null;

comment on column public.slots.intended_org_id is
  'The organizer''s own hint at which facility they plan to book (issue #36) — not a reservation, and not touched by attaching a real Booking (slot_bookings).';

/**
 * A Slot's `intended_org_id`, if set, must belong to the same owner as the
 * Slot — the same ownership-coherence shape `assert_slot_booking_coherent`
 * already uses for real Bookings, since RLS alone can't see across both
 * tables at once (the insert/update is on `slots`, and its own policy only
 * ever checks `slots.owner_id`).
 */
create function public.assert_slot_intended_org_coherent()
returns trigger
language plpgsql
as $$
begin
  if new.intended_org_id is not null and not exists (
    select 1 from public.orgs o
    where o.id = new.intended_org_id and o.owner_id = new.owner_id
  ) then
    raise exception 'a slot''s intended org must belong to the same owner'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger slots_intended_org_coherent
  before insert or update on public.slots
  for each row execute function public.assert_slot_intended_org_coherent();

/**
 * The instant each Slot's Booking Window opens, for every Slot that has both
 * an intended Org and an Org with a configured window.
 *
 * Deliberately *not* `security_invoker` — this view runs as its owner (the
 * ordinary Postgres default), the same "security definer" posture every
 * cross-table helper function in this schema already uses
 * (`has_slot_visibility`, `can_access_slot`). `service_role` is granted
 * select on the view itself, below, but has no grant on `orgs` directly (it
 * doesn't need one anywhere else either) — a `security_invoker` view would
 * have required one just for this one read, table grants and RLS bypass
 * being the independent checks this app's own migrations already document
 * repeatedly. Safe because the view's own grant list — `service_role` only
 * — is the actual access control here, not the underlying tables' RLS.
 *
 * The date math mirrors `createSlot`'s own wall-clock-string trick: convert
 * the Slot's own start into its own local calendar date, subtract the lead
 * time, then combine with the Org's own opening time and time zone and let
 * Postgres do the DST-aware conversion back to an instant — the one
 * genuinely different clock in play (the facility's, which may not match
 * the Slot's own `time_zone`, though today in practice both are usually
 * America/Toronto).
 */
create view public.slot_booking_windows as
select
  s.id as slot_id,
  s.owner_id,
  s.proposed_start,
  s.proposed_end,
  s.time_zone,
  o.id as org_id,
  o.name as org_name,
  o.google_place_id as org_google_place_id,
  (
    (
      (
        (s.proposed_start at time zone s.time_zone)::date
        - (o.booking_window_days_before || ' days')::interval
      )::date::text
      || ' ' || o.booking_window_time || ' ' || o.time_zone
    )::timestamptz
  ) as window_opens_at
from public.slots s
join public.orgs o on o.id = s.intended_org_id
where o.booking_window_days_before is not null;

comment on view public.slot_booking_windows is
  'When each Slot''s intended Org''s Booking Window opens (issue #36). service_role-only.';

grant select on public.slot_booking_windows to service_role;

create table public.booking_window_reminder_sends (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null unique references public.slots (id) on delete cascade,
  sent_at timestamptz not null default now()
);

comment on table public.booking_window_reminder_sends is
  'Idempotency log for Booking Window Reminders (issue #36) — one row per Slot, since there is exactly one recipient (the owner) and one channel (email). service_role-only, same posture as reminder_sends/guest_rsvp_log.';

alter table public.booking_window_reminder_sends enable row level security;

-- No policies for `authenticated`/`anon` — default-deny, same posture as
-- `reminder_sends`/`guest_rsvp_log`. Only `service_role` can reach this.
grant select, insert on public.booking_window_reminder_sends to service_role;

-- A second, independent opt-in (per the ticket's own acceptance criteria):
-- someone may want to know a game is on without being nagged about booking
-- logistics, or the reverse. `email_enabled` (issue #11) stays scoped to the
-- attendee Reminder exactly as it already behaves.
alter table public.notification_preferences
  add column booking_window_email_enabled boolean not null default true;

comment on column public.notification_preferences.booking_window_email_enabled is
  'Opt-in for the Booking Window Reminder (issue #36) — independent of email_enabled, which governs the attendee Reminder from issue #11.';

-- Reminder (issue #11, Phase 8's email half — CONTEXT.md's Reminder entry).
-- Split by channel per PROGRESS.md: `notification_preferences` and
-- `reminder_sends` are shared by both channels and ship here; the push half
-- (`push_subscriptions`, actual delivery) is issue #12's.
--
-- Three pieces:
--   * `slots.reminder_offset_minutes` — "configurable per Slot" (the ticket's
--     first acceptance criterion) has to live on the Slot itself, not a
--     separate table, since there is exactly one timing per Slot.
--   * `notification_preferences` — per-User, owner-managed, mirroring the
--     shape `profiles` already uses. A missing row means "defaults" rather
--     than being backfilled by a signup trigger (`getNotificationPreferences`
--     resolves it) — one fewer thing to keep in sync with `handle_new_user`.
--   * `reminder_sends` — the idempotency log the ticket's last acceptance
--     criterion asks for: sending twice for the same Slot/User/channel must
--     not duplicate.
--
-- The send job itself runs entirely through `service_role`, the same posture
-- issue #10 established for the Guest RSVP path: nothing here is a User
-- acting through their own session, so there is no `auth.uid()` for RLS to
-- gate on, and it needs to read across every User's Slots and preferences at
-- once, which no single User's RLS grant would ever allow.

alter table public.slots
  add column reminder_offset_minutes integer not null default 60,
  add constraint slots_reminder_offset_bounds
    check (reminder_offset_minutes between 0 and 10080); -- 0 to 7 days

comment on column public.slots.reminder_offset_minutes is
  'Minutes before proposed_start that a Reminder goes out to "yes" Responders on a confirmed Slot (issue #11). Defaults to 60.';

create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email_enabled boolean not null default true,
  push_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.notification_preferences is
  'Per-User channel opt-in for Reminders. A missing row means the defaults above — see getNotificationPreferences, not a signup trigger.';

alter table public.notification_preferences enable row level security;

create policy "a User manages only their own notification preferences"
  on public.notification_preferences for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.notification_preferences to authenticated;

-- The send job (service_role) reads every User's preferences to decide
-- whether to send; it never writes here, that stays the User's own action.
grant select on public.notification_preferences to service_role;

create table public.reminder_sends (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.slots (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null check (channel in ('email', 'push')),
  sent_at timestamptz not null default now(),

  -- The idempotency guarantee itself (issue #11's last acceptance criterion):
  -- a second attempt at the same Slot/User/channel triggers, doesn't insert.
  constraint reminder_sends_unique_send unique (slot_id, user_id, channel)
);

comment on table public.reminder_sends is
  'Idempotency log for Reminder sends (issue #11). service_role-only — nothing here is read through the app today, same posture as guest_rsvp_log.';

-- What the send job's per-Slot query filters on: "has this User already been
-- sent this channel for this Slot".
create index reminder_sends_slot_user_channel
  on public.reminder_sends (slot_id, user_id, channel);

alter table public.reminder_sends enable row level security;

-- No policies for `authenticated`/`anon` — default-deny, same as
-- `guest_rsvp_log`. Only `service_role` can reach this table at all.
grant select, insert on public.reminder_sends to service_role;

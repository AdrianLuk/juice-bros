-- Web push (issue #12, Phase 8's push half — `notification_preferences.push_enabled`
-- and the `push` branch of `reminder_sends`/`shouldSendReminder` already
-- shipped in #11; this is the one piece #11 deliberately left for this
-- ticket: where a User's actual browser subscriptions live.
--
-- One row per subscribed device/browser, not one per User — a User can
-- install the PWA on a phone and a laptop and get a Reminder on both. Unlike
-- `notification_preferences` (one opinion per User), there is no single
-- owner-managed "the" subscription to upsert onto, so this is a plain table
-- keyed by its own id, not `user_id primary key`.
--
-- `endpoint` is globally unique by construction (issued by the browser's own
-- push service, one per registration) — the unique constraint is what makes
-- re-subscribing on the same device an upsert rather than a duplicate row.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),

  constraint push_subscriptions_unique_endpoint unique (endpoint)
);

comment on table public.push_subscriptions is
  'A User''s subscribed browser/device for web push (issue #12). Owner-managed like notification_preferences; service_role additionally prunes rows the push service reports as gone.';

-- What the send job filters on: "every subscription for these recipients".
create index push_subscriptions_user_id on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "a User manages only their own push subscriptions"
  on public.push_subscriptions for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, delete on public.push_subscriptions to authenticated;

-- The send job (service_role) reads every recipient's subscriptions to know
-- where to push, and deletes ones the push service reports as gone (a 404/410
-- response means the browser dropped the registration — the same signal every
-- web-push implementation prunes on). It never inserts; subscribing stays the
-- User's own action through their session.
grant select, delete on public.push_subscriptions to service_role;

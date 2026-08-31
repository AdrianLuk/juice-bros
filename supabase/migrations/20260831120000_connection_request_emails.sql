-- Connection Request Email (issue #228). When a pending Connection is created,
-- the addressee gets an email with one-click Accept / Decline links that work
-- without them being signed in — the request is otherwise silent, and a
-- Connection is the precondition for every social feature in the app.
--
-- Two pieces here:
--
--   * `connection_request_links` — the session-less capability token behind the
--     Accept / Decline links, exactly the posture `slot_links` established for
--     Guest RSVP: `service_role`-only, unguessable, single-use. The respond
--     route never talks to Postgres except through a Server Action that checks
--     the token itself first. One row per Connection, created by a trigger (not
--     app code) so every path that inserts a Connection — the Friends-page
--     request, the invite-link "connect" button, the invite-link signup — is
--     covered without each remembering to mint one, the same "database trigger,
--     not app bookkeeping" reasoning the default-facility mark uses.
--
--   * `notification_preferences.connection_request_email_enabled` — its own
--     opt-out, independent of `email_enabled` (attendee Reminder) and
--     `booking_window_email_enabled` (Booking Window Reminder), matching the
--     one-toggle-per-email-type shape the table already has.

create table public.connection_request_links (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  -- gen_random_uuid() is unguessable enough to be the only protection on the
  -- link, the same call `connections.id` and every other token in this schema
  -- leans on; there is no rate limit or CAPTCHA on the respond route in v1.
  token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Set the moment Accept or Decline is actioned. A non-null value, a consumed
  -- link, and a Connection that is no longer `pending` are three ways the
  -- respond page reaches the same "already handled" terminal state.
  consumed_at timestamptz,

  constraint connection_request_links_token_unique unique (token),
  constraint connection_request_links_one_per_connection unique (connection_id)
);

comment on table public.connection_request_links is
  'Session-less, single-use Accept/Decline token for a friend request email (issue #228). One per Connection, minted by a trigger. service_role-only, same posture as slot_links/guest_rsvp_log.';

alter table public.connection_request_links enable row level security;

-- No policies for `authenticated`/`anon` — default-deny, the same posture as
-- `reminder_sends`/`guest_rsvp_log`. The respond flow runs entirely through
-- `service_role` Server Actions, which bypass RLS; nothing else may read a
-- token, least of all the requester (who could otherwise accept on the
-- addressee's behalf and make "mutual accept" meaningless).
grant select, insert, update on public.connection_request_links to service_role;

-- The notifier and the respond action both reach across Users — the addressee's
-- email lives in `auth.users`, the requester's name in a `profiles` row RLS
-- would hide from a session-less caller — so they need `service_role`.
-- `profiles` and `notification_preferences` are already granted to it (the
-- Guest RSVP and reminders migrations); `connections` is not.
grant select, update, delete on public.connections to service_role;

/**
 * Mint the Accept/Decline token for every new pending Connection.
 *
 * A trigger, not application code: `connections` rows are inserted from three
 * places and a fourth is easy to add, and every one of them should send the
 * email. `security definer` because the inserting role (`authenticated`) has
 * no grant on `connection_request_links` at all — only `service_role` does.
 */
create function public.add_connection_request_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.connection_request_links (connection_id)
  values (new.id)
  on conflict (connection_id) do nothing;
  return new;
end;
$$;

create trigger connections_add_request_link
  after insert on public.connections
  for each row
  when (new.status = 'pending')
  execute function public.add_connection_request_link();

-- Its own opt-in, per the ticket's acceptance criteria: a User may want game
-- reminders without friend-request email, or the reverse. Defaults on, like
-- the other two.
alter table public.notification_preferences
  add column connection_request_email_enabled boolean not null default true;

comment on column public.notification_preferences.connection_request_email_enabled is
  'Opt-in for the friend-request email (issue #228) — independent of email_enabled and booking_window_email_enabled.';

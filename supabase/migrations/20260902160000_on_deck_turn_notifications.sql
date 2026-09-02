-- On Deck: the opt-in turn notification (issue #260, parent #238).
--
-- A Player may turn on a single push — "you're up, Court 5" — fired when their
-- Foursome enters On Deck or is assigned a Court. It exists because a
-- `self-serve` Session has no Volunteer calling names (ADR 0005), so a Player
-- would otherwise have to keep watching the Display.
--
-- Off by default, per-Player (never a broadcast), and at most one buzz per
-- step. Reuses Booking Buddy's `web-push` setup (issue #12); degrades silently
-- where the browser can't subscribe or the deploy has no VAPID keys.
--
-- Two tables:
--
--   * `on_deck_push_subscriptions` — one row per subscribed device, scoped to
--     one Session and keyed by the Player's device token (their whole identity,
--     ADR 0001). Not `auth.users` like Booking Buddy's `push_subscriptions` —
--     On Deck has no accounts. The `on delete cascade` on `session_id` clears
--     it if the Session row is ever deleted; note that close (issue #255)
--     currently only flips `status` and purges the *event* rows, so a closed
--     Session's subscription rows linger harmlessly (the dispatch bails on
--     `status <> 'open'`) until the Session row itself is removed.
--   * `on_deck_turn_notification_sends` — the idempotency log: one row per
--     (Session, Player, turn) actually pushed, so a re-fold or a replayed
--     event never buzzes a Player twice for the same turn. `service_role` only.
--
-- A Player writes a subscription through a SECURITY DEFINER RPC (the same
-- posture as `on_deck_join_session`): `anon`-callable, roster-gated,
-- open-Session-gated, idempotent on the endpoint. The events table's INSERT
-- grant stays off `anon`. The send job runs inline in the Server Action that
-- appends the triggering event (On Deck has no cron) and reads/writes these
-- tables as `service_role`.

-- ---------------------------------------------------------------------------
-- on_deck_push_subscriptions
-- ---------------------------------------------------------------------------

create table public.on_deck_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.on_deck_sessions (id) on delete cascade,
  -- The Player's device token — their id within this Session (ADR 0001). Not a
  -- foreign key: the roster lives in the event log, not a table.
  player_token text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),

  -- Globally unique by construction (issued by the browser's push service, one
  -- per registration) — re-subscribing on the same device is an upsert.
  constraint on_deck_push_subscriptions_unique_endpoint unique (endpoint),
  constraint on_deck_push_subscriptions_token_length
    check (char_length(player_token) between 8 and 100)
);

comment on table public.on_deck_push_subscriptions is
  'A Player''s subscribed device for the On Deck turn notification (issue #260). Scoped to one Session, keyed by the device token (ADR 0001). Written by anon through on_deck_subscribe_turn_notification; read/pruned by service_role.';

-- The send job filters "every subscription for this Session".
create index on_deck_push_subscriptions_session
  on public.on_deck_push_subscriptions (session_id);

alter table public.on_deck_push_subscriptions enable row level security;

-- No policy for anon/authenticated: a device token is a Player's whole
-- identity, and the open Session is world-readable, so exposing a table keyed
-- by token would let anyone enumerate or forge subscriptions. All access is
-- the SECURITY DEFINER RPCs below (writes) and service_role (the send job).
grant select, insert, delete on public.on_deck_push_subscriptions to service_role;

-- ---------------------------------------------------------------------------
-- on_deck_turn_notification_sends
-- ---------------------------------------------------------------------------

create table public.on_deck_turn_notification_sends (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.on_deck_sessions (id) on delete cascade,
  player_token text not null,
  -- The per-turn key from `TurnTransition.turnKey` — `court:<n>:<since>` or
  -- `on-deck:<committedAt>`. NOT just 'court' / 'on-deck': a Player rotates
  -- through many Games in a Session and each turn is its own buzz, so the key
  -- carries a per-turn discriminator. The app builds it; the check only pins
  -- the shape.
  transition text not null,
  sent_at timestamptz not null default now(),

  constraint on_deck_turn_notification_sends_transition
    check (transition ~ '^(on-deck|court):'),
  -- "One buzz, not a stream": each (Session, Player, turn) is pushed at most
  -- once, so a re-fold or a replayed event is a no-op.
  constraint on_deck_turn_notification_sends_unique
    unique (session_id, player_token, transition)
);

comment on table public.on_deck_turn_notification_sends is
  'Idempotency log for On Deck turn notifications (issue #260): one row per (Session, Player, turn) actually pushed. transition is the per-turn key. service_role only.';

alter table public.on_deck_turn_notification_sends enable row level security;
grant select, insert on public.on_deck_turn_notification_sends to service_role;

-- ---------------------------------------------------------------------------
-- Subscribe / unsubscribe — anon, roster-gated
-- ---------------------------------------------------------------------------

/**
 * A Player turns on the turn notification for this device. `anon`-callable —
 * no account (ADR 0001). Gated on: the Session is open, and the device token
 * is on the roster (has a PLAYER_JOINED event). Idempotent on the endpoint —
 * re-subscribing on the same browser replaces the row.
 *
 * Deliberately not gated on Floor Mode: the control is only offered client-side
 * under `self-serve` / `hybrid`, and a stray subscription on a `volunteer-run`
 * Session simply never has a send planned for it. Keeping the RPC permissive
 * avoids a second read of the Club row here.
 */
create function public.on_deck_subscribe_turn_notification(
  p_session_id uuid,
  p_token text,
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_is_open boolean;
begin
  if char_length(v_token) < 8 or char_length(v_token) > 100 then
    raise exception 'a device token is required' using errcode = '22023';
  end if;
  if coalesce(btrim(p_endpoint), '') = ''
     or coalesce(btrim(p_p256dh), '') = ''
     or coalesce(btrim(p_auth), '') = ''
  then
    raise exception 'a full push subscription is required' using errcode = '22023';
  end if;

  select (status = 'open') into v_is_open
  from public.on_deck_sessions
  where id = p_session_id;

  if v_is_open is null or not v_is_open then
    raise exception 'there is no open Session' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.on_deck_session_events
    where session_id = p_session_id
      and type = 'PLAYER_JOINED'
      and payload ->> 'token' = v_token
  ) then
    raise exception 'scan the club QR to get set up first' using errcode = '42501';
  end if;

  insert into public.on_deck_push_subscriptions
    (session_id, player_token, endpoint, p256dh, auth)
  values (p_session_id, v_token, btrim(p_endpoint), btrim(p_p256dh), btrim(p_auth))
  on conflict (endpoint) do update
    set session_id = excluded.session_id,
        player_token = excluded.player_token,
        p256dh = excluded.p256dh,
        auth = excluded.auth;
end;
$$;

comment on function public.on_deck_subscribe_turn_notification(uuid, text, text, text, text) is
  'A Player opts in to the On Deck turn notification for one device (issue #260). anon-callable, roster- and open-Session-gated, idempotent on the endpoint.';

revoke all on function public.on_deck_subscribe_turn_notification(uuid, text, text, text, text) from public;
grant execute on function public.on_deck_subscribe_turn_notification(uuid, text, text, text, text)
  to anon, authenticated;

/**
 * A Player turns the notification off for this device (after the browser's own
 * `PushSubscription.unsubscribe()`). Keyed by endpoint alone — the endpoint is
 * the browser's own secret, so holding it is authorization enough, and a
 * caller who no longer has the token (cleared storage) can still clean up.
 * A no-op for an unknown endpoint.
 */
create function public.on_deck_unsubscribe_turn_notification(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.on_deck_push_subscriptions
  where endpoint = btrim(coalesce(p_endpoint, ''));
end;
$$;

comment on function public.on_deck_unsubscribe_turn_notification(text) is
  'A Player opts out of the On Deck turn notification for one device (issue #260). anon-callable, keyed by the endpoint (the browser''s own secret).';

revoke all on function public.on_deck_unsubscribe_turn_notification(text) from public;
grant execute on function public.on_deck_unsubscribe_turn_notification(text)
  to anon, authenticated;

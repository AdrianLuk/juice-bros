-- On Deck: Paused — leave, no-show swap, set aside (issue #246, parent #238).
--
-- The single "not right now" state, reachable three ways, all folding
-- identically (accrued Wait Time held, the Player stops being called):
--
--   1. a Player removes themselves from the Queue      → PLAYER_PAUSED (left)
--   2. the Organizer swaps out a called no-show        → FOURSOME_MEMBER_SWAPPED
--   3. an Operator sets a Player aside                  → PLAYER_PAUSED (set-aside)
--
-- A paused Player re-enters with `PLAYER_REQUEUED` — by scanning the Club QR
-- again, or an Operator re-adding them.
--
-- `PLAYER_PAUSED` and `FOURSOME_MEMBER_SWAPPED` were already in the events
-- table's `type` check from the foundation migration; `PLAYER_REQUEUED` was
-- not, so this migration widens the constraint. Operator-sourced events
-- (set-aside, the swap, an Operator re-queue) go through the foundation's "an
-- Organizer appends events to their own open Session" policy — no new policy.
-- The two Player-sourced doors (remove yourself, rejoin via QR) get anon RPCs,
-- the same posture as `on_deck_join_session` / `on_deck_queue_player`.

-- ---------------------------------------------------------------------------
-- PLAYER_REQUEUED joins the event vocabulary
-- ---------------------------------------------------------------------------

alter table public.on_deck_session_events
  drop constraint on_deck_event_type;

alter table public.on_deck_session_events
  add constraint on_deck_event_type check (
    type in (
      'SESSION_STARTED',
      'PLAYER_JOINED',
      'PLAYER_SKILL_SET',
      'PLAYER_QUEUED',
      'PLAYER_PAUSED',
      'PLAYER_REQUEUED',
      'GROUP_FORMED',
      'GROUP_DISSOLVED',
      'GROUP_MEMBER_ADDED',
      'GROUP_MEMBER_REMOVED',
      'COURT_FINISHED',
      'FOURSOME_MEMBER_SWAPPED',
      'GROUP_CAP_CHANGED',
      'FLOOR_MODE_CHANGED',
      'LAST_CALL',
      'SESSION_CLOSED'
    )
  );

-- ---------------------------------------------------------------------------
-- Is this device token currently paused?
-- ---------------------------------------------------------------------------

/**
 * A token is paused when the most recent event that put it there — a
 * `PLAYER_PAUSED` for the token, or a `FOURSOME_MEMBER_SWAPPED` naming it as
 * `out` — is newer than the most recent `PLAYER_REQUEUED` for it. The fold in
 * `reduceSession` is the real source of truth; this is just the guard the RPCs
 * use to give a Player a clean "already out" / "not out" response.
 */
create function public.on_deck_is_paused(p_session_id uuid, p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    max(seq) filter (
      where (type = 'PLAYER_PAUSED' and payload ->> 'token' = p_token)
         or (type = 'FOURSOME_MEMBER_SWAPPED' and payload ->> 'out' = p_token)
    ) > coalesce(
      max(seq) filter (
        where type = 'PLAYER_REQUEUED' and payload ->> 'token' = p_token
      ),
      0
    ),
    false
  )
  from public.on_deck_session_events
  where session_id = p_session_id;
$$;

-- A harmless read — the open Session's whole event log is already anon-readable
-- (ADR 0006), and the answer is meaningless without a device token in hand. The
-- RPCs below call it internally; the grant also lets a caller check directly.
revoke all on function public.on_deck_is_paused(uuid, text) from public;
grant execute on function public.on_deck_is_paused(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- A Player removes themselves from the Queue
-- ---------------------------------------------------------------------------

/**
 * Door 1: a Player taps "leave the queue" on their own screen. No account —
 * callable by `anon`. Pins the event to `PLAYER_PAUSED` / `player` /
 * `left`, refuses a token that never joined, and is a no-op when the token is
 * already paused. A Player can pause and rejoin any number of times through
 * the night, so there is no uniqueness index — the fold no-ops a stray repeat.
 */
create function public.on_deck_pause_player(p_session_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_open boolean;
  v_token text := btrim(coalesce(p_token, ''));
begin
  if char_length(v_token) < 8 or char_length(v_token) > 100 then
    raise exception 'a device token is required' using errcode = '22023';
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
    raise exception 'join the Session first' using errcode = '42501';
  end if;

  -- Already stepped out — nothing to do.
  if public.on_deck_is_paused(p_session_id, v_token) then
    return;
  end if;

  insert into public.on_deck_session_events
    (session_id, type, operator_kind, operator_user_id, payload)
  values (
    p_session_id, 'PLAYER_PAUSED', 'player', null,
    jsonb_build_object('token', v_token, 'reason', 'left')
  );
end;
$$;

comment on function public.on_deck_pause_player(uuid, text) is
  'Appends a PLAYER_PAUSED (reason: left) for a Player removing themselves from the Queue. No account: callable by anon. No-op when already paused.';

revoke all on function public.on_deck_pause_player(uuid, text) from public;
grant execute on function public.on_deck_pause_player(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- A paused Player rejoins the Queue by scanning the Club QR again
-- ---------------------------------------------------------------------------

/**
 * A paused Player is back — they re-scanned the Club QR. No account — callable
 * by `anon`. Appends `PLAYER_REQUEUED` / `player`; the fold restores their
 * accrued Wait Time. A no-op when the token is not currently paused (a Player
 * who never left, or one an Operator already re-added).
 */
create function public.on_deck_requeue_player(p_session_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_open boolean;
  v_token text := btrim(coalesce(p_token, ''));
begin
  if char_length(v_token) < 8 or char_length(v_token) > 100 then
    raise exception 'a device token is required' using errcode = '22023';
  end if;

  select (status = 'open') into v_is_open
  from public.on_deck_sessions
  where id = p_session_id;

  if v_is_open is null or not v_is_open then
    raise exception 'there is no open Session' using errcode = '42501';
  end if;

  if not public.on_deck_is_paused(p_session_id, v_token) then
    return;
  end if;

  insert into public.on_deck_session_events
    (session_id, type, operator_kind, operator_user_id, payload)
  values (
    p_session_id, 'PLAYER_REQUEUED', 'player', null,
    jsonb_build_object('token', v_token)
  );
end;
$$;

comment on function public.on_deck_requeue_player(uuid, text) is
  'Appends a PLAYER_REQUEUED for a paused Player rejoining via the Club QR. No account: callable by anon. No-op when not currently paused.';

revoke all on function public.on_deck_requeue_player(uuid, text) from public;
grant execute on function public.on_deck_requeue_player(uuid, text) to anon, authenticated;

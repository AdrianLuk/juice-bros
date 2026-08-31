-- On Deck: the rotation loop — a Player joins the Queue, and the Organizer
-- taps a Court done (issue #243, parent #238).
--
-- Two new event types reach the log this ticket:
--
--   * `PLAYER_QUEUED` — a Player with no account taps to join the Queue.
--     Appended through a SECURITY DEFINER RPC, the same posture as
--     `on_deck_join_session` (#242): the events table carries no `anon` INSERT
--     grant, so the RPC is the only way a Player-sourced event lands. Fired
--     once per Player — coming off a Court re-queues them with no event (the
--     `reduceSession` fold does it on `COURT_FINISHED`).
--
--   * `COURT_FINISHED` — "Court N done". An Operator action; for now only the
--     Organizer fires it, through the existing "an Organizer appends events to
--     their own open Session" policy from the foundation migration. No new
--     policy, no RPC — a single INSERT carrying `{ "court": N }`.

-- One PLAYER_QUEUED per device token per Session — the guarantee behind "a
-- double-tap or a second tab does not add two Queue entries". The RPC catches
-- the `unique_violation` and treats it as the no-op it is.
create unique index on_deck_session_events_one_queue_per_token
  on public.on_deck_session_events (session_id, (payload ->> 'token'))
  where type = 'PLAYER_QUEUED';

/**
 * A Player taps "join the Queue". No account and no auth session — callable by
 * `anon`, like `on_deck_join_session`. Pins the event to `PLAYER_QUEUED` /
 * `player`, refuses a token that has not joined the Session, and is idempotent
 * on the device token: tapping again (or coming back to the page after being
 * seated) does not append a second event.
 */
create function public.on_deck_queue_player(
  p_session_id uuid,
  p_token text
)
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
    raise exception 'there is no open Session to queue for' using errcode = '42501';
  end if;

  -- Only a Player already on the roster can queue — no phantom Queue entries.
  if not exists (
    select 1 from public.on_deck_session_events
    where session_id = p_session_id
      and type = 'PLAYER_JOINED'
      and payload ->> 'token' = v_token
  ) then
    raise exception 'join the Session before queueing' using errcode = '42501';
  end if;

  -- Already queued once this Session: a no-op. The fold re-queues a Player
  -- coming off a Court without an event, so one PLAYER_QUEUED is all there is.
  if exists (
    select 1 from public.on_deck_session_events
    where session_id = p_session_id
      and type = 'PLAYER_QUEUED'
      and payload ->> 'token' = v_token
  ) then
    return;
  end if;

  begin
    insert into public.on_deck_session_events
      (session_id, type, operator_kind, operator_user_id, payload)
    values (
      p_session_id, 'PLAYER_QUEUED', 'player', null,
      jsonb_build_object('token', v_token)
    );
  exception when unique_violation then
    -- Another call for this same token won the race — still a no-op.
    return;
  end;
end;
$$;

comment on function public.on_deck_queue_player(uuid, text) is
  'Appends a PLAYER_QUEUED event for a Player joining the Queue. No account: callable by anon. Idempotent on the device token — coming off a Court re-queues without an event.';

revoke all on function public.on_deck_queue_player(uuid, text) from public;
grant execute on function public.on_deck_queue_player(uuid, text) to anon, authenticated;

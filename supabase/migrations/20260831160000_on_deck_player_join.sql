-- On Deck: a Player joins a running Session by scanning the Club QR
-- (issue #242, parent #238).
--
-- A Player has no account and no auth session (ADR 0001, ADR 0005): they read
-- the open Session as `anon` already, and this ticket lets them append one
-- event — `PLAYER_JOINED` — through a single SECURITY DEFINER RPC.
--
-- Why an RPC rather than an `anon` INSERT policy:
--
--   * the "reopening the QR is not a re-join" rule is a uniqueness check on
--     `payload->>'token'` within the Session, which a WITH CHECK predicate
--     cannot express;
--   * it keeps the events table's INSERT grant off `anon` entirely — the only
--     way a Player-sourced event lands is this function, which pins the type
--     to `PLAYER_JOINED`, the operator to `player`, and normalises the name;
--   * it mirrors `on_deck_start_session`, the path the Organizer's first event
--     already takes.
--
-- The foundation migration's pgTAP test asserted "a Player cannot append
-- events yet"; that file is updated alongside this migration to assert the
-- join RPC instead. Direct INSERT by `anon` stays refused (no policy, no grant).

-- One PLAYER_JOINED per device token per Session — the real guarantee behind
-- "reopening the QR is not a re-join", so a double-tap or a second open tab
-- racing the RPC's pre-check cannot land two rows. The RPC catches the
-- `unique_violation` and treats it as the no-op it is.
create unique index on_deck_session_events_one_join_per_token
  on public.on_deck_session_events (session_id, (payload ->> 'token'))
  where type = 'PLAYER_JOINED';

create function public.on_deck_join_session(
  p_session_id uuid,
  p_token text,
  p_first_name text,
  p_last_initial text,
  p_skill_level text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_open boolean;
  v_first_name text := btrim(coalesce(p_first_name, ''));
  v_last_initial text := upper(
    left(regexp_replace(btrim(coalesce(p_last_initial, '')), '[^a-zA-Z]', '', 'g'), 1)
  );
  v_token text := btrim(coalesce(p_token, ''));
  v_joined integer;
begin
  if char_length(v_token) < 8 or char_length(v_token) > 100 then
    raise exception 'a device token is required' using errcode = '22023';
  end if;
  if v_first_name = '' or v_last_initial = '' then
    raise exception 'a first name and last initial are required'
      using errcode = '22023';
  end if;
  if p_skill_level is null
     or p_skill_level not in ('newbie', 'beginner', 'intermediate', 'advanced')
  then
    raise exception 'unknown skill level' using errcode = '22023';
  end if;

  select (status = 'open') into v_is_open
  from public.on_deck_sessions
  where id = p_session_id;

  if v_is_open is null or not v_is_open then
    raise exception 'there is no open Session to join' using errcode = '42501';
  end if;

  -- A running social is ~60 players; this bounds a scripted flood of the
  -- append-only log against the `anon` grant. Well clear of any real roster.
  select count(*) into v_joined
  from public.on_deck_session_events
  where session_id = p_session_id and type = 'PLAYER_JOINED';

  if v_joined >= 500 then
    raise exception 'this Session is full' using errcode = '42501';
  end if;

  -- Reopening the Club QR on the same device replays the same token: a no-op,
  -- not a duplicate Player. The pre-check keeps the common case cheap; the
  -- partial unique index is the actual guarantee against a concurrent racer.
  if exists (
    select 1 from public.on_deck_session_events
    where session_id = p_session_id
      and type = 'PLAYER_JOINED'
      and payload ->> 'token' = v_token
  ) then
    return;
  end if;

  begin
    insert into public.on_deck_session_events
      (session_id, type, operator_kind, operator_user_id, payload)
    values (
      p_session_id, 'PLAYER_JOINED', 'player', null,
      jsonb_build_object(
        'token', v_token,
        'firstName', left(v_first_name, 40),
        'lastInitial', v_last_initial,
        'skillLevel', p_skill_level
      )
    );
  exception when unique_violation then
    -- Another call for this same token won the race — still a no-op.
    return;
  end;
end;
$$;

comment on function public.on_deck_join_session(uuid, text, text, text, text) is
  'Appends a PLAYER_JOINED event for a Player scanning the Club QR. No account: callable by anon. Idempotent on the device token — reopening the QR does not re-join.';

revoke all on function public.on_deck_join_session(uuid, text, text, text, text) from public;
grant execute on function public.on_deck_join_session(uuid, text, text, text, text)
  to anon, authenticated;

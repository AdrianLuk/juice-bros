-- On Deck: Queue Together, player-formed (issue #251, parent #238).
--
-- The second half of Queue Together. A Player forms a Group from their own
-- phone by picking other Players who have done setup this Session; the picked
-- members are added with no confirm-prompt (they're in their bags). Instead:
--
--   * any member can remove *themselves* from the Group from their own screen
--     — GROUP_MEMBER_REMOVED { groupId, token }; and
--   * a Volunteer (or the Organizer) can dissolve any waiting Group —
--     GROUP_DISSOLVED { groupId }.
--
-- All the Group *semantics* (median position, fill to four, Variety
-- suppression, dissolve on COURT_FINISHED, the cap) are already in the
-- `reduceSession` fold from #250 and read identically whoever fired the event
-- (ADR 0005). This migration only adds write paths:
--
--   1. `on_deck_form_group`      — anon RPC, pins GROUP_FORMED / player. The
--      acting device token must have joined the Session and must be one of the
--      members. The server mints the `group-<uuid>` id and resolves the picked
--      names to tokens (a token is a Player's whole identity, ADR 0001, so it
--      never leaves the server); this RPC re-checks the shape.
--   2. `on_deck_leave_group`     — anon RPC, pins GROUP_MEMBER_REMOVED / player.
--   3. `on_deck_volunteer_append` learns GROUP_DISSOLVED (a Volunteer breaking
--      up a Group). GROUP_MEMBER_REMOVED stays out of the volunteer set — it is
--      a Player-only door. The Organizer INSERTs GROUP_DISSOLVED directly under
--      the foundation's owner policy.
--   4. `on_deck_undo_last_event` learns GROUP_DISSOLVED (undo the break-up).
--
-- GROUP_MEMBER_REMOVED, GROUP_DISSOLVED and GROUP_MEMBER_ADDED are already in
-- the `on_deck_session_events.type` check (the #246 migration listed the whole
-- vocabulary), so there is no constraint change here.

-- ---------------------------------------------------------------------------
-- A Player forms a Group from their own phone
-- ---------------------------------------------------------------------------

/**
 * The acting Player picks the other members from the current-Session Player
 * list. No account — callable by `anon`. Pins the event to `GROUP_FORMED` /
 * `player`. The real "every member is waiting, in no other Group, within the
 * live cap" check is the `reduceSession` fold (shared with the Volunteer path);
 * this is shape validation plus the two Player-specific guards — the acting
 * token has joined, and it is one of the members.
 */
create function public.on_deck_form_group(
  p_session_id uuid,
  p_actor_token text,
  p_group_id text,
  p_member_tokens jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := btrim(coalesce(p_actor_token, ''));
  v_is_open boolean;
begin
  if char_length(v_actor) < 8 or char_length(v_actor) > 100 then
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
      and payload ->> 'token' = v_actor
  ) then
    raise exception 'join the Session first' using errcode = '42501';
  end if;

  -- The id is minted server-side as `group-<uuid>`; a Player cannot pass an
  -- arbitrary id.
  if coalesce(p_group_id, '') !~ '^group-[0-9a-f-]{36}$' then
    raise exception 'a group id must be server-minted' using errcode = '22023';
  end if;

  if jsonb_typeof(p_member_tokens) <> 'array'
     or jsonb_array_length(p_member_tokens) < 2
     or jsonb_array_length(p_member_tokens) > 8 then
    raise exception 'a group has 2 to 8 members' using errcode = '22023';
  end if;

  -- A Player can only form a Group they are in — they cannot arrange other
  -- people into a Group without being part of it. The ticket deliberately has
  -- no confirm-prompt on the picked members' phones (they're in their bags);
  -- the safeguard is that any member can remove *themselves* (on_deck_leave_group)
  -- and a Volunteer can dissolve the Group. The blast radius of a bad actor is
  -- bounded by the fold: every member must be currently waiting and in no other
  -- Group, so the worst case is a transient mis-group a tap undoes — the same
  -- device-token trust model as on_deck_queue_player (ADR 0001).
  if not (p_member_tokens ? v_actor) then
    raise exception 'you can only group yourself with others'
      using errcode = '42501';
  end if;

  insert into public.on_deck_session_events
    (session_id, type, operator_kind, operator_user_id, payload)
  values (
    p_session_id, 'GROUP_FORMED', 'player', null,
    jsonb_build_object('groupId', p_group_id, 'memberTokens', p_member_tokens)
  );
end;
$$;

comment on function public.on_deck_form_group(uuid, text, text, jsonb) is
  'Appends a GROUP_FORMED (operator_kind player) for a Player forming a Queue Together Group from their own phone (issue #251). No account: callable by anon. The acting token must have joined and must be one of the members; the fold enforces waiting / ungrouped / cap.';

revoke all on function public.on_deck_form_group(uuid, text, text, jsonb) from public;
grant execute on function public.on_deck_form_group(uuid, text, text, jsonb)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- A member removes themselves from a Group
-- ---------------------------------------------------------------------------

/**
 * A member taps "leave this group" on their own screen. No account — callable
 * by `anon`. Pins the event to `GROUP_MEMBER_REMOVED` / `player`. The caller
 * (the server action) has folded the Session and passes the `groupId` the
 * token is currently in; this RPC pins the operator and the type. A no-op the
 * fold absorbs if the token is not actually in that Group. The Player stays in
 * the Queue — this is not `PLAYER_PAUSED`.
 */
create function public.on_deck_leave_group(
  p_session_id uuid,
  p_token text,
  p_group_id text
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
  if coalesce(p_group_id, '') !~ '^group-[0-9a-f-]{36}$' then
    raise exception 'an unknown group' using errcode = '22023';
  end if;

  select (status = 'open') into v_is_open
  from public.on_deck_sessions
  where id = p_session_id;

  if v_is_open is null or not v_is_open then
    raise exception 'there is no open Session' using errcode = '42501';
  end if;

  insert into public.on_deck_session_events
    (session_id, type, operator_kind, operator_user_id, payload)
  values (
    p_session_id, 'GROUP_MEMBER_REMOVED', 'player', null,
    jsonb_build_object('groupId', p_group_id, 'token', v_token)
  );
end;
$$;

comment on function public.on_deck_leave_group(uuid, text, text) is
  'Appends a GROUP_MEMBER_REMOVED (operator_kind player) for a Player removing themselves from a Queue Together Group (issue #251). No account: callable by anon. The Player stays in the Queue; the fold no-ops a stray call.';

revoke all on function public.on_deck_leave_group(uuid, text, text) from public;
grant execute on function public.on_deck_leave_group(uuid, text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- on_deck_volunteer_append learns GROUP_DISSOLVED
-- ---------------------------------------------------------------------------

create or replace function public.on_deck_volunteer_append(
  p_session_id uuid,
  p_token text,
  p_type text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
begin
  if not exists (
    select 1
    from public.on_deck_sessions
    where id = p_session_id
      and status = 'open'
      and floor_mode in ('volunteer-run', 'hybrid')
      and char_length(v_token) >= 24
      and volunteer_token = v_token
  ) then
    raise exception 'this volunteer link is not valid for an open session'
      using errcode = '42501';
  end if;

  if p_type not in (
    'COURT_FINISHED',
    'PLAYER_PAUSED',
    'PLAYER_REQUEUED',
    'FOURSOME_MEMBER_SWAPPED',
    'PLAYER_JOINED',
    'PLAYER_SKILL_SET',
    'GROUP_FORMED',
    'GROUP_CAP_CHANGED',
    'GROUP_DISSOLVED'
  ) then
    raise exception 'a volunteer cannot fire a % event', p_type
      using errcode = '42501';
  end if;

  if p_type = 'PLAYER_PAUSED'
     and coalesce(p_payload ->> 'reason', '') <> 'set-aside' then
    raise exception 'a volunteer pause is always a set-aside'
      using errcode = '22023';
  end if;

  -- A volunteer-sourced PLAYER_JOINED is only ever a walk-up add: it must
  -- carry a synthetic id, a name (bounded, matching the self-registration
  -- path), a valid Skill Level, and `queueOnJoin` — the walk-up goes straight
  -- into the Queue (issue #249).
  if p_type = 'PLAYER_JOINED' then
    -- The id is minted server-side as `walkup-<uuid>` (there is no device); a
    -- volunteer cannot pass an arbitrary token to squat a real Player's join slot.
    if coalesce(p_payload ->> 'token', '') !~ '^walkup-[0-9a-f-]{36}$' then
      raise exception 'a walk-up id must be server-minted' using errcode = '22023';
    end if;
    if coalesce(btrim(p_payload ->> 'firstName'), '') = ''
       or coalesce(btrim(p_payload ->> 'lastInitial'), '') = ''
       or char_length(p_payload ->> 'firstName') > 60 then
      raise exception 'a walk-up needs a name and last initial'
        using errcode = '22023';
    end if;
    if coalesce(p_payload ->> 'skillLevel', '') not in
       ('newbie', 'beginner', 'intermediate', 'advanced') then
      raise exception 'unknown skill level' using errcode = '22023';
    end if;
    if coalesce(p_payload ->> 'queueOnJoin', '') <> 'true' then
      raise exception 'a volunteer only adds walk-ups, which always queue'
        using errcode = '22023';
    end if;
  end if;

  if p_type = 'PLAYER_SKILL_SET'
     and coalesce(p_payload ->> 'skillLevel', '') not in
       ('newbie', 'beginner', 'intermediate', 'advanced') then
    raise exception 'unknown skill level' using errcode = '22023';
  end if;

  -- A volunteer-sourced GROUP_FORMED: a server-minted `group-<uuid>` id and a
  -- member-token array of 2 to the Club's absolute maximum (8). The fold does
  -- the real check against the live cap and "every member is waiting"; this is
  -- shape validation so a malformed payload never reaches the log (issue #250).
  if p_type = 'GROUP_FORMED' then
    if coalesce(p_payload ->> 'groupId', '') !~ '^group-[0-9a-f-]{36}$' then
      raise exception 'a group id must be server-minted' using errcode = '22023';
    end if;
    if jsonb_typeof(p_payload -> 'memberTokens') <> 'array'
       or jsonb_array_length(p_payload -> 'memberTokens') < 2
       or jsonb_array_length(p_payload -> 'memberTokens') > 8 then
      raise exception 'a group has 2 to 8 members' using errcode = '22023';
    end if;
  end if;

  -- A volunteer-sourced GROUP_DISSOLVED (issue #251): just a server-minted id.
  -- The fold no-ops an unknown Group or one already on a Court.
  if p_type = 'GROUP_DISSOLVED'
     and coalesce(p_payload ->> 'groupId', '') !~ '^group-[0-9a-f-]{36}$' then
    raise exception 'a group id must be server-minted' using errcode = '22023';
  end if;

  if p_type = 'GROUP_CAP_CHANGED' then
    if jsonb_typeof(p_payload -> 'cap') <> 'number'
       or (p_payload ->> 'cap')::numeric < 2
       or (p_payload ->> 'cap')::numeric > 8
       or (p_payload ->> 'cap')::numeric <> floor((p_payload ->> 'cap')::numeric)
    then
      raise exception 'a group cap is an integer 2 to 8' using errcode = '22023';
    end if;
  end if;

  insert into public.on_deck_session_events
    (session_id, type, operator_kind, operator_user_id, payload)
  values (
    p_session_id, p_type, 'volunteer', null, coalesce(p_payload, '{}'::jsonb)
  );
end;
$$;

comment on function public.on_deck_volunteer_append(uuid, text, text, jsonb) is
  'Appends one operational event as operator_kind volunteer, for a link-authenticated Volunteer (issues #248, #249, #250, #251). No account: callable by anon. Rejects a stale/closed/self-serve link and any event type outside the turnover set plus the walk-up / skill-override pair and the Queue Together events (GROUP_FORMED, GROUP_CAP_CHANGED, GROUP_DISSOLVED).';

-- ---------------------------------------------------------------------------
-- Undo learns GROUP_DISSOLVED
-- ---------------------------------------------------------------------------

create or replace function public.on_deck_undo_last_event(
  p_session_id uuid,
  p_expected_seq bigint,
  p_volunteer_token text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_volunteer_token, ''));
  v_seq bigint;
  v_type text;
  v_at timestamptz;
begin
  if v_token = '' then
    if not exists (
      select 1
      from public.on_deck_sessions s
      join public.on_deck_clubs c on c.id = s.club_id
      where s.id = p_session_id
        and s.status = 'open'
        and c.owner_id = (select auth.uid())
    ) then
      raise exception 'this session is not yours to undo' using errcode = '42501';
    end if;
  elsif not public.on_deck_check_volunteer_token(p_session_id, v_token) then
    raise exception 'this volunteer link is not valid for an open session'
      using errcode = '42501';
  end if;

  select seq, type, at
    into v_seq, v_type, v_at
  from public.on_deck_session_events
  where session_id = p_session_id
  order by seq desc
  limit 1
  for update;

  if v_seq is null then
    raise exception 'there is nothing to undo' using errcode = '22023';
  end if;

  if v_seq <> p_expected_seq then
    raise exception 'someone else changed the board since you looked'
      using errcode = '40001';
  end if;

  if v_type not in (
    'COURT_FINISHED',
    'PLAYER_PAUSED',
    'PLAYER_REQUEUED',
    'FOURSOME_MEMBER_SWAPPED',
    'GROUP_FORMED',
    'GROUP_DISSOLVED'
  ) then
    raise exception 'that action cannot be undone here' using errcode = '22023';
  end if;

  if v_at < now() - public.on_deck_undo_window() then
    raise exception 'that action is too old to undo' using errcode = '22023';
  end if;

  delete from public.on_deck_session_events
  where session_id = p_session_id and seq = v_seq;

  if not found then
    raise exception 'someone else changed the board since you looked'
      using errcode = '40001';
  end if;

  return v_seq;
end;
$$;

comment on function public.on_deck_undo_last_event(uuid, bigint, text) is
  'Drops the most recent event from a Session''s log (issues #247, #250, #251). Only the single latest event, only an undoable turnover type (the four #247 events plus GROUP_FORMED and GROUP_DISSOLVED), only within on_deck_undo_window(), and only when expected_seq still matches (else 40001, a concurrent Operator). Organizer via account, Volunteer via link token.';

revoke all on function public.on_deck_undo_last_event(uuid, bigint, text) from public;
grant execute on function public.on_deck_undo_last_event(uuid, bigint, text)
  to anon, authenticated;

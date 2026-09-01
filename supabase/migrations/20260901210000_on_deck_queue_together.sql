-- On Deck: Queue Together, volunteer-formed (issue #250, parent #238).
--
-- A Volunteer (or the Organizer) forms a Group of 2 to the Club's group cap
-- from waiting Players who asked to play together. The Group queues as one unit
-- at its members' median Wait Time; a short Group is filled to four by Match Me;
-- it dissolves when its Game ends (the `reduceSession` fold derives that from
-- `COURT_FINISHED` — there is no `GROUP_DISSOLVED` event in this ticket). A
-- Volunteer may also lower the live group cap.
--
--   * `GROUP_FORMED`      { groupId, memberTokens[] }
--   * `GROUP_CAP_CHANGED` { cap }
--
-- Both types are already in the `on_deck_session_events.type` check (the
-- foundation migration listed the whole vocabulary) and `group_cap` already
-- exists on `on_deck_sessions`, so there is no table change here.
--
-- The Organizer INSERTs both directly under the foundation's "an Organizer
-- appends events to their own open Session" policy (it does not constrain the
-- type). Two functions have to learn the new vocabulary:
--
--   1. `on_deck_volunteer_append` — the one write path for a link-authenticated
--      Volunteer. It whitelists a closed set; add the two events with payload
--      guards (a server-minted groupId, a 2-8 member array, a 2-8 cap).
--   2. `on_deck_undo_last_event` — a mis-formed Group is fixed by Undo, not
--      played out, so `GROUP_FORMED` joins the undoable turnover set.
--      `GROUP_CAP_CHANGED` stays out: it is corrected forward by setting it
--      again.

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
    'GROUP_CAP_CHANGED'
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
  'Appends one operational event as operator_kind volunteer, for a link-authenticated Volunteer (issues #248, #249, #250). No account: callable by anon. Rejects a stale/closed/self-serve link and any event type outside the turnover set plus the walk-up / skill-override pair and the Queue Together events.';

-- ---------------------------------------------------------------------------
-- Undo learns GROUP_FORMED
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
    'GROUP_FORMED'
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
  'Drops the most recent event from a Session''s log (issues #247, #250). Only the single latest event, only an undoable turnover type (the four #247 events plus GROUP_FORMED), only within on_deck_undo_window(), and only when expected_seq still matches (else 40001, a concurrent Operator). Organizer via account, Volunteer via link token.';

revoke all on function public.on_deck_undo_last_event(uuid, bigint, text) from public;
grant execute on function public.on_deck_undo_last_event(uuid, bigint, text)
  to anon, authenticated;

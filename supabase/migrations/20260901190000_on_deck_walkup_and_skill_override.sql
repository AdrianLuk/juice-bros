-- On Deck: walk-up Players and Skill Level override (issue #249, parent #238).
--
-- Two operator abilities on top of the floor surface (Organizer or a
-- link-authenticated Volunteer):
--
--   1. Add a walk-up Player — someone with no phone. A synthetic id stands in
--      for the device token; a `PLAYER_JOINED` carrying `queueOnJoin: true`
--      puts them in the Session and the Queue exactly like a self-registered
--      Player, just with no device.
--   2. Skill Level override — `PLAYER_SKILL_SET` corrects an obviously wrong
--      self-rating. Match Me reads the corrected level on its next selection.
--
-- Both event types are already in the `on_deck_session_events.type` check (the
-- foundation migration listed the whole vocabulary), so no table change here.
--
-- The Organizer path INSERTs directly under the foundation's "an Organizer
-- appends events to their own open Session" policy — which does not constrain
-- the event type — so it needs nothing new. Only the Volunteer's one write
-- path, `on_deck_volunteer_append`, has to learn the two new events: it
-- whitelists a closed set, and #248 shipped it with the turnover events only.

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
    'PLAYER_SKILL_SET'
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

  insert into public.on_deck_session_events
    (session_id, type, operator_kind, operator_user_id, payload)
  values (
    p_session_id, p_type, 'volunteer', null, coalesce(p_payload, '{}'::jsonb)
  );
end;
$$;

comment on function public.on_deck_volunteer_append(uuid, text, text, jsonb) is
  'Appends one operational event as operator_kind volunteer, for a link-authenticated Volunteer (issues #248, #249). No account: callable by anon. Rejects a stale/closed/self-serve link and any event type outside the turnover set plus the walk-up / skill-override pair.';

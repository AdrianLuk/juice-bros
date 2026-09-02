-- On Deck: the courtside Kiosk (issue #259, parent #238).
--
-- The interactive counterpart to the read-only Display (#253): a tablet stood
-- by the courts that shows the same live board plus the buttons a Game turnover
-- needs, tappable by any Player standing there (ADR 0005 — the app never
-- requires a Volunteer). It is a URL with no token: the Session id is already
-- in the world-readable Display URL, and "at the Kiosk anyone can tap anything"
-- is an accepted, deliberate widening of the abuse surface — it is a friendly
-- social, Undo (#247) covers mistaps, and the Organizer keeps override.
--
-- Shape, mirroring `on_deck_volunteer_append` (#248):
--
--   * `on_deck_check_kiosk_access(session)` — a SECURITY DEFINER boolean the
--     Kiosk route calls before it renders. True only for an *open* Session
--     whose Floor Mode is `self-serve` or `hybrid`. Under `volunteer-run` the
--     Kiosk URL is inert.
--
--   * `on_deck_kiosk_append(session, type, payload)` — the single write path
--     for a Kiosk tap. The events table carries no `anon` INSERT grant, so this
--     is the only way a `kiosk`-sourced event lands. It re-checks Floor Mode,
--     pins `operator_kind = 'kiosk'` / no user id, and whitelists exactly the
--     turnover events a courtside tap can produce:
--       - COURT_FINISHED         — "Court N done"
--       - FOURSOME_MEMBER_SWAPPED — "a player short" (Match Me replacement, #246)
--       - PLAYER_JOINED           — "add me" (a walk-up with no phone, #249)
--       - COURT_CONFIRMED         — the idle-court nudge's "still going" tap
--     Never SESSION_*, FLOOR_MODE_CHANGED, LAST_CALL (a Kiosk button it is
--     deliberately not — ADR 0002), or the Group vocabulary.
--
--   * `COURT_CONFIRMED` is new to the event vocabulary — added to the
--     `on_deck_event_type` check here.
--
--   * `on_deck_undo_last_event` learns a third caller: a Kiosk, with neither an
--     account nor a link token, may undo the last turnover on a `self-serve` /
--     `hybrid` Session (same ADR 0005 posture as the append). It gains
--     `COURT_CONFIRMED`'s exclusion for free — that type is corrected forward
--     (tap again, or "Court N done"), never in the undoable set.

-- ---------------------------------------------------------------------------
-- COURT_CONFIRMED joins the event vocabulary
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
      'COURT_CONFIRMED',
      'FOURSOME_MEMBER_SWAPPED',
      'GROUP_CAP_CHANGED',
      'FLOOR_MODE_CHANGED',
      'LAST_CALL',
      'SESSION_CLOSED'
    )
  );

-- ---------------------------------------------------------------------------
-- on_deck_check_kiosk_access — authenticate the Kiosk URL before rendering
-- ---------------------------------------------------------------------------

/**
 * True when `p_session_id` is an *open* Session whose Floor Mode allows the
 * Kiosk (`self-serve` / `hybrid`). No token — the Kiosk URL carries only the
 * Session id, which is already world-readable. SECURITY DEFINER only for
 * consistency with the other check functions; it reads nothing `anon` couldn't.
 */
create function public.on_deck_check_kiosk_access(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.on_deck_sessions
    where id = p_session_id
      and status = 'open'
      and floor_mode in ('self-serve', 'hybrid')
  );
$$;

comment on function public.on_deck_check_kiosk_access(uuid) is
  'True when the Session is open and its Floor Mode allows the Kiosk (self-serve / hybrid). Callable by anon — the Kiosk route calls it to decide whether to render (issue #259).';

revoke all on function public.on_deck_check_kiosk_access(uuid) from public;
grant execute on function public.on_deck_check_kiosk_access(uuid)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- on_deck_kiosk_append — the Kiosk's one write path
-- ---------------------------------------------------------------------------

/**
 * Appends one turnover event as `operator_kind = 'kiosk'`. The only way a
 * kiosk-sourced event reaches the log. Enforces the Kiosk *scope* in the
 * database, not just the UI:
 *   * the Session must be open with a Floor Mode that allows the Kiosk (so a
 *     closed Session, or one flipped to `volunteer-run`, silently stops
 *     granting access);
 *   * only the four courtside turnover events are accepted;
 *   * a kiosk `PLAYER_JOINED` is only ever an "add me" walk-up — server-minted
 *     `walkup-<uuid>` id, a bounded name, a valid Skill Level, `queueOnJoin`
 *     (the same shape `on_deck_volunteer_append` requires, #249).
 *
 * Payload shape beyond that (Court in range, names resolvable, board not stale)
 * is validated in the Server Action; `reduceSession` also skips a malformed row.
 */
create function public.on_deck_kiosk_append(
  p_session_id uuid,
  p_type text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.on_deck_check_kiosk_access(p_session_id) then
    raise exception 'the kiosk is not available for this session'
      using errcode = '42501';
  end if;

  if p_type not in (
    'COURT_FINISHED',
    'FOURSOME_MEMBER_SWAPPED',
    'PLAYER_JOINED',
    'COURT_CONFIRMED'
  ) then
    raise exception 'the kiosk cannot fire a % event', p_type
      using errcode = '42501';
  end if;

  if p_type = 'PLAYER_JOINED' then
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
      raise exception 'a kiosk only adds walk-ups, which always queue'
        using errcode = '22023';
    end if;
  end if;

  insert into public.on_deck_session_events
    (session_id, type, operator_kind, operator_user_id, payload)
  values (
    p_session_id, p_type, 'kiosk', null, coalesce(p_payload, '{}'::jsonb)
  );
end;
$$;

comment on function public.on_deck_kiosk_append(uuid, text, jsonb) is
  'Appends one turnover event as operator_kind kiosk, for a courtside Kiosk tap (issue #259). No account and no token: callable by anon. Rejects a closed / volunteer-run Session and any event outside COURT_FINISHED / FOURSOME_MEMBER_SWAPPED / PLAYER_JOINED (walk-up) / COURT_CONFIRMED.';

revoke all on function public.on_deck_kiosk_append(uuid, text, jsonb) from public;
grant execute on function public.on_deck_kiosk_append(uuid, text, jsonb)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- on_deck_undo_last_event learns the Kiosk caller
-- ---------------------------------------------------------------------------

/**
 * Recreated to admit a third caller (issue #259): a Kiosk, with neither an
 * account (`auth.uid()` null) nor a link token, may undo the last turnover on a
 * `self-serve` / `hybrid` Session. `p_kiosk` is an explicit opt-in from the
 * Kiosk Server Action so a signed-out call from anywhere else still fails the
 * Organizer gate rather than silently falling through to a Kiosk grant.
 *
 * Everything else is unchanged from #251: single latest event, undoable type
 * (the four #247 events plus GROUP_FORMED / GROUP_DISSOLVED — COURT_CONFIRMED
 * is deliberately not here), within `on_deck_undo_window()`, `expected_seq`
 * still the tip (else `40001`).
 *
 * The prior 3-arg signature is dropped first — adding `p_kiosk` with a default
 * would otherwise leave two overloads and make `(uuid, bigint, text)` calls
 * ambiguous.
 */
drop function public.on_deck_undo_last_event(uuid, bigint, text);

create function public.on_deck_undo_last_event(
  p_session_id uuid,
  p_expected_seq bigint,
  p_volunteer_token text default null,
  p_kiosk boolean default false
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
  v_kind text;
begin
  if p_kiosk then
    if not public.on_deck_check_kiosk_access(p_session_id) then
      raise exception 'the kiosk is not available for this session'
        using errcode = '42501';
    end if;
  elsif v_token = '' then
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

  select seq, type, at, operator_kind
    into v_seq, v_type, v_at, v_kind
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

  -- A Kiosk has no credential — it may only take back a Kiosk tap. An
  -- Organizer's or Volunteer's action on a hybrid Session is theirs to undo
  -- from their own (account- or token-gated) surface, not anyone courtside's.
  if p_kiosk and v_kind <> 'kiosk' then
    raise exception 'the kiosk can only undo a kiosk action' using errcode = '42501';
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

comment on function public.on_deck_undo_last_event(uuid, bigint, text, boolean) is
  'Drops the most recent event from a Session''s log (issues #247, #250, #251, #259). Only the single latest event, only an undoable turnover type, only within on_deck_undo_window(), and only when expected_seq still matches (else 40001). Organizer via account, Volunteer via link token, Kiosk via p_kiosk on a self-serve / hybrid Session — and a Kiosk may only undo a kiosk-sourced event.';

revoke all on function public.on_deck_undo_last_event(uuid, bigint, text, boolean) from public;
grant execute on function public.on_deck_undo_last_event(uuid, bigint, text, boolean)
  to anon, authenticated;

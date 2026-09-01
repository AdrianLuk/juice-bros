-- On Deck: operator Undo (issue #247, parent #238).
--
-- One "Undo" on the floor screen drops the most recent event from the log and
-- every surface re-folds to the exact prior state — this is dropping the last
-- event, never a compensating action (#238 architecture; the fold's undo-parity
-- is already tested in `reduce.test.ts`).
--
-- `on_deck_undo_last_event(session, expected_seq [, volunteer_token])` — one
-- SECURITY DEFINER path for both Operators, the same posture as
-- `on_deck_volunteer_append`: the events table has no DELETE grant for `anon` or
-- `authenticated`, so this function is the only way a row leaves the log.
--
-- Guard rails (all three AC lines):
--   * bounded — only the single most recent event, and only if it is younger
--     than `on_deck_undo_window()` (15 min). Repeated undo walks back one at a
--     time, each step re-checked, so an Operator can fix a mistap from this game
--     or the last but cannot rewrite the night an hour deep.
--   * only undoable event types — the operational turnover events an Operator
--     fired (the same set `on_deck_volunteer_append` whitelists). Never
--     SESSION_STARTED / PLAYER_JOINED / PLAYER_QUEUED — structural or
--     Player-sourced rows are not an Operator's to drop.
--   * concurrent Operators — the caller passes the `seq` it last saw as the
--     latest; if another Operator has appended (or undone) since, `expected_seq`
--     no longer matches `max(seq)` and the undo is refused with `40001` so the
--     UI can say "someone else changed the board", never a silent wrong drop.

create function public.on_deck_undo_window()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '15 minutes' $$;

create function public.on_deck_undo_last_event(
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
  -- Authorize the caller against this Session, by the same rules that gate
  -- appends: the owning Organizer from their account, or a link-authenticated
  -- Volunteer while the Session is open and its Floor Mode admits volunteers.
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
  else
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
  end if;

  select seq, type, at
    into v_seq, v_type, v_at
  from public.on_deck_session_events
  where session_id = p_session_id
  order by seq desc
  limit 1;

  if v_seq is null then
    raise exception 'there is nothing to undo' using errcode = '22023';
  end if;

  -- Concurrent Operator: the log moved on since the caller looked.
  if v_seq <> p_expected_seq then
    raise exception 'someone else changed the board since you looked'
      using errcode = '40001';
  end if;

  if v_type not in (
    'COURT_FINISHED',
    'PLAYER_PAUSED',
    'PLAYER_REQUEUED',
    'FOURSOME_MEMBER_SWAPPED'
  ) then
    raise exception 'that action cannot be undone here' using errcode = '22023';
  end if;

  if v_at < now() - public.on_deck_undo_window() then
    raise exception 'that action is too old to undo' using errcode = '22023';
  end if;

  delete from public.on_deck_session_events
  where session_id = p_session_id and seq = v_seq;

  return v_seq;
end;
$$;

comment on function public.on_deck_undo_last_event(uuid, bigint, text) is
  'Drops the most recent event from a Session''s log (issue #247). Only the single latest event, only an undoable turnover type, only within on_deck_undo_window(), and only when expected_seq still matches (else 40001, a concurrent Operator). Organizer via account, Volunteer via link token.';

revoke all on function public.on_deck_undo_last_event(uuid, bigint, text) from public;
grant execute on function public.on_deck_undo_last_event(uuid, bigint, text)
  to anon, authenticated;

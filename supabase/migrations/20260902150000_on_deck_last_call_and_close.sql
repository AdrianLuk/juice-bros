-- On Deck: Last Call, Session close, and the Session Summary (issue #255, parent #238).
--
-- The end of the night, in two Operator taps:
--
--   * **Last Call** — the Organizer or a Volunteer (never a Kiosk: it is a
--     judgment about the night, not a Court turnover, ADR 0002) taps once. The
--     `LAST_CALL` event goes in the log; `reduceSession` then assigns no new
--     Foursomes and forms no new On Deck ones, while Games already on Courts
--     finish normally. `on_deck_last_call` is the write path — the same posture
--     as `on_deck_volunteer_append` (no anon INSERT grant on the events table).
--
--   * **Close** — the Organizer only. `on_deck_close_session` runs one
--     transaction: it stores the permanent, anonymous **Session Summary**
--     (computed in the Server Action from the same `reduceSession` fold and
--     passed in as JSONB — the wait-time distribution needs the fold, which is
--     not worth reimplementing in SQL), flips the Session to `closed`, and then
--     **purges the event log and the Player roster** (ADR 0001 — a closed
--     Session leaves numbers, not people). The roster lives only in the log, so
--     deleting `on_deck_session_events` for the Session purges both. The
--     `SESSION_CLOSED` of the event vocabulary is the `status = 'closed'` flag
--     itself — appending it as a row only to purge it in the same transaction
--     would be theatre.
--
-- Once closed: the partial unique index frees the Club to open a new Session,
-- and the Club QR resolver (`getOpenSessionForClub`, filtered to `status =
-- 'open'`) returns nothing → "nothing running right now".
--
-- `LAST_CALL` and `SESSION_CLOSED` are already in the foundation migration's
-- `on_deck_event_type` check — this migration adds rows and functions, not the
-- vocabulary.

-- ---------------------------------------------------------------------------
-- on_deck_session_summaries — the permanent anonymous record
-- ---------------------------------------------------------------------------

create table public.on_deck_session_summaries (
  -- One Summary per Session. The Session row itself is kept (it is already
  -- numbers, not people — venue, court count, timestamps); the Summary hangs
  -- off it.
  session_id uuid primary key
    references public.on_deck_sessions (id) on delete cascade,
  club_id uuid not null references public.on_deck_clubs (id) on delete cascade,
  -- The whole projected Summary — attendance, games played, court utilization,
  -- wait-time distribution, longest wait, skill mix. Shape is
  -- `SessionSummary` in `src/lib/on-deck/session/summary.ts`; kept as JSONB so
  -- the projection can evolve without a migration, the same way the event
  -- `payload` does.
  summary jsonb not null,
  -- Denormalised headline numbers, for a future "sessions over time" reader
  -- without unpacking every JSONB. Derived from `summary` at write time.
  attendance integer not null,
  games_played integer not null,
  session_started_at timestamptz not null,
  session_closed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint on_deck_summary_attendance_nonneg check (attendance >= 0),
  constraint on_deck_summary_games_nonneg check (games_played >= 0)
);

comment on table public.on_deck_session_summaries is
  'The permanent anonymous record kept once a Session closes (issue #255): attendance, games played, court utilization, wait-time distribution, longest wait, skill mix. The Player roster and event log are purged at the same moment (ADR 0001).';

create index on_deck_session_summaries_club_id
  on public.on_deck_session_summaries (club_id, session_closed_at desc);

alter table public.on_deck_session_summaries enable row level security;

-- A Summary is the owning Organizer's to read. It carries no personal data, but
-- it is still the Club's own operational history — not world-readable the way
-- an open Session is.
create policy "an Organizer reads their own Club's Session summaries"
  on public.on_deck_session_summaries for select
  to authenticated
  using (
    exists (
      select 1 from public.on_deck_clubs c
      where c.id = club_id and c.owner_id = (select auth.uid())
    )
  );

grant select on public.on_deck_session_summaries to authenticated;
grant select, insert, update, delete on public.on_deck_session_summaries to service_role;

-- ---------------------------------------------------------------------------
-- on_deck_last_call — the "end new play" tap, for either Operator
-- ---------------------------------------------------------------------------

/**
 * Appends one `LAST_CALL` event. The only way the event reaches the log — the
 * events table has no anon INSERT grant, and the Organizer's own owner policy
 * would also work but this keeps one path for both Operators (the same shape as
 * `on_deck_undo_last_event`).
 *
 * Authorized like an append: the owning Organizer from their account, or a
 * link-authenticated Volunteer while the Session is open and its Floor Mode
 * admits volunteers (reusing `on_deck_check_volunteer_token`, #248). Idempotent
 * — a second call once `LAST_CALL` is already in the log is a silent no-op, so a
 * double tap does not stack events (and `reduceSession` ignores a replayed one
 * regardless).
 */
create function public.on_deck_last_call(
  p_session_id uuid,
  p_volunteer_token text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := btrim(coalesce(p_volunteer_token, ''));
  v_kind text;
  v_uid uuid := (select auth.uid());
begin
  if v_token = '' then
    if not exists (
      select 1
      from public.on_deck_sessions s
      join public.on_deck_clubs c on c.id = s.club_id
      where s.id = p_session_id
        and s.status = 'open'
        and c.owner_id = v_uid
    ) then
      raise exception 'this session is not yours to call' using errcode = '42501';
    end if;
    v_kind := 'organizer';
  elsif not public.on_deck_check_volunteer_token(p_session_id, v_token) then
    raise exception 'this volunteer link is not valid for an open session'
      using errcode = '42501';
  else
    v_kind := 'volunteer';
  end if;

  -- Lock the Session so a Last Call and a Close cannot interleave.
  perform 1 from public.on_deck_sessions where id = p_session_id for update;

  -- Already called — nothing to append.
  if exists (
    select 1 from public.on_deck_session_events
    where session_id = p_session_id and type = 'LAST_CALL'
  ) then
    return;
  end if;

  insert into public.on_deck_session_events
    (session_id, type, operator_kind, operator_user_id, payload)
  values (
    p_session_id, 'LAST_CALL', v_kind,
    case when v_kind = 'organizer' then v_uid end,
    '{}'::jsonb
  );
end;
$$;

comment on function public.on_deck_last_call(uuid, text) is
  'Appends a LAST_CALL event for an open Session (issue #255). Organizer via account, Volunteer via link token. Idempotent — a second call is a no-op. After it, reduceSession assigns no new Foursomes; Games on Courts finish normally.';

revoke all on function public.on_deck_last_call(uuid, text) from public;
grant execute on function public.on_deck_last_call(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- on_deck_close_session — store the Summary, then purge
-- ---------------------------------------------------------------------------

/**
 * Closes a Session in one transaction (issue #255), the Organizer's alone:
 *
 *   1. store the projected `p_summary` as the permanent
 *      `on_deck_session_summaries` row (attendance / games_played pulled out
 *      into columns for a future reader);
 *   2. flip the Session to `closed` and stamp `closed_at`;
 *   3. delete every `on_deck_session_events` row for the Session — which is
 *      also the Player roster, since the roster lives only in the log (ADR
 *      0001).
 *
 * `p_summary` is computed by the Server Action from `projectSummary` (the same
 * `reduceSession` fold), not here: the wait-time distribution is a fold
 * artefact and reimplementing the fold in PL/pgSQL to avoid passing ~1 KB of
 * JSON back would be a poor trade. The Session row is locked for the duration
 * so a late event or a concurrent Last Call cannot slip in mid-close; anything
 * that lands a microsecond before the lock is simply included or not in that
 * final read — the Summary is "as of close", which is all the AC asks.
 *
 * Idempotent: a second close of an already-closed Session is a no-op (the
 * status guard), so a double tap or a retry after a dropped response is safe.
 */
create function public.on_deck_close_session(
  p_session_id uuid,
  p_summary jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.on_deck_sessions%rowtype;
begin
  select * into v_session
  from public.on_deck_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'no such session' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.on_deck_clubs c
    where c.id = v_session.club_id and c.owner_id = (select auth.uid())
  ) then
    raise exception 'this session is not yours to close' using errcode = '42501';
  end if;

  -- Already closed — a retry or a double tap. Nothing to do.
  if v_session.status = 'closed' then
    return;
  end if;

  if p_summary is null or jsonb_typeof(p_summary) <> 'object' then
    raise exception 'a session summary is required to close' using errcode = '22023';
  end if;

  insert into public.on_deck_session_summaries
    (session_id, club_id, summary, attendance, games_played, session_started_at)
  values (
    p_session_id,
    v_session.club_id,
    p_summary,
    coalesce((p_summary ->> 'attendance')::integer, 0),
    coalesce((p_summary ->> 'gamesPlayed')::integer, 0),
    v_session.started_at
  );

  update public.on_deck_sessions
  set status = 'closed', closed_at = now()
  where id = p_session_id;

  -- The purge (ADR 0001): the event log — and with it the whole Player roster,
  -- which is only ever a projection of PLAYER_JOINED rows — is deleted. The
  -- `status = 'closed'` flag on the Session row and the Summary are the only
  -- lasting record; the "SESSION_CLOSED" of the log's vocabulary is that flag,
  -- not a row that would be purged in the same breath.
  delete from public.on_deck_session_events where session_id = p_session_id;
end;
$$;

comment on function public.on_deck_close_session(uuid, jsonb) is
  'Closes a Session (issue #255, Organizer only): stores the anonymous Session Summary, flips status to closed (the vocabulary''s SESSION_CLOSED), then purges the event log and Player roster (ADR 0001). Idempotent on an already-closed Session.';

revoke all on function public.on_deck_close_session(uuid, jsonb) from public;
grant execute on function public.on_deck_close_session(uuid, jsonb) to authenticated;

-- `on_deck_last_call` is the dedicated write path for both Operators, so the
-- generic `on_deck_volunteer_append` whitelist and `on_deck_undo_last_event`
-- are deliberately left untouched by this migration. Last Call does not ride
-- the generic append path, and it is not undoable: close is final (the log is
-- purged), and a mistapped "call it" before close is guarded by a confirm on
-- the floor screen rather than a rollback.

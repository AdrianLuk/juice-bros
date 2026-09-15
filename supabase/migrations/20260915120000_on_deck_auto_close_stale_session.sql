-- On Deck: a forgotten Session closes itself (issue #516, parent #512).
--
-- One open Session per Club is enforced (the foundation migration's partial
-- unique index), so an Organizer who never taps Close silently blocks their
-- own next night. At a Club we don't run, there is nobody else to notice — no
-- co-owner (deferred, #512's OD-6), no volunteer who can start a Session.
--
-- There is no scheduler in this project (no pg_cron, no edge function on a
-- timer — see `supabase/config.toml`), so the close cannot fire on its own
-- clock. Instead it is checked lazily, the same way an idle-Court nudge is
-- computed at render rather than on a timer: the Organizer's own next touch —
-- loading their home screen, or tapping Start — asks "has this Session's log
-- gone quiet for `on_deck_stale_after()`?", and if so closes it right there,
-- before the stale board can be shown as tonight's.
--
-- `on_deck_close_session` (#255) and the new `on_deck_auto_close_stale_session`
-- authorize on different things — ownership alone for a deliberate close (an
-- Organizer may close their own live Session at any moment, mid-night) versus
-- ownership *and* staleness for the self-close (refusing, 55000
-- object_not_in_prerequisite_state, a Session with an event inside
-- `on_deck_stale_after()`, so a legitimately long night is never closed out
-- from under it) — but once authorized, both do the exact same thing: store
-- the Summary, flip to closed, purge the log (ADR 0001). That shared tail is
-- factored into `on_deck_finalize_session_close`, an unexported helper with no
-- grant of its own — reachable only from inside another `security definer`
-- function that has already locked the row and satisfied its own gate, never
-- callable directly. `on_deck_close_session` is `create or replace`'d here to
-- call it, rather than left duplicated: this schema *does* reuse a shared
-- predicate where one already exists (`on_deck_undo_last_event` calls
-- `on_deck_check_volunteer_token` rather than re-inline it), and the "store,
-- flip, purge" tail is exactly that kind of predicate, not a one-off.
--
-- The one difference in what gets stored: the Summary row gains `auto_closed`,
-- so the Organizer's own reader can tell a night that closed itself from one
-- they closed — "closed for you", not "closed by you".
--
-- Staleness is measured from the log's own last event, never from
-- `started_at` — a Session open ten hours with a `COURT_FINISHED` five minutes
-- ago is exactly as live as one two minutes old. `p_summary` is still supplied
-- by the caller (JSONB, computed by the same `projectSummary` fold #255's
-- close uses) rather than recomputed in SQL, for the same reason #255 gives:
-- the wait-time distribution is a fold artefact, not worth reimplementing in
-- PL/pgSQL. Trusting a caller-supplied summary is safe here specifically
-- because the function stays `authenticated`-only and re-checks ownership
-- itself — an Organizer who fed their own auto-close a wrong summary could
-- only ever be lying to themselves, the same trust boundary #255 already
-- accepts for a deliberate close.

-- ---------------------------------------------------------------------------
-- on_deck_stale_after — the staleness threshold, named like on_deck_undo_window
-- ---------------------------------------------------------------------------

/**
 * How long a Session's event log may sit quiet before it is eligible to close
 * itself (issue #516). Six hours is comfortably past any real club night —
 * TO Pickleball Club's own runs two — while being nowhere near "left open
 * since last week", which is the actual failure this exists to catch.
 */
create function public.on_deck_stale_after()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '6 hours' $$;

comment on function public.on_deck_stale_after() is
  'How long a Session''s event log may go quiet before on_deck_auto_close_stale_session may close it (issue #516). Six hours: well past a real night, nowhere near "forgotten since last week".';

revoke all on function public.on_deck_stale_after() from public;
grant execute on function public.on_deck_stale_after() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- on_deck_session_summaries.auto_closed — closed for you, or by you
-- ---------------------------------------------------------------------------

alter table public.on_deck_session_summaries
  add column auto_closed boolean not null default false;

comment on column public.on_deck_session_summaries.auto_closed is
  'True when this Session closed itself after on_deck_stale_after() of no events (issue #516), rather than the Organizer tapping Close. The Summary reader surfaces this so a forgotten night reads as "closed for you", not "closed by you".';

-- ---------------------------------------------------------------------------
-- on_deck_finalize_session_close — the shared "store, flip, purge" tail
-- ---------------------------------------------------------------------------

/**
 * Stores the Summary, flips the Session to closed, and purges its event log
 * (and with it the Player roster, ADR 0001) — the tail every close does once
 * it's authorized, shared by `on_deck_close_session` (#255) and
 * `on_deck_auto_close_stale_session` (#516).
 *
 * Takes the already-locked `on_deck_sessions` row rather than an id: the
 * caller has already run `select ... for update` to make its own ownership
 * (and, for auto-close, staleness) check against a stable row, and re-fetching
 * here would both waste the lock and let the two checks race against
 * different reads of the row. `p_session.status = 'closed'` is *not*
 * re-checked here — the caller already did, in the same critical section
 * this row lock protects, and does its own idempotent-no-op return before
 * ever calling this.
 *
 * No grant to `anon` or `authenticated`, and none needed: called only from
 * within another `security definer` function, which runs as this function's
 * owner and so always retains its own implicit execute privilege. Not a
 * safe entry point on its own — it has no authorization or staleness check of
 * its own, and blindly trusts `p_summary`.
 */
create function public.on_deck_finalize_session_close(
  p_session public.on_deck_sessions,
  p_summary jsonb,
  p_auto boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_summary is null or jsonb_typeof(p_summary) <> 'object' then
    raise exception 'a session summary is required to close' using errcode = '22023';
  end if;

  insert into public.on_deck_session_summaries
    (session_id, club_id, summary, attendance, games_played, session_started_at, auto_closed)
  values (
    p_session.id,
    p_session.club_id,
    p_summary,
    coalesce((p_summary ->> 'attendance')::integer, 0),
    coalesce((p_summary ->> 'gamesPlayed')::integer, 0),
    p_session.started_at,
    p_auto
  );

  update public.on_deck_sessions
  set status = 'closed', closed_at = now()
  where id = p_session.id;

  delete from public.on_deck_session_events where session_id = p_session.id;
end;
$$;

comment on function public.on_deck_finalize_session_close(public.on_deck_sessions, jsonb, boolean) is
  'The shared "store the Summary, flip to closed, purge the log" tail behind both on_deck_close_session and on_deck_auto_close_stale_session (issue #516). Not itself an authorization boundary — no grant, callable only from within another security definer function that has already locked the row and satisfied its own gate.';

-- Postgres grants EXECUTE on a new function to PUBLIC by default — revoked
-- here with nothing re-granted, since this helper skips both authorization
-- and staleness checks and must never be reachable directly.
revoke all on function public.on_deck_finalize_session_close(public.on_deck_sessions, jsonb, boolean) from public;

-- ---------------------------------------------------------------------------
-- on_deck_close_session — re-pointed at the shared tail, behaviour unchanged
-- ---------------------------------------------------------------------------

/**
 * Closes a Session (issue #255), the Organizer's alone: identical
 * authorization and control flow to the original — lock the row, "no such
 * session" (P0002) if it doesn't exist, "not yours" (42501) if the caller
 * doesn't own the Club, a silent no-op on an already-closed Session — with
 * the storage/flip/purge tail now shared via `on_deck_finalize_session_close`
 * (issue #516) instead of inlined. `auto_closed` is always `false` here.
 */
create or replace function public.on_deck_close_session(
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

  perform public.on_deck_finalize_session_close(v_session, p_summary, false);
end;
$$;

comment on function public.on_deck_close_session(uuid, jsonb) is
  'Closes a Session (issue #255, Organizer only): stores the anonymous Session Summary, flips status to closed (the vocabulary''s SESSION_CLOSED), then purges the event log and Player roster (ADR 0001) via the shared on_deck_finalize_session_close (issue #516). Idempotent on an already-closed Session. auto_closed is always false through this path.';

-- ---------------------------------------------------------------------------
-- on_deck_auto_close_stale_session — the self-close, staleness-authorized
-- ---------------------------------------------------------------------------

/**
 * Closes a Session whose event log has gone quiet for `on_deck_stale_after()`
 * (issue #516), via the same `on_deck_finalize_session_close` tail
 * `on_deck_close_session` (#255) uses — but authorized on staleness rather
 * than an Organizer's deliberate tap.
 *
 * Ownership is still required: the caller must own the Session's Club, same
 * as `on_deck_close_session`. This is what keeps a caller-supplied
 * `p_summary` safe to trust without recomputing it in SQL — only the
 * Organizer whose own record it becomes can reach this path, so a wrong
 * summary can only ever be a Club lying to itself.
 *
 * Refuses (55000, object_not_in_prerequisite_state) a Session with an event
 * inside the staleness window — a live Session, however long it has been
 * open, is never closed here. This check runs entirely in SQL against the
 * full `on_deck_session_events` table, not through a client read subject to
 * PostgREST's `max_rows` — so even if a caller's own idea of "the last event"
 * were built from a capped read, this is the one check that can't be fooled
 * by it into closing something still live.
 *
 * Idempotent: an already-closed Session is a silent no-op, returning `false`
 * rather than erroring, so a race with a deliberate close or a second lazy
 * check never raises. Returns `true` only when this call is the one that
 * actually closed it.
 */
create function public.on_deck_auto_close_stale_session(
  p_session_id uuid,
  p_summary jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.on_deck_sessions%rowtype;
  v_last_at timestamptz;
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

  -- Already closed — a race with a deliberate Close, another lazy check, or a
  -- retry after a dropped response. Nothing to do.
  if v_session.status = 'closed' then
    return false;
  end if;

  select max(at) into v_last_at
  from public.on_deck_session_events
  where session_id = p_session_id;

  -- No event at all is not a real state (SESSION_STARTED always appends one),
  -- but treat it as "too recent to tell" rather than as license to close.
  if v_last_at is null or now() - v_last_at <= public.on_deck_stale_after() then
    raise exception 'this session had an event too recently to auto-close'
      using errcode = '55000';
  end if;

  perform public.on_deck_finalize_session_close(v_session, p_summary, true);

  return true;
end;
$$;

comment on function public.on_deck_auto_close_stale_session(uuid, jsonb) is
  'Closes a Session whose log has gone quiet for on_deck_stale_after() (issue #516) via the shared on_deck_finalize_session_close, authorized on staleness rather than a deliberate Organizer tap; marks the Summary auto_closed. Refuses (55000) a Session with a recent event, however long it has been open. Idempotent (returns false) on an already-closed Session. Organizer-owned only, like on_deck_close_session.';

revoke all on function public.on_deck_auto_close_stale_session(uuid, jsonb) from public;
grant execute on function public.on_deck_auto_close_stale_session(uuid, jsonb) to authenticated;

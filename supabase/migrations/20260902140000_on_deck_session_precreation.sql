-- On Deck: Session pre-creation and Club defaults management (issue #254, parent #238).
--
-- Two Organizer abilities on top of the one-tap Start:
--
--   1. **Edit the Club's saved defaults** — venue name, court count, group cap.
--      The foundation migration made `on_deck_clubs` read-only even to the
--      owner (Clubs are seeded by hand); this ticket adds one narrow write
--      path, `on_deck_update_club_defaults`, which touches only those three
--      columns and never `owner_id` / `name`.
--
--   2. **Create or edit a Session ahead of time** — a Session sitting in a new
--      `scheduled` state with its own date, venue, and court count. When the
--      Organizer taps Start on (or after) that date, the scheduled Session
--      *becomes* the open one carrying its own values, instead of a fresh one
--      built from the Club defaults. `on_deck_start_session` is rewritten to
--      look for a due scheduled Session first.
--
-- A scheduled Session has no `SESSION_STARTED` event yet — the fold reads it as
-- `pending` — so `started_at` is null until Start promotes it. Group cap and
-- Floor Mode are always taken from the Club (they are not per-night knobs);
-- only the date, venue, and court count are set per scheduled Session.

-- ---------------------------------------------------------------------------
-- on_deck_sessions: the `scheduled` state
-- ---------------------------------------------------------------------------

-- A scheduled Session has not started, so it has no start time. Open and closed
-- Sessions keep theirs (the default fills it on a one-tap Start).
alter table public.on_deck_sessions
  alter column started_at drop not null;

-- The real-world date the scheduled Session is for. Null once it is open or
-- closed — at that point `started_at` carries the timing.
alter table public.on_deck_sessions
  add column scheduled_for date;

comment on column public.on_deck_sessions.scheduled_for is
  'The date a `scheduled` Session is planned for (issue #254). Start opens the due one; null once the Session is open or closed.';

alter table public.on_deck_sessions
  drop constraint on_deck_session_status;
alter table public.on_deck_sessions
  add constraint on_deck_session_status
    check (status in ('open', 'closed', 'scheduled'));

-- A `scheduled` Session is pre-start: no `started_at`, but a planned date. An
-- `open` / `closed` Session is the mirror image — it has a start time and no
-- pending date.
alter table public.on_deck_sessions
  add constraint on_deck_session_scheduled_shape check (
    case status
      when 'scheduled' then started_at is null and scheduled_for is not null
      else started_at is not null and scheduled_for is null
    end
  );

-- At most one scheduled Session per Club per date — editing the one for a date
-- is the path, not stacking several. (The one-open-per-Club index already
-- covers `open`.)
create unique index on_deck_sessions_one_scheduled_per_day
  on public.on_deck_sessions (club_id, scheduled_for)
  where status = 'scheduled';

-- ---------------------------------------------------------------------------
-- on_deck_update_club_defaults — the one write path onto a Club
-- ---------------------------------------------------------------------------

/**
 * Updates a Club's saved Session defaults — venue name, court count, group cap.
 * SECURITY DEFINER because `on_deck_clubs` carries no UPDATE grant for anyone
 * but `service_role` (the foundation's "seeded by hand, read-only" posture);
 * the ownership check is therefore explicit here. Only the three default
 * columns move — `owner_id`, `name`, and `created_at` are untouchable through
 * this path. The table's own CHECK constraints (court count 1..40, group cap
 * 2..8, venue non-blank and <= 120 chars) backstop the values.
 */
create function public.on_deck_update_club_defaults(
  p_venue_name text,
  p_court_count integer,
  p_group_cap integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  update public.on_deck_clubs
    set venue_name = btrim(p_venue_name),
        court_count = p_court_count,
        group_cap = p_group_cap
    where owner_id = v_uid;

  if not found then
    raise exception 'no Club to update for this account' using errcode = '42501';
  end if;
end;
$$;

comment on function public.on_deck_update_club_defaults(text, integer, integer) is
  'Updates the caller''s own Club''s saved defaults (venue, court count, group cap). Only those three columns; owner and name are untouchable through this path.';

revoke all on function public.on_deck_update_club_defaults(text, integer, integer) from public;
grant execute on function public.on_deck_update_club_defaults(text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- on_deck_create_scheduled_session — a Session set up ahead of time
-- ---------------------------------------------------------------------------

/**
 * Creates a `scheduled` Session for the caller's own Club, carrying its own
 * date, venue, and court count. Group cap and Floor Mode come straight off the
 * Club — they are Club settings, not per-night knobs. No `SESSION_STARTED`
 * event is written: the Session is pre-start, and the fold reads it as
 * `pending` until Start promotes it.
 *
 * SECURITY DEFINER for the same reason as `on_deck_start_session` — the
 * ownership check is explicit, and the Club-derived columns are read straight
 * off the row so a stale value cannot be passed in. The one-scheduled-per-day
 * partial unique index turns a duplicate date into a `unique_violation` the
 * app surfaces as "you already have a session for that date".
 */
create function public.on_deck_create_scheduled_session(
  p_club_id uuid,
  p_scheduled_for date,
  p_venue_name text,
  p_court_count integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_club public.on_deck_clubs%rowtype;
  v_session_id uuid;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select * into v_club from public.on_deck_clubs where id = p_club_id;
  if not found or v_club.owner_id <> v_uid then
    raise exception 'you can only schedule a Session for your own Club'
      using errcode = '42501';
  end if;

  if p_scheduled_for is null then
    raise exception 'a scheduled Session needs a date' using errcode = '22023';
  end if;

  insert into public.on_deck_sessions
    (club_id, venue_name, court_count, group_cap, floor_mode,
     status, started_at, scheduled_for)
  values
    (v_club.id, btrim(p_venue_name), p_court_count, v_club.group_cap,
     v_club.floor_mode, 'scheduled', null, p_scheduled_for)
  returning id into v_session_id;

  return v_session_id;
end;
$$;

comment on function public.on_deck_create_scheduled_session(uuid, date, text, integer) is
  'Creates a `scheduled` Session for the caller''s own Club with its own date, venue, and court count (issue #254). Group cap and Floor Mode come from the Club.';

revoke all on function public.on_deck_create_scheduled_session(uuid, date, text, integer) from public;
grant execute on function public.on_deck_create_scheduled_session(uuid, date, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- on_deck_update_scheduled_session — edit a not-yet-open Session
-- ---------------------------------------------------------------------------

/**
 * Edits a `scheduled` Session's date, venue, and court count. Refuses anything
 * that is not both the caller's own Club's and still `scheduled` — once a
 * Session is open it is edited on the floor, not here.
 */
create function public.on_deck_update_scheduled_session(
  p_session_id uuid,
  p_scheduled_for date,
  p_venue_name text,
  p_court_count integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  if p_scheduled_for is null then
    raise exception 'a scheduled Session needs a date' using errcode = '22023';
  end if;

  update public.on_deck_sessions s
    set scheduled_for = p_scheduled_for,
        venue_name = btrim(p_venue_name),
        court_count = p_court_count
    where s.id = p_session_id
      and s.status = 'scheduled'
      and exists (
        select 1 from public.on_deck_clubs c
        where c.id = s.club_id and c.owner_id = v_uid
      );

  if not found then
    raise exception 'no scheduled Session of yours with that id'
      using errcode = '42501';
  end if;
end;
$$;

comment on function public.on_deck_update_scheduled_session(uuid, date, text, integer) is
  'Edits a not-yet-open Session''s date, venue, and court count (issue #254). Caller must own the Club and the Session must still be `scheduled`.';

revoke all on function public.on_deck_update_scheduled_session(uuid, date, text, integer) from public;
grant execute on function public.on_deck_update_scheduled_session(uuid, date, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- on_deck_delete_scheduled_session — drop a planned Session
-- ---------------------------------------------------------------------------

create function public.on_deck_delete_scheduled_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  delete from public.on_deck_sessions s
    where s.id = p_session_id
      and s.status = 'scheduled'
      and exists (
        select 1 from public.on_deck_clubs c
        where c.id = s.club_id and c.owner_id = v_uid
      );

  if not found then
    raise exception 'no scheduled Session of yours with that id'
      using errcode = '42501';
  end if;
end;
$$;

comment on function public.on_deck_delete_scheduled_session(uuid) is
  'Deletes a `scheduled` Session (issue #254). Caller must own the Club; an open or closed Session is never removed here.';

revoke all on function public.on_deck_delete_scheduled_session(uuid) from public;
grant execute on function public.on_deck_delete_scheduled_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- on_deck_start_session — promote a due scheduled Session, else build fresh
-- ---------------------------------------------------------------------------

/**
 * One tap opens tonight's Session and appends its first event — one function,
 * one transaction (an eventless open Session folds as `pending` forever and
 * the one-open-per-Club index then blocks the retry).
 *
 * Now with pre-creation (issue #254): if the Club has a `scheduled` Session
 * dated *today* it is promoted to `open` carrying *its own* venue / court
 * count; group cap and Floor Mode still come from the Club (not per-night
 * knobs), refreshed onto the row at promote time so an edit to the defaults
 * between scheduling and Start is honoured. Otherwise the Session is built
 * from the Club's saved defaults exactly as before.
 *
 * "Today" is `p_today` — the Organizer's own local calendar date, passed from
 * the browser — falling back to the server's `current_date` (UTC) when absent.
 * The match is an exact `scheduled_for = <today>`: a stale plan the Organizer
 * never started does not silently hijack a later unrelated night (it stays in
 * the list to edit or delete), and the one-scheduled-per-day index means there
 * is at most one candidate.
 *
 * The partial unique index on `(club_id) where status = 'open'` still enforces
 * one open Session per Club — a concurrent caller (or a promote racing a fresh
 * Start) gets a `unique_violation` the app turns into landing on the winner.
 */
drop function if exists public.on_deck_start_session(uuid);

create function public.on_deck_start_session(
  p_club_id uuid,
  p_today date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_club public.on_deck_clubs%rowtype;
  v_scheduled public.on_deck_sessions%rowtype;
  v_today date := coalesce(p_today, current_date);
  v_session_id uuid;
  v_venue text;
  v_court_count integer;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select * into v_club from public.on_deck_clubs where id = p_club_id;

  if not found or v_club.owner_id <> v_uid then
    raise exception 'you can only start a Session for your own Club'
      using errcode = '42501';
  end if;

  -- A scheduled Session dated today opens instead of a fresh one.
  select * into v_scheduled
  from public.on_deck_sessions
  where club_id = v_club.id
    and status = 'scheduled'
    and scheduled_for = v_today
  limit 1
  for update;

  if found then
    v_venue := v_scheduled.venue_name;
    v_court_count := v_scheduled.court_count;

    -- Its own venue / court count; group cap + Floor Mode are refreshed from
    -- the Club so a defaults edit since scheduling wins.
    update public.on_deck_sessions
      set status = 'open',
          started_at = now(),
          scheduled_for = null,
          group_cap = v_club.group_cap,
          floor_mode = v_club.floor_mode
      where id = v_scheduled.id;

    v_session_id := v_scheduled.id;
  else
    v_venue := v_club.venue_name;
    v_court_count := v_club.court_count;

    insert into public.on_deck_sessions
      (club_id, venue_name, court_count, group_cap, floor_mode)
    values
      (v_club.id, v_venue, v_court_count, v_club.group_cap, v_club.floor_mode)
    returning id into v_session_id;
  end if;

  insert into public.on_deck_session_events
    (session_id, type, operator_kind, operator_user_id, payload)
  values (
    v_session_id, 'SESSION_STARTED', 'organizer', v_uid,
    jsonb_build_object(
      'venueName', v_venue,
      'courtCount', v_court_count,
      'groupCap', v_club.group_cap,
      'floorMode', v_club.floor_mode
    )
  );

  return v_session_id;
end;
$$;

comment on function public.on_deck_start_session(uuid, date) is
  'Opens a Session and appends its SESSION_STARTED event in one transaction. Promotes a `scheduled` Session dated p_today (the caller''s local date, else server current_date) carrying its own venue / court count; group cap and Floor Mode always come from the Club. Otherwise builds entirely from the Club defaults. Caller must own the Club.';

revoke all on function public.on_deck_start_session(uuid, date) from public;
grant execute on function public.on_deck_start_session(uuid, date) to authenticated;

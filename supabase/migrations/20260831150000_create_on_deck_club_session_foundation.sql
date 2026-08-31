-- On Deck's tenant backbone (issue #241, parent #238).
--
-- On Deck runs the two hours *during* one club pickleball social. It shares
-- nothing with Booking Buddy but this Supabase project and the Next.js app
-- shell (see on-deck/CONTEXT.md), so every table here is prefixed `on_deck_`
-- to keep the two namespaces apart.
--
-- Three tables, in dependency order:
--
--   * `on_deck_clubs` — the tenant. Seeded by hand (self-serve club creation
--     is out of scope, #238). Carries the owner and the saved Session
--     defaults, Floor Mode among them (ADR 0005).
--   * `on_deck_sessions` — one event night, opened with one tap from the
--     Club's defaults. At most one open at a time, per Club (enforced here,
--     not just in the UI).
--   * `on_deck_session_events` — the append-only log the `reduceSession` fold
--     consumes (#238's architecture section; the Pickle Point Pal
--     `reduceMatch` shape). This ticket only appends `SESSION_STARTED`; the
--     `type` check already lists the whole vocabulary so later tickets add
--     rows, not migrations.
--
-- Access, per ADR 0003's hybrid posture (coarse RLS net, nuance in app code):
--   * a Club and its Sessions/events are the owner's alone to manage;
--   * an *open* Session and its event log are additionally readable by
--     `anon` — Players scan the Club QR with no account and no auth session,
--     and the same facts are already on the venue's Display tablet. See
--     on-deck/docs/adr/0006.

-- ---------------------------------------------------------------------------
-- on_deck_clubs
-- ---------------------------------------------------------------------------

create table public.on_deck_clubs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  -- Saved Session defaults. A Start reads these onto the new Session row so
  -- editing a default never retroactively changes a running night.
  venue_name text not null,
  court_count integer not null default 8,
  group_cap integer not null default 4,
  floor_mode text not null default 'hybrid',
  created_at timestamptz not null default now(),

  constraint on_deck_club_name_not_blank check (btrim(name) <> ''),
  constraint on_deck_club_name_length check (char_length(name) <= 120),
  constraint on_deck_club_venue_not_blank check (btrim(venue_name) <> ''),
  constraint on_deck_club_venue_length check (char_length(venue_name) <= 120),
  constraint on_deck_club_court_count_range check (court_count between 1 and 40),
  constraint on_deck_club_group_cap_range check (group_cap between 2 and 8),
  constraint on_deck_club_floor_mode check (
    floor_mode in ('volunteer-run', 'self-serve', 'hybrid')
  )
);

comment on table public.on_deck_clubs is
  'On Deck tenant: an owner plus saved Session defaults (venue, court count, group cap, Floor Mode). One per real-world club, seeded by hand. See on-deck/CONTEXT.md.';

-- One Club per owner — the Organizer "lands on an On Deck home screen"
-- showing *their* Club (singular), and Start has to resolve to exactly one.
create unique index on_deck_clubs_one_per_owner on public.on_deck_clubs (owner_id);

-- ---------------------------------------------------------------------------
-- on_deck_sessions
-- ---------------------------------------------------------------------------

create table public.on_deck_sessions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.on_deck_clubs (id) on delete cascade,
  -- Snapshot of the Club's defaults at Start (see the comment above).
  venue_name text not null,
  court_count integer not null,
  group_cap integer not null,
  floor_mode text not null,
  status text not null default 'open',
  -- Deterministic tie-break seed for Match Me selection (ADR 0004): carried in
  -- the session config the fold reads, never `Math.random()`.
  seed text not null default gen_random_uuid()::text,
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint on_deck_session_venue_not_blank check (btrim(venue_name) <> ''),
  constraint on_deck_session_court_count_range check (court_count between 1 and 40),
  constraint on_deck_session_group_cap_range check (group_cap between 2 and 8),
  constraint on_deck_session_floor_mode check (
    floor_mode in ('volunteer-run', 'self-serve', 'hybrid')
  ),
  constraint on_deck_session_status check (status in ('open', 'closed')),
  constraint on_deck_session_seed_not_blank check (btrim(seed) <> ''),
  -- A closed Session records when; an open one has not closed.
  constraint on_deck_session_closed_at_matches_status check (
    (status = 'closed') = (closed_at is not null)
  )
);

comment on table public.on_deck_sessions is
  'One On Deck event night, belonging to a Club. Opened with one tap from the Club''s saved defaults; at most one open per Club at a time.';

-- The referencing side of the `on delete cascade` — Postgres does not index it
-- for you, and every read of a Session filters by Club.
create index on_deck_sessions_club_id on public.on_deck_sessions (club_id);

-- "Only one open Session per Club at a time (enforced, not just UI)."
create unique index on_deck_sessions_one_open_per_club
  on public.on_deck_sessions (club_id)
  where status = 'open';

-- ---------------------------------------------------------------------------
-- on_deck_session_events
-- ---------------------------------------------------------------------------

create table public.on_deck_session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.on_deck_sessions (id) on delete cascade,
  -- Total order for the fold. Global identity rather than per-session: the
  -- fold only needs the events of one Session to come back in append order,
  -- and a gapless per-session counter would need its own locking.
  seq bigint generated always as identity,
  type text not null,
  -- The Operator that produced the event (ADR 0005). `operator_user_id` is set
  -- only for an organizer — the one Operator kind backed by an account.
  operator_kind text not null,
  operator_user_id uuid references auth.users (id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  -- The event's own timestamp — the fold reads this, never the wall clock.
  at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint on_deck_event_type check (
    type in (
      'SESSION_STARTED',
      'PLAYER_JOINED',
      'PLAYER_SKILL_SET',
      'PLAYER_QUEUED',
      'PLAYER_PAUSED',
      'GROUP_FORMED',
      'GROUP_DISSOLVED',
      'GROUP_MEMBER_ADDED',
      'GROUP_MEMBER_REMOVED',
      'COURT_FINISHED',
      'FOURSOME_MEMBER_SWAPPED',
      'GROUP_CAP_CHANGED',
      'FLOOR_MODE_CHANGED',
      'LAST_CALL',
      'SESSION_CLOSED'
    )
  ),
  constraint on_deck_event_operator_kind check (
    operator_kind in ('organizer', 'volunteer', 'kiosk', 'player')
  ),
  -- An organizer event names the account behind it; nothing else carries one.
  constraint on_deck_event_operator_user_id_matches_kind check (
    (operator_kind = 'organizer') = (operator_user_id is not null)
  )
);

comment on table public.on_deck_session_events is
  'Append-only event log for one Session — the input to the reduceSession fold (issue #238). Purged into an anonymous Session Summary on close.';

create index on_deck_session_events_session_seq
  on public.on_deck_session_events (session_id, seq);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.on_deck_clubs enable row level security;
alter table public.on_deck_sessions enable row level security;
alter table public.on_deck_session_events enable row level security;

-- Clubs: the owner's alone, and read-only even to them here — a Club is
-- created by hand (service_role / SQL), not through the app.
create policy "an Organizer reads only their own Club"
  on public.on_deck_clubs for select
  to authenticated
  using ((select auth.uid()) = owner_id);

-- Sessions: the owning Organizer manages them; anyone (Players included, who
-- have no auth session) may read one while it is open. Two policies rather
-- than one OR'd predicate, so the `anon`-facing path never reaches into
-- `on_deck_clubs` — a table `anon` holds no grant on, which an inline
-- subquery would trip over ("permission denied") before RLS even runs.
create policy "an open Session is readable by anyone"
  on public.on_deck_sessions for select
  to anon, authenticated
  using (status = 'open');

create policy "an Organizer reads their own Club's Sessions"
  on public.on_deck_sessions for select
  to authenticated
  using (
    exists (
      select 1 from public.on_deck_clubs c
      where c.id = club_id and c.owner_id = (select auth.uid())
    )
  );

create policy "an Organizer opens Sessions for their own Club"
  on public.on_deck_sessions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.on_deck_clubs c
      where c.id = club_id and c.owner_id = (select auth.uid())
    )
  );

create policy "an Organizer updates their own Club's Sessions"
  on public.on_deck_sessions for update
  to authenticated
  using (
    exists (
      select 1 from public.on_deck_clubs c
      where c.id = club_id and c.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.on_deck_clubs c
      where c.id = club_id and c.owner_id = (select auth.uid())
    )
  );

-- Events: readable whenever the parent Session is (open, or the reader owns
-- the Club). Appendable only by the Club's Organizer, only while the Session
-- is open, and only carrying their own account as the Operator. Volunteer- and
-- Kiosk-sourced events arrive by other paths in later tickets.
create policy "an open Session's events are readable by anyone"
  on public.on_deck_session_events for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.on_deck_sessions s
      where s.id = session_id and s.status = 'open'
    )
  );

create policy "an Organizer reads their own Club's Session events"
  on public.on_deck_session_events for select
  to authenticated
  using (
    exists (
      select 1
      from public.on_deck_sessions s
      join public.on_deck_clubs c on c.id = s.club_id
      where s.id = session_id and c.owner_id = (select auth.uid())
    )
  );

create policy "an Organizer appends events to their own open Session"
  on public.on_deck_session_events for insert
  to authenticated
  with check (
    operator_kind = 'organizer'
    and operator_user_id = (select auth.uid())
    and exists (
      select 1
      from public.on_deck_sessions s
      join public.on_deck_clubs c on c.id = s.club_id
      where s.id = session_id
        and s.status = 'open'
        and c.owner_id = (select auth.uid())
    )
  );

-- Automatic table exposure is off on this project, so grants are explicit.
grant select on public.on_deck_clubs to authenticated;
grant select, insert, update on public.on_deck_sessions to authenticated;
grant select on public.on_deck_sessions to anon;
grant select, insert on public.on_deck_session_events to authenticated;
grant select on public.on_deck_session_events to anon;

-- The server owns Club creation and, later, the close-time purge into a
-- Session Summary — both need to bypass the read-only/owner-only posture above.
grant select, insert, update, delete on public.on_deck_clubs to service_role;
grant select, insert, update, delete on public.on_deck_sessions to service_role;
grant select, insert, update, delete on public.on_deck_session_events to service_role;

-- ---------------------------------------------------------------------------
-- Start: open a Session and append its SESSION_STARTED event, atomically
-- ---------------------------------------------------------------------------

/**
 * One tap opens a Session *and* appends its first event. Splitting that across
 * two PostgREST round trips risks an eventless open Session that the fold
 * reads as `pending` forever and that "one open per Club" then blocks a retry
 * on — so it is one function, one transaction.
 *
 * SECURITY DEFINER to write both tables in one go; the ownership check is
 * therefore explicit here rather than left to RLS. The Session is built from
 * the Club's saved defaults read straight off the row, so a stale value can't
 * be passed in. The partial unique index is what actually enforces "one open
 * Session per Club" — a concurrent caller gets a `unique_violation` the app
 * turns into landing on the Session that won.
 */
create function public.on_deck_start_session(p_club_id uuid)
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
    raise exception 'you can only start a Session for your own Club'
      using errcode = '42501';
  end if;

  insert into public.on_deck_sessions
    (club_id, venue_name, court_count, group_cap, floor_mode)
  values
    (v_club.id, v_club.venue_name, v_club.court_count, v_club.group_cap, v_club.floor_mode)
  returning id into v_session_id;

  insert into public.on_deck_session_events
    (session_id, type, operator_kind, operator_user_id, payload)
  values (
    v_session_id, 'SESSION_STARTED', 'organizer', v_uid,
    jsonb_build_object(
      'venueName', v_club.venue_name,
      'courtCount', v_club.court_count,
      'groupCap', v_club.group_cap,
      'floorMode', v_club.floor_mode
    )
  );

  return v_session_id;
end;
$$;

comment on function public.on_deck_start_session(uuid) is
  'Opens a Session from the Club''s saved defaults and appends its SESSION_STARTED event in one transaction. Caller must own the Club.';

revoke all on function public.on_deck_start_session(uuid) from public;
grant execute on function public.on_deck_start_session(uuid) to authenticated;

-- Dink Dine & Drink: Organizers, invites, DDDs and their tables (issue #711,
-- spec #709, glossary dink-dine-drink/CONTEXT.md).
--
-- Plain rows, as in Team Tally (team-tally/docs/adr/0001): standings, Seeding
-- and Shots are computed from these on read in later tickets. Team Tally's
-- patterns, copied; none of its tables shared.
--
--   ddd_superadmins        accounts that can do anything on any DDD. No role
--                          writes it through the API, service_role included;
--                          the one row is added by hand in the SQL editor
--                          (the repo is public, so the email stays out of it):
--                            insert into public.ddd_superadmins (user_id)
--                            select id from auth.users where email = '...';
--   ddd_organizers         the one Organizer list for every DDD. Joined
--                          through an invite, or by hand the same way
--   ddd_organizer_invites  single-use invite tokens, good for 7 days
--   ddd_venues             play venues drawn on the court grid, shared by
--                          every Organizer
--   ddd_events             one DDD: name, date, both venues, and the tokens
--                          behind its Score Link and Public Link
--   ddd_courts             a DDD's courts, in order: court 1 is position 1
--   ddd_teams, ddd_players the four Teams and their players (the roster
--                          paste fills them, #712)
--
-- Access is one check, ddd_is_organizer(): on the Organizer list, or a
-- Superadmin. Every table's policy is that check, so every Organizer reaches
-- every DDD. `anon` gets no table access; a link holder reaches a DDD only
-- through ddd_link_event, keyed on the token.

-- ---------------------------------------------------------------------------
-- Who can organize
-- ---------------------------------------------------------------------------

create table public.ddd_superadmins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

comment on table public.ddd_superadmins is
  'DDD: accounts that can do anything on any DDD. No policies, no grants: only the SQL editor writes it, only ddd_is_organizer reads it.';

alter table public.ddd_superadmins enable row level security;
revoke all on public.ddd_superadmins from anon, authenticated, service_role;

create table public.ddd_organizers (
  user_id uuid primary key references auth.users (id) on delete cascade,
  invited_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now()
);

comment on table public.ddd_organizers is
  'DDD: the one Organizer list for every DDD. Joined through ddd_join with an invite token, or by hand.';

alter table public.ddd_organizers enable row level security;
revoke all on public.ddd_organizers from anon, authenticated;
-- Tests and e2e put a throwaway Organizer on the list this way.
grant select, insert, delete on public.ddd_organizers to service_role;

create table public.ddd_organizer_invites (
  -- Bearer secret behind the invite link: 32 hex chars, ~122 bits.
  token text primary key
    default replace(gen_random_uuid()::text, '-', '')
    check (char_length(token) between 24 and 128),
  created_by uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  constraint ddd_organizer_invites_used_together check ((used_by is null) = (used_at is null))
);

comment on table public.ddd_organizer_invites is
  'DDD: invite links. Each adds one Organizer and lasts 7 days. Reached only through ddd_create_invite and ddd_join.';

alter table public.ddd_organizer_invites enable row level security;
revoke all on public.ddd_organizer_invites from anon, authenticated;

/** True when the caller is on the Organizer list or a Superadmin: the one check. */
create function public.ddd_is_organizer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.ddd_organizers where user_id = (select auth.uid()))
    or exists (select 1 from public.ddd_superadmins where user_id = (select auth.uid()));
$$;

revoke all on function public.ddd_is_organizer() from public, anon;
grant execute on function public.ddd_is_organizer() to authenticated;

/** A fresh invite token. Organizers only. */
create function public.ddd_create_invite()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if not public.ddd_is_organizer() then
    raise exception 'Only an Organizer can invite an Organizer.' using errcode = '42501';
  end if;

  insert into public.ddd_organizer_invites (created_by)
  values ((select auth.uid()))
  returning token into v_token;

  return v_token;
end;
$$;

revoke all on function public.ddd_create_invite() from public, anon;
grant execute on function public.ddd_create_invite() to authenticated;

/**
 * Puts the caller on the Organizer list with an unused, unexpired invite
 * token, and uses it up. True when the caller is an Organizer afterwards; an
 * Organizer opening an invite keeps it unused for whoever it was meant for.
 */
create function public.ddd_join(p_token text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_invited_by uuid;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  if public.ddd_is_organizer() then
    return true;
  end if;

  update public.ddd_organizer_invites
  set used_by = (select auth.uid()), used_at = now()
  where token = btrim(coalesce(p_token, ''))
    and used_by is null
    and expires_at > now()
  returning created_by into v_invited_by;

  if not found then
    return false;
  end if;

  insert into public.ddd_organizers (user_id, invited_by)
  values ((select auth.uid()), v_invited_by)
  on conflict (user_id) do nothing;

  return true;
end;
$$;

revoke all on function public.ddd_join(text) from public, anon;
grant execute on function public.ddd_join(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Venues
-- ---------------------------------------------------------------------------

-- Team Tally's Venues, shared by every Organizer rather than owned by one.
-- `grid` is the court grid as the app writes it (src/lib/court-grid/); the
-- app reads it back through readGrid, so the check only keeps out what is
-- plainly not a grid.
create table public.ddd_venues (
  id uuid primary key default gen_random_uuid(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  grid jsonb not null check (
    jsonb_typeof(grid -> 'courts') is not distinct from 'array'
    and jsonb_array_length(grid -> 'courts') between 1 and 320
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index ddd_venues_name_idx on public.ddd_venues (lower(btrim(name)));

-- ---------------------------------------------------------------------------
-- DDDs, courts, Teams, players
-- ---------------------------------------------------------------------------

create table public.ddd_events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  event_date date not null,
  play_venue text not null check (char_length(btrim(play_venue)) between 1 and 60),
  dine_venue text not null check (char_length(btrim(dine_venue)) between 1 and 60),
  -- Bearer secrets behind the Score Link and the Public Link.
  score_token text not null unique
    default replace(gen_random_uuid()::text, '-', '')
    check (char_length(score_token) between 24 and 128),
  public_token text not null unique
    default replace(gen_random_uuid()::text, '-', '')
    check (char_length(public_token) between 24 and 128),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ddd_events_date_idx on public.ddd_events (event_date desc, created_at desc);

comment on table public.ddd_events is
  'DDD: one Dink Dine & Drink event. Every Organizer reaches every one (issue #711).';

create table public.ddd_courts (
  event_id uuid not null references public.ddd_events (id) on delete cascade,
  -- Court 1 is position 1; the automatic court assignment reads this order.
  position smallint not null check (position between 1 and 20),
  name text not null check (char_length(btrim(name)) between 1 and 20),
  primary key (event_id, position),
  constraint ddd_courts_name_unique unique (event_id, name)
);

create table public.ddd_teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.ddd_events (id) on delete cascade,
  -- Named after its Captain.
  name text not null check (char_length(btrim(name)) between 1 and 60),
  position smallint not null check (position between 1 and 4),
  constraint ddd_teams_position_unique unique (event_id, position) deferrable initially deferred,
  constraint ddd_teams_name_unique unique (event_id, name) deferrable initially deferred
);

create table public.ddd_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.ddd_teams (id) on delete cascade,
  position smallint not null check (position between 1 and 30),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  gender text check (gender in ('M', 'F')),
  -- Any rating can be blank. DUAR and DUSR run 1.0 to 7.0.
  dupr numeric(4, 3) check (dupr between 1 and 9),
  duar numeric(2, 1) check (duar between 1 and 7),
  dusr numeric(2, 1) check (dusr between 1 and 7),
  constraint ddd_players_position_unique unique (team_id, position) deferrable initially deferred
);

create index ddd_teams_event_idx on public.ddd_teams (event_id);
create index ddd_players_team_idx on public.ddd_players (team_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: the one check, on every table
-- ---------------------------------------------------------------------------

alter table public.ddd_venues enable row level security;
alter table public.ddd_events enable row level security;
alter table public.ddd_courts enable row level security;
alter table public.ddd_teams enable row level security;
alter table public.ddd_players enable row level security;

create policy "Organizers manage Venues" on public.ddd_venues for all to authenticated
  using ((select public.ddd_is_organizer())) with check ((select public.ddd_is_organizer()));
create policy "Organizers manage DDDs" on public.ddd_events for all to authenticated
  using ((select public.ddd_is_organizer())) with check ((select public.ddd_is_organizer()));
create policy "Organizers manage courts" on public.ddd_courts for all to authenticated
  using ((select public.ddd_is_organizer())) with check ((select public.ddd_is_organizer()));
create policy "Organizers manage Teams" on public.ddd_teams for all to authenticated
  using ((select public.ddd_is_organizer())) with check ((select public.ddd_is_organizer()));
create policy "Organizers manage players" on public.ddd_players for all to authenticated
  using ((select public.ddd_is_organizer())) with check ((select public.ddd_is_organizer()));

-- Supabase's default privileges hand every new public table to anon. Link
-- holders go through ddd_link_event instead, so take it back.
revoke all on public.ddd_venues, public.ddd_events, public.ddd_courts,
  public.ddd_teams, public.ddd_players
  from anon;
grant select, insert, update, delete on public.ddd_venues, public.ddd_events,
  public.ddd_courts, public.ddd_teams, public.ddd_players
  to authenticated;

-- ---------------------------------------------------------------------------
-- ddd_save_event: create or edit a DDD and its courts in one transaction
-- ---------------------------------------------------------------------------

/**
 * Creates a DDD (`p_event_id` null) or edits one: name, date, both venues and
 * its courts in order. SECURITY INVOKER, so RLS refuses anyone off the
 * Organizer list. The form validates first (src/lib/ddd/events.ts); the court
 * checks here are the backstop.
 */
create function public.ddd_save_event(
  p_event_id uuid,
  p_name text,
  p_event_date date,
  p_play_venue text,
  p_dine_venue text,
  p_courts text[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_courts text[] := array(select btrim(c) from unnest(coalesce(p_courts, '{}')) as c);
begin
  if not public.ddd_is_organizer() then
    raise exception 'Only an Organizer can set up a DDD.' using errcode = '42501';
  end if;

  if cardinality(v_courts) not between 1 and 20 then
    raise exception 'a DDD needs 1 to 20 courts' using errcode = '22023';
  end if;

  if (select count(distinct c) from unnest(v_courts) as c) <> cardinality(v_courts) then
    raise exception 'two courts share a name' using errcode = '22023';
  end if;

  if p_event_id is null then
    insert into public.ddd_events (name, event_date, play_venue, dine_venue)
    values (btrim(p_name), p_event_date, btrim(p_play_venue), btrim(p_dine_venue))
    returning id into v_event_id;
  else
    update public.ddd_events
    set name = btrim(p_name), event_date = p_event_date,
        play_venue = btrim(p_play_venue), dine_venue = btrim(p_dine_venue),
        updated_at = now()
    where id = p_event_id
    returning id into v_event_id;

    if v_event_id is null then
      raise exception 'DDD not found' using errcode = 'P0002';
    end if;
  end if;

  delete from public.ddd_courts where event_id = v_event_id;
  insert into public.ddd_courts (event_id, position, name)
  select v_event_id, ordinality, name
  from unnest(v_courts) with ordinality as c (name, ordinality);

  return v_event_id;
end;
$$;

revoke all on function public.ddd_save_event(uuid, text, date, text, text, text[]) from public, anon;
grant execute on function public.ddd_save_event(uuid, text, date, text, text, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- ddd_link_event: what a Score Link or Public Link opens
-- ---------------------------------------------------------------------------

/**
 * The DDD behind a Score Link or Public Link token, with `link` saying which
 * one it is: 'score' or 'public'. Null for any other token. SECURITY DEFINER
 * because the caller is `anon`, with no table access; it never returns a
 * token. Later tickets add the roster, Games and standings to it.
 */
create function public.ddd_link_event(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'link', case when e.score_token = btrim(p_token) then 'score' else 'public' end,
    'id', e.id,
    'name', e.name,
    'date', e.event_date,
    'playVenue', e.play_venue,
    'dineVenue', e.dine_venue,
    'courts', coalesce((
      select jsonb_agg(c.name order by c.position)
      from public.ddd_courts c
      where c.event_id = e.id
    ), '[]'::jsonb)
  )
  from public.ddd_events e
  where char_length(btrim(coalesce(p_token, ''))) >= 24
    and btrim(p_token) in (e.score_token, e.public_token);
$$;

revoke all on function public.ddd_link_event(text) from public;
grant execute on function public.ddd_link_event(text) to anon, authenticated;

-- A Club's clock (issue #469).
--
-- On Deck has never needed a time zone. Every surface before now is read
-- *during* the Session it describes, where "tonight" needs no date and a wait
-- is a duration. The Session Summary is the first thing read the morning
-- after, so it is the first thing that has to name a day — and naming a day
-- from a `timestamptz` requires knowing whose clock to name it on.
--
-- The server runs on UTC in production, and TO Pickleball Club's socials run
-- 18:00–20:00 local. In Toronto that is 22:00–00:00 UTC in summer and
-- 23:00–01:00 in winter, so a night's close is routinely the *next* UTC day
-- and a winter start can be too. Formatting in UTC does not mislabel an edge
-- case here; it mislabels the normal case.
--
-- Modelled on Booking Buddy's `orgs.time_zone` (its issue #20): a text column
-- holding an IANA name, with a trigger asking Postgres itself whether the zone
-- exists. Deliberately a separate implementation rather than a shared one, for
-- the same reason `src/lib/on-deck/env.ts` reads its own environment — the two
-- contexts share this Supabase project and nothing else (CONTEXT-MAP.md).

-- ---------------------------------------------------------------------------
-- The zone must be one Postgres itself recognises
-- ---------------------------------------------------------------------------

create function public.on_deck_check_time_zone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Null is a state, not a bad value: it means nobody has said what clock this
  -- Club keeps. A Club is seeded by hand from SQL, where there is no browser to
  -- ask, so the row has to be insertable without one.
  if new.time_zone is null then
    return new;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_timezone_names t where t.name = new.time_zone
  ) then
    raise exception 'unknown time zone %', new.time_zone
      using errcode = '22023';
  end if;
  return new;
end;
$$;

comment on function public.on_deck_check_time_zone() is
  'Rejects a time_zone Postgres does not recognise. `Intl` accepts bare offsets like +05:30 that pg_timezone_names does not, and an offset cannot say what happens when the clocks change — which is the one thing storing a zone is for.';

-- ---------------------------------------------------------------------------
-- on_deck_clubs.time_zone — the Club's own clock
-- ---------------------------------------------------------------------------

-- Nullable, and deliberately left null for existing Clubs, because null
-- carries real information here: nobody has said what clock this Club keeps.
--
-- The alternative was defaulting to UTC, which would be indistinguishable
-- from a Club that genuinely runs on UTC. That difference is what lets an
-- Organizer never answer this question at all: the first time one loads their
-- home screen the app reads the zone off their own browser and fills this in
-- (`adoptDetectedTimeZone`), and it only ever does so while this is null, so
-- it can never overwrite a choice somebody made on purpose.
alter table public.on_deck_clubs add column time_zone text;

comment on column public.on_deck_clubs.time_zone is
  'IANA zone the Club''s nights are named on (issue #469). Display only, since
   every timestamp is stored as timestamptz. Null means not established yet:
   the app adopts the Organizer''s own browser zone on their first visit, and
   Settings can correct it.';

create trigger on_deck_clubs_time_zone_valid
  before insert or update of time_zone on public.on_deck_clubs
  for each row execute function public.on_deck_check_time_zone();

-- ---------------------------------------------------------------------------
-- on_deck_sessions.time_zone — snapshotted, like every other Club default
-- ---------------------------------------------------------------------------

-- A Session already snapshots venue, court count, group cap and Floor Mode at
-- creation so that editing a default never retroactively changes a night. The
-- clock is the same kind of fact: a club that moves cities should not have
-- last season's Summaries renamed onto the new one.
alter table public.on_deck_sessions add column time_zone text;

/**
 * Fills a new Session's zone from its Club.
 *
 * A trigger rather than three edited RPCs. Sessions are inserted from three
 * places today — `on_deck_start_session`, the pre-creation path, and starting
 * a scheduled one (#254) — and every one of them exists to copy the Club's
 * defaults onto the row. Recreating all three to thread one more column
 * through would leave the *next* insert path free to forget it; this cannot
 * be forgotten, because it is not the caller's job any more.
 */
create function public.on_deck_session_inherit_time_zone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.time_zone is null then
    select c.time_zone into new.time_zone
      from public.on_deck_clubs c where c.id = new.club_id;
    -- A Club whose zone is still unknown yields UTC rather than null, so a
    -- Session's own column can stay NOT NULL and the reader never has to ask
    -- twice. Close to unreachable in practice: an Organizer loads their home
    -- screen, which establishes the zone, long before they tap Start.
    new.time_zone := coalesce(new.time_zone, 'UTC');
  end if;
  return new;
end;
$$;

comment on function public.on_deck_session_inherit_time_zone() is
  'Copies the owning Club''s time_zone onto a new Session, so no insert path has to remember to (issue #469). SECURITY DEFINER because the caller is not always allowed to read the Club row directly.';

create trigger on_deck_sessions_inherit_time_zone
  before insert on public.on_deck_sessions
  for each row execute function public.on_deck_session_inherit_time_zone();

update public.on_deck_sessions s
  set time_zone = coalesce(
    (select c.time_zone from public.on_deck_clubs c where c.id = s.club_id),
    'UTC'
  )
  where s.time_zone is null;

alter table public.on_deck_sessions alter column time_zone set not null;

comment on column public.on_deck_sessions.time_zone is
  'The Club''s clock as it stood when this Session was created (issue #469). Snapshotted for the same reason venue and court count are: editing a default must not rewrite a night that already happened.';

-- ---------------------------------------------------------------------------
-- on_deck_update_club_defaults gains the zone
-- ---------------------------------------------------------------------------

-- Dropped and recreated rather than overloaded: two functions differing only
-- by an added argument is how a caller ends up silently invoking the old one
-- and wondering why its value never saved.
drop function public.on_deck_update_club_defaults(text, integer, integer);

create function public.on_deck_update_club_defaults(
  p_venue_name text,
  p_court_count integer,
  p_group_cap integer,
  p_time_zone text
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
        group_cap = p_group_cap,
        time_zone = p_time_zone
    where owner_id = v_uid;

  if not found then
    raise exception 'no Club to update for this account' using errcode = '42501';
  end if;
end;
$$;

comment on function public.on_deck_update_club_defaults(text, integer, integer, text) is
  'Updates the caller''s own Club''s saved defaults (venue, court count, group cap, time zone). Only those four columns; owner and name are untouchable through this path. An unknown zone is refused by the on_deck_clubs trigger, not here.';

revoke all on function public.on_deck_update_club_defaults(text, integer, integer, text) from public;
grant execute on function public.on_deck_update_club_defaults(text, integer, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- on_deck_adopt_club_time_zone -- fill a blank clock, never overwrite one
-- ---------------------------------------------------------------------------

/**
 * Sets the caller's own Club's time zone, but only while it has none.
 *
 * This is what spares an Organizer a setup question they have no reason to
 * care about: their browser already knows the answer, so the app reads it off
 * their first visit and writes it here. The `is null` in the WHERE clause is
 * the entire safety property. Without it, an Organizer who set their clock by
 * hand in Settings, or who opens the board from a hotel in another country,
 * would have it silently rewritten by whichever device they happened to pick
 * up. With it, this is a one-time adoption and every later call is a no-op.
 *
 * Not an error when it changes nothing: "already set" is the expected outcome
 * on all but the first call, and the client fires this without waiting to see.
 * An unknown zone is still refused, by the table's own trigger.
 */
create function public.on_deck_adopt_club_time_zone(p_time_zone text)
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
    set time_zone = p_time_zone
    where owner_id = v_uid and time_zone is null;
end;
$$;

comment on function public.on_deck_adopt_club_time_zone(text) is
  'Sets the caller''s own Club''s time_zone only if it has none (issue #469). Lets an Organizer never be asked: the app adopts their browser zone on first visit, and a later call cannot overwrite a deliberate choice.';

revoke all on function public.on_deck_adopt_club_time_zone(text) from public;
grant execute on function public.on_deck_adopt_club_time_zone(text) to authenticated;

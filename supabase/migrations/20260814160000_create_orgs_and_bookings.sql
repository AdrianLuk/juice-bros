-- An Org is one User's record of playing at a Place; a Booking is one court
-- reservation held under it, mirroring a record that already exists on the
-- facility's own platform (see CONTEXT.md). Bookings are entered by hand —
-- ADR 0002 rules out integrating with any facility platform's API — so the
-- database's job here is to keep hand-entered data coherent.
--
-- Where the venue exists in Google Maps, the Org names it by `place_id` rather
-- than by a typed string, so that two Users at the same club point at the same
-- identifier and anything cross-User can join them up. The facts about that
-- Place live once in `place_cache`, written by the server and by nobody else.
-- ADR 0005 has the reasoning.
--
-- Neither `orgs` nor `bookings` is friend-visible. A Booking reaches a friend
-- only through a Slot it has been attached to, which does not exist yet; until
-- it does, the coarse RLS net below is the whole story and it says "yours and
-- nobody else's".

/**
 * Facts about a Place, cached from Google Places: one row per facility across
 * the entire user base, not per User.
 *
 * The only table in Booking Buddy that isn't owner-scoped, and the only one
 * `authenticated` cannot write. Google's terms permit caching a `place_id`
 * indefinitely and coordinates for up to 30 consecutive days, and give display
 * name and formatted address no caching exception at all — so this is a cache
 * with a lifetime, refreshed when stale, never a local source of truth.
 * `fetched_at` is what makes staleness decidable.
 */
create table public.place_cache (
  place_id text primary key,
  name text not null,
  formatted_address text not null,
  -- Nullable: the 30-day coordinate window can expire while the row itself
  -- stays, since `place_id` may be kept indefinitely. A row with coordinates
  -- stripped is a valid row, not a broken one.
  latitude double precision,
  longitude double precision,
  fetched_at timestamptz not null default now(),

  constraint place_cache_id_not_blank check (btrim(place_id) <> ''),
  constraint place_cache_latitude_range check (
    latitude is null or latitude between -90 and 90
  ),
  constraint place_cache_longitude_range check (
    longitude is null or longitude between -180 and 180
  ),
  -- Either both coordinates or neither. One of the pair is not a location.
  constraint place_cache_coordinates_paired check (
    (latitude is null) = (longitude is null)
  )
);

comment on table public.place_cache is
  'Cached Google Places facts, keyed by place_id. Server-written, read-only to Users, refreshed rather than authored. See ADR 0005.';

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- Deliberately not a foreign key to `place_cache`. The cache is a cache: a
  -- row can be missing or stale, and the read path has to cope with that
  -- anyway (ADR 0005 names the cache miss as a failure mode). An FK would make
  -- an Org uninsertable until the server had fetched the Place, which couples
  -- this table to the Places integration rather than to the Place itself.
  google_place_id text,
  -- Set only for a venue Google doesn't list — a community-centre gym, a
  -- private court. A place-backed Org has no name of its own; its name is the
  -- Place's, which is what stops one club drifting into three spellings.
  name text,
  created_at timestamptz not null default now(),

  constraint org_place_backed_or_hand_named check (
    (google_place_id is not null and name is null)
    or (google_place_id is null and name is not null)
  ),
  constraint org_name_not_blank check (name is null or btrim(name) <> ''),
  constraint org_name_length check (name is null or char_length(name) <= 80),
  constraint org_place_id_not_blank check (
    google_place_id is null or btrim(google_place_id) <> ''
  ),
  constraint org_place_id_length check (
    google_place_id is null or char_length(google_place_id) <= 255
  )
);

comment on table public.orgs is
  'One User''s record of playing at a Place: either Google-backed via google_place_id, or hand-named where Google has no listing. Private to its owner.';

-- Adding the same club twice would put two indistinguishable entries in the
-- Booking form's picker. Per owner, because two Users naming the same real club
-- is the expected case — it is the whole reason for storing a place_id.
create unique index orgs_unique_place_per_owner
  on public.orgs (owner_id, google_place_id)
  where google_place_id is not null;

-- The same rule for the hand-named ones, case-insensitive: "rally point" is not
-- a second club.
create unique index orgs_unique_name_per_owner
  on public.orgs (owner_id, lower(btrim(name)))
  where name is not null;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  court_label text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- The IANA zone the User was in when they entered the reservation. Stored
  -- because `starts_at` is an instant, and rendering it back as the wall-clock
  -- time on the facility's own booking screen needs to know which clock that
  -- was. Without it the server renders in its own zone — UTC, in production.
  time_zone text not null,
  created_at timestamptz not null default now(),

  constraint booking_court_not_blank check (btrim(court_label) <> ''),
  constraint booking_court_length check (char_length(court_label) <= 40),
  constraint booking_ends_after_start check (ends_at > starts_at)
);

comment on table public.bookings is
  'One court reservation at an Org, owned by a User. Mirrors a reservation that exists on the facility''s platform; there is no "intended" state.';

-- `owner_id` duplicates `orgs.owner_id` on purpose: it makes the RLS policy a
-- column comparison rather than a subquery on every row. The trigger below is
-- what keeps the two from drifting apart.
create index bookings_owner_starts_at on public.bookings (owner_id, starts_at);

/**
 * A Booking belongs to the same User as the Org it sits under, and carries a
 * time zone Postgres itself recognises.
 *
 * A trigger rather than check constraints: the first rule needs a subquery,
 * and the second needs a lookup. It fires on update too, so a row cannot be
 * edited into a state the insert would have refused — moving a Booking to
 * somebody else's Org is the same misattribution as creating it there.
 *
 * RLS does not cover the first rule. The insert is on `bookings`, a table the
 * User is allowed to write; nothing in that policy looks at whose Org they
 * named.
 */
create function public.assert_booking_coherent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.orgs o
    where o.id = new.org_id
      and o.owner_id = new.owner_id
  ) then
    raise exception 'a booking can only sit under one of your own orgs'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_timezone_names t where t.name = new.time_zone
  ) then
    raise exception 'unknown time zone %', new.time_zone
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger bookings_coherent
  before insert or update on public.bookings
  for each row execute function public.assert_booking_coherent();

-- Row Level Security: the coarse net (ADR 0003). For `orgs` and `bookings`
-- everything is "this is mine", and that is also the whole rule. `place_cache`
-- is the deliberate exception — shared, and read-only to everyone but the
-- server.

alter table public.orgs enable row level security;
alter table public.bookings enable row level security;
alter table public.place_cache enable row level security;

create policy "a User sees only their own orgs"
  on public.orgs for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "a User sees only their own bookings"
  on public.bookings for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Read-only, and to every signed-in User rather than to an owner: a cached
-- Place belongs to nobody. There is deliberately no insert/update/delete
-- policy — the grant below withholds those privileges too, so a write is
-- refused outright rather than silently filtered to zero rows.
create policy "any signed-in User can read cached places"
  on public.place_cache for select
  to authenticated
  using (true);

-- Automatic table exposure is off on this project, so grants are explicit.
grant select, insert, update, delete on public.orgs to authenticated;
grant select, insert, update, delete on public.bookings to authenticated;
grant select on public.place_cache to authenticated;

-- The first place `service_role` is genuinely needed: filling and refreshing
-- the cache is the server's job alone, and it has to bypass the read-only
-- posture above to do it. PROGRESS.md expected Phase 8's Reminder job to get
-- here first; this beat it.
grant select, insert, update, delete on public.place_cache to service_role;

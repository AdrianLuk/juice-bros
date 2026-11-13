-- Team Tally: Venues (issue #698).
--
-- A Venue is a facility the Organizer drew once on the court grid
-- (src/lib/court-grid/), saved to their account under a name, as many as they
-- want. In setup they pick one and tap each opening Matchup's Court pair on
-- it. Nothing else reads it: a Team still stores its Home court as text, so
-- the Brief, Flights and both links never know a Venue was used.
--
-- `grid` is the court grid as the app writes it, `{"courts": [{row, col,
-- number}]}`. The app reads it back through readGrid, which refuses anything
-- malformed; the checks here only keep out what is plainly not a grid.
--
-- Access: an Organizer reads and writes only their own Venues; the
-- Superadmin reaches every one, as with Team Events. `anon` gets nothing.

create table public.team_tally_venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  grid jsonb not null check (
    -- IS NOT DISTINCT FROM, so a grid with no courts key fails rather than passing as null.
    jsonb_typeof(grid -> 'courts') is not distinct from 'array'
    -- 16 columns by 20 rows: the largest grid the painter draws.
    and jsonb_array_length(grid -> 'courts') between 1 and 320
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One name per Organizer, however it is capitalised or spaced.
create unique index team_tally_venues_owner_name_idx
  on public.team_tally_venues (owner_id, lower(btrim(name)));

comment on table public.team_tally_venues is
  'Team Tally: a facility drawn on the court grid and saved to the Organizer''s account, to pick Court pairs from in setup (issue #698).';

alter table public.team_tally_venues enable row level security;

create policy "Organizers manage their own Venues"
  on public.team_tally_venues for all to authenticated
  using (owner_id = (select auth.uid()) or (select public.team_tally_is_superadmin()))
  with check (owner_id = (select auth.uid()) or (select public.team_tally_is_superadmin()));

-- Supabase's default privileges hand every new public table to anon.
revoke all on public.team_tally_venues from anon;
grant select, insert, update, delete on public.team_tally_venues to authenticated;

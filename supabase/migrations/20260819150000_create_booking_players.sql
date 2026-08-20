-- A Player (issue #99, first slice of #98): someone recorded as having played
-- in a Booking — a name, plus an optional link to the Connection it matched
-- (see CONTEXT.md's Player entry, ADR 0011). Entered by hand (a
-- comma-separated list, split in `parseNewBooking`) or, in a later ticket,
-- carried through from a confirmed Import Candidate's own parsed names.
--
-- A child table of `bookings`, not a column on it — a Booking can carry any
-- number of Players (rotation/subs are real, and the same name can appear
-- twice), which a single column can't hold. No uniqueness constraint on
-- (booking_id, name) for that same reason: two different people can share a
-- first name.
--
-- The Connection link is resolved once, at write time, by
-- `matchPlayerNamesToConnections` — never recomputed here. `on delete set
-- null` is what lets that stored link disappear without touching the name
-- text when the matched Connection later ends (ADR 0011).

create table public.booking_players (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  name text not null,
  connection_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),

  -- Same not-blank/length pair as bookings.court_label — a Player's name is
  -- exactly that shape of optional-length free text, just not optional itself
  -- once a row exists (an empty Player is dropped by parseNewBooking before
  -- it ever reaches here).
  constraint booking_player_name_not_blank check (btrim(name) <> ''),
  constraint booking_player_name_length check (char_length(name) <= 40)
);

comment on table public.booking_players is
  'Someone recorded as having played in a Booking — a name plus an optional, write-time-only link to a Connection. See CONTEXT.md''s Player entry and ADR 0011.';

-- The referencing side of the `bookings` cascade, which Postgres does not
-- index for you — same reasoning as `bookings_org_id`.
create index booking_players_booking_id on public.booking_players (booking_id);

alter table public.booking_players enable row level security;

-- Mirrors `bookings`' own owner-only posture (ADR 0003): a Player row is
-- visible/writable only by the owner of the Booking it sits under. A subquery
-- rather than a duplicated `owner_id` column — unlike `slot_bookings`,
-- nothing else ever needs to read this table by anyone but the Booking's own
-- owner, so there's no friend-visibility path that would want the cheaper
-- column comparison.
create policy "a User sees and writes only players on their own bookings"
  on public.booking_players for all
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id and b.owner_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.booking_players to authenticated;

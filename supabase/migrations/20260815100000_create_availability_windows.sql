-- An Availability Window is a User's own dated open/busy declaration,
-- independent of Bookings (see CONTEXT.md). It is entirely informational: it
-- never blocks or auto-declines anything, it only signals the owner's own
-- read of their schedule to Connections with `calendar`-level Visibility.
--
-- Deliberately no uniqueness or overlap constraint — ADR 0006's whole point is
-- that overlapping windows are allowed and resolved by a layered read
-- (resolveAvailability, src/lib/booking-buddy/availability.ts), not rejected
-- at write time. Reading "what does this User's calendar say" is a resolver's
-- job, not this table's.
--
-- Unlike every other table so far, the read policy below is not pure
-- ownership: `calendar` Visibility is specifically what this table is gated
-- by (CONTEXT.md), so the coarse net has to know the resolved level, not just
-- who owns the row. The precedence chain it reuses (override beats most-
-- permissive Friend Group default) already exists as `friend_groups` and
-- `visibility_overrides`; nothing else in that chain — which Availability
-- Window itself wins an overlap, Booking/Slot precedence — lives here.

create type public.availability_type as enum ('open', 'busy');

create table public.availability_windows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  type public.availability_type not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint availability_window_ends_after_start check (ends_at > starts_at)
);

comment on table public.availability_windows is
  'A User''s own dated open/busy declaration, independent of Bookings. No uniqueness/overlap constraint — see ADR 0006. Visible to Connections at calendar-level Visibility.';

-- Every read is "mine" (the owner's own settings page) or "this owner's,
-- newest first" (resolveAvailability, which needs creation order to break
-- ties) — the same shape as `bookings_owner_starts_at`.
create index availability_windows_owner_created_at
  on public.availability_windows (owner_id, created_at desc);

/**
 * True when `viewer_user` has `calendar`-level Visibility into `owner_user`,
 * per the same precedence CONTEXT.md defines and visibility.ts implements: an
 * explicit override wins outright in either direction; otherwise any Friend
 * Group of the owner's, containing the connection, defaulting to `calendar`
 * grants it. `calendar` is the top of `visibility_level`'s order, so "at
 * least calendar" and "is calendar" are the same question — the full
 * most-permissive-of-several-groups reduction isn't needed to answer it.
 *
 * Security definer so the policy below can evaluate this without the caller
 * needing direct select access to `friend_groups`/`visibility_overrides` —
 * those stay owner-only (Phase 3).
 */
create function public.has_calendar_visibility(owner_user uuid, viewer_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select vo.level = 'calendar'
      from public.connections c
      join public.visibility_overrides vo
        on vo.connection_id = c.id
       and vo.owner_id = owner_user
      where c.status = 'accepted'
        and (
          (c.requester_id = owner_user and c.addressee_id = viewer_user)
          or (c.requester_id = viewer_user and c.addressee_id = owner_user)
        )
    ),
    exists (
      select 1
      from public.connections c
      join public.friend_group_members fgm on fgm.connection_id = c.id
      join public.friend_groups fg
        on fg.id = fgm.group_id
       and fg.owner_id = owner_user
       and fg.default_visibility = 'calendar'
      where c.status = 'accepted'
        and (
          (c.requester_id = owner_user and c.addressee_id = viewer_user)
          or (c.requester_id = viewer_user and c.addressee_id = owner_user)
        )
    )
  );
$$;

-- Row Level Security. Reads are broader than writes: the owner or a
-- calendar-visible friend may read; only the owner may write. Split into
-- per-command policies rather than one `for all`, since select and
-- insert/update/delete need different `using` expressions.

alter table public.availability_windows enable row level security;

create policy "an owner or a calendar-visible friend can read availability windows"
  on public.availability_windows for select
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or public.has_calendar_visibility(owner_id, (select auth.uid()))
  );

create policy "a User creates only their own availability windows"
  on public.availability_windows for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "a User updates only their own availability windows"
  on public.availability_windows for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "a User deletes only their own availability windows"
  on public.availability_windows for delete
  to authenticated
  using ((select auth.uid()) = owner_id);

-- Automatic table exposure is off on this project, so grants are explicit.
grant select, insert, update, delete on public.availability_windows to authenticated;

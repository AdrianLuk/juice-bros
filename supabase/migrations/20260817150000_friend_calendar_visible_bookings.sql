-- Friend calendar view (issue #61): a friend-facing, read-only calendar of a
-- Connection's resolved busy time, gated by the existing Visibility lattice
-- (CONTEXT.md, ADR 0007). This is the first time a Booking's facility name
-- reaches anyone but its owner — Phase 4's own migration comment says "a
-- Booking reaches a friend only through an attached Slot," and even that path
-- (`slot_bookings`) never copies over which facility. See
-- adr/0010-friend-calendar-reads-bookings-through-a-view.md for the reasoning.
--
-- Two pieces:
--   * `friend_visible_bookings` (a view) — id/starts_at/ends_at/facility_name
--     only, never court_label, never a raw `bookings`/`orgs` row. Gated by
--     `has_open_time_visibility`, the same function `availability_windows`'s
--     read policy already uses — no new predicate logic, per the ticket.
--     Deliberately not `security_invoker`, the same "security definer" view
--     posture `slot_booking_windows` already established: it runs as its
--     owner, so the `has_open_time_visibility(...)` predicate embedded in its
--     `where` clause is the actual access control, evaluated per caller via
--     `auth.uid()` — not the underlying tables' owner-only RLS, which this
--     view is built to see past.
--   * `open_time_visible_owners` (a function) — batches the "does this friend
--     grant me open_time" question over a whole friends list in one round
--     trip, for the friends page's "View calendar" action (acceptance
--     criterion 1). Built directly on `has_open_time_visibility`; adds no new
--     predicate logic either.

create view public.friend_visible_bookings as
select
  b.id as booking_id,
  b.owner_id,
  b.starts_at,
  b.ends_at,
  -- Mirrors `orgDisplayName` (orgs.ts): the hand-typed name if there is one,
  -- otherwise the cached Place's, otherwise the same admission the owner's
  -- own Orgs page shows on a cache miss. Computed here rather than left to
  -- the caller because `orgs`/`place_cache` join logic belongs in one place,
  -- and the caller only gets this view, never the raw rows it's built from.
  coalesce(
    nullif(btrim(o.name), ''),
    nullif(btrim(pc.name), ''),
    'Facility details unavailable'
  ) as facility_name
from public.bookings b
join public.orgs o on o.id = b.org_id
left join public.place_cache pc on pc.place_id = o.google_place_id
where public.has_open_time_visibility(b.owner_id, (select auth.uid()));

comment on view public.friend_visible_bookings is
  'A Connection''s busy Bookings, resolved to id/starts_at/ends_at/facility_name only, gated by has_open_time_visibility. Never court_label, never a raw bookings/orgs row (issue #61).';

grant select on public.friend_visible_bookings to authenticated;

/**
 * Which of `owner_users` currently grant the caller open_time Visibility —
 * one round trip for a whole friends list instead of one RPC per row.
 *
 * `security definer` for the same reason `has_open_time_visibility` itself
 * is: the caller has no read access to another User's Friend Groups,
 * memberships or overrides, so there is no way to answer this from the
 * client side of RLS. The viewer is always the caller's own `auth.uid()` —
 * never a parameter — so this can't be used to ask the question on anyone
 * else's behalf.
 */
create function public.open_time_visible_owners(owner_users uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ou
  from unnest(owner_users) as ou
  where public.has_open_time_visibility(ou, (select auth.uid()));
$$;

comment on function public.open_time_visible_owners(uuid[]) is
  'The subset of owner_users that grant the caller open_time Visibility (issue #61) — batched for the friends page''s "View calendar" action.';

grant execute on function public.open_time_visible_owners(uuid[]) to authenticated;

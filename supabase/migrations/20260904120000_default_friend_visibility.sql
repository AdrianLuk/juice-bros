-- The Visibility lattice's floor stops being a hardcoded `none` and becomes a
-- per-User setting, `profiles.default_friend_visibility`, defaulting to
-- `calendar` — accepting a Connection is now on its own enough for two friends
-- to see each other's games and Availability Windows, with no Friend Group and
-- no per-friend override. See adr/0021-visibility-default-is-calendar.md; the
-- lattice itself (ADR 0007) is unchanged, only where it starts.
--
-- Three pieces, deliberately in one migration: the column, the two SQL mirrors
-- of `resolveVisibility` that have to agree with it at all times, and the
-- removal of the accept-time trigger this setting replaces.

alter table public.profiles
  add column default_friend_visibility public.visibility_level
    not null default 'calendar';

-- `not null default` backfills every existing row to `calendar` on the spot,
-- which is the intended migration behaviour, not an accident of it: all
-- current accounts are the developer's own test accounts, so there is no
-- userbase whose exposure could change under them (ADR 0021).

comment on column public.profiles.default_friend_visibility is
  'What an accepted Connection sees by default, before Friend Groups and per-friend overrides — the floor of the Visibility lattice, per-User (ADR 0021).';

/**
 * True when `viewer_user` has at least `slots`-level Visibility into
 * `owner_user`: an explicit override of `slots` or `calendar` wins outright in
 * either direction; otherwise any Friend Group of the owner's containing the
 * connection and defaulting to `slots` or `calendar` grants it, and failing
 * that the owner's own `default_friend_visibility` does.
 *
 * The default sits inside the existing `coalesce`, after the group `exists`,
 * so an override of `none` still shuts the friend out: that subquery returns a
 * non-null `false` and the `coalesce` short-circuits before either the group
 * or the default branch is reached. `coalesce` again around the default itself
 * because a Connection can outlive a deleted profile row, and a null there
 * would poison the `or`.
 */
create or replace function public.has_slot_visibility(owner_user uuid, viewer_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select vo.level in ('slots', 'calendar')
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
       and fg.default_visibility in ('slots', 'calendar')
      where c.status = 'accepted'
        and (
          (c.requester_id = owner_user and c.addressee_id = viewer_user)
          or (c.requester_id = viewer_user and c.addressee_id = owner_user)
        )
    )
    or coalesce(
      (
        select p.default_friend_visibility in ('slots', 'calendar')
        from public.connections c
        join public.profiles p on p.id = owner_user
        where c.status = 'accepted'
          and (
            (c.requester_id = owner_user and c.addressee_id = viewer_user)
            or (c.requester_id = viewer_user and c.addressee_id = owner_user)
          )
      ),
      false
    )
  );
$$;

/**
 * The open-time mirror of `has_slot_visibility`, testing the other slice of
 * the lattice — `open_time` or `calendar` — down the same precedence chain.
 */
create or replace function public.has_open_time_visibility(owner_user uuid, viewer_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select vo.level in ('open_time', 'calendar')
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
       and fg.default_visibility in ('open_time', 'calendar')
      where c.status = 'accepted'
        and (
          (c.requester_id = owner_user and c.addressee_id = viewer_user)
          or (c.requester_id = viewer_user and c.addressee_id = owner_user)
        )
    )
    or coalesce(
      (
        select p.default_friend_visibility in ('open_time', 'calendar')
        from public.connections c
        join public.profiles p on p.id = owner_user
        where c.status = 'accepted'
          and (
            (c.requester_id = owner_user and c.addressee_id = viewer_user)
            or (c.requester_id = viewer_user and c.addressee_id = owner_user)
          )
      ),
      false
    )
  );
$$;

-- `open_time_visible_owners` and `friend_visible_bookings` are built directly
-- on `has_open_time_visibility` and pick the new branch up for free — ADR 0010
-- holds, and neither is touched here.

-- The accept-time trigger (#76) that stamped a `calendar` `visibility_overrides`
-- row on both sides goes away: it solved the same onboarding cliff by freezing
-- each Connection at its accept-day default, which overloads "override" (the
-- glossary reserves it for a deliberate per-friend exception) and leaves the
-- picker's "use my default" with nothing to fall back to. The setting above
-- does the same job as a live value instead.
drop trigger connections_seed_visibility_on_accept on public.connections;
drop function public.seed_visibility_overrides_on_accept();

-- And the rows it already stamped go with it, so existing Connections land on
-- the new default rather than staying pinned to an override nobody chose. A
-- deliberate `calendar` override is indistinguishable from a stamped one and
-- grants exactly what the `calendar` default already does, so nothing visible
-- changes today; what changes is that lowering the default now moves these
-- friends too.
delete from public.visibility_overrides where level = 'calendar';

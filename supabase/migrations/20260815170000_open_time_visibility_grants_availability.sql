-- `open_time` (added in the previous migration) grants Availability Window
-- visibility the same way `calendar` already did — `calendar` is now just
-- `slots` and `open_time` together, not a single top rung. The function that
-- used to answer "is it exactly calendar" (calendar was the top of the old
-- total order, so "at least calendar" and "is calendar" were the same
-- question) becomes "does it grant open_time", which `open_time` and
-- `calendar` both do; renamed to match (#31).
--
-- Postgres tracks the RLS policy that calls this function by OID, not by
-- name, so renaming it doesn't require recreating the policy — only the
-- policy's own name is touched below, for the same reason.

alter function public.has_calendar_visibility(uuid, uuid)
  rename to has_open_time_visibility;

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
  );
$$;

alter policy "an owner or a calendar-visible friend can read availability windows"
  on public.availability_windows
  rename to "an owner or an open-time-visible friend can read availability windows";

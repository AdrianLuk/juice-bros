-- Receiving a friend request is useless if you cannot see who sent it. The
-- original policy made a profile readable only once a Connection was accepted,
-- which left a pending request showing an anonymous row.
--
-- Name visibility and calendar visibility are different things: seeing who is
-- asking is necessary to answer, while seeing someone's availability should
-- still require their agreement. So this widens *profile* readability to
-- pending Connections and leaves `is_connected_to` — the accepted-only test
-- that later gates Slots — untouched.

create function public.has_pending_or_accepted_connection(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.connections c
    where (
      (c.requester_id = (select auth.uid()) and c.addressee_id = other_user)
      or
      (c.addressee_id = (select auth.uid()) and c.requester_id = other_user)
    )
  );
$$;

comment on function public.has_pending_or_accepted_connection(uuid) is
  'True for any Connection with this User, pending or accepted. Gates profile readability only — availability still requires an accepted Connection.';

drop policy "profiles are readable by accepted connections" on public.profiles;

create policy "profiles are readable by pending or accepted connections"
  on public.profiles for select
  to authenticated
  using (public.has_pending_or_accepted_connection(id));

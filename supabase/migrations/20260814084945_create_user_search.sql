-- Finding a User to befriend is a chicken-and-egg problem: RLS makes a profile
-- readable only to its owner and accepted Connections, but you have to find
-- someone before you can ask to connect.
--
-- Rather than widening that policy — which would turn Booking Buddy into a
-- browsable directory of everyone's names, against the privacy stance in
-- CONTEXT.md — lookup goes through this one narrow function. You can find
-- someone you already know how to identify; you cannot enumerate the
-- membership.

create type public.user_search_result as (
  id uuid,
  display_name text,
  connection_status text
);

/**
 * Look up Users by display name or exact email address.
 *
 * SECURITY DEFINER because it reads auth.users and other Users' profiles,
 * which the caller cannot read directly — that is the entire point. The
 * restrictions below are what make that safe:
 *
 *   - a minimum query length, so a single character cannot list everyone
 *   - email matches must be exact, so addresses cannot be harvested by
 *     searching for a domain
 *   - the email is never returned, only used as a lookup key
 *   - results are capped, so a common name cannot page through the membership
 *   - the caller never appears in their own results
 */
create function public.search_users(query text)
returns setof public.user_search_result
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.display_name,
    c.status::text as connection_status
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.connections c
    on least(c.requester_id, c.addressee_id) = least(p.id, (select auth.uid()))
   and greatest(c.requester_id, c.addressee_id) = greatest(p.id, (select auth.uid()))
  where
    -- Signed in, and never matching yourself.
    (select auth.uid()) is not null
    and p.id <> (select auth.uid())
    -- Long enough to be a deliberate lookup rather than a fishing expedition.
    and length(trim(query)) >= 3
    and (
      p.display_name ilike '%' || trim(query) || '%'
      or lower(u.email) = lower(trim(query))
    )
  order by p.display_name
  limit 10;
$$;

comment on function public.search_users(text) is
  'Narrow User lookup by name or exact email. Deliberately not a directory: minimum query length, exact-email matching, capped results, and the email itself is never returned.';

grant execute on function public.search_users(text) to authenticated;

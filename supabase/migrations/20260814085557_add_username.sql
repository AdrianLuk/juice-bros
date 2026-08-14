-- A Username is the handle a User shares so friends can find them without
-- handing out an email address. Unlike the email — which search accepts as a
-- lookup key but never returns (ADR 0004) — a username is meant to be seen,
-- so it is safe in search results and is the discovery key the UI leads with.

alter table public.profiles
  add column username text;

-- Constrained because people read these off a phone screen and retype them,
-- and because they may end up in URLs.
alter table public.profiles
  add constraint username_format check (
    username is null or username ~ '^[a-z0-9_]{3,30}$'
  );

-- Case-insensitively unique: `AmyAce` and `amyace` are the same handle to a
-- human, so allowing both would make impersonation trivial. Usernames are
-- stored already lower-cased; the index enforces it even if that slips.
create unique index profiles_username_unique on public.profiles (lower(username));

/**
 * Turns a name or email local part into a candidate username.
 *
 * Strips everything the format constraint would reject rather than failing,
 * so an unusual name can never block a signup.
 */
create function public.slugify_username(source text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    substring(regexp_replace(lower(coalesce(source, '')), '[^a-z0-9_]', '', 'g') from 1 for 30),
    ''
  );
$$;

/**
 * A username nobody else holds, based on `source`.
 *
 * Appends a counter on collision rather than rejecting, because this runs
 * during signup where failing would strand the User with no account.
 */
create function public.unique_username(source text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text := public.slugify_username(source);
  candidate text;
  suffix int := 1;
begin
  -- Too short, or nothing usable left after stripping.
  if base is null or length(base) < 3 then
    base := 'player';
  end if;

  candidate := base;

  while exists (select 1 from public.profiles p where lower(p.username) = candidate) loop
    suffix := suffix + 1;
    -- Keep room for the suffix inside the 30 character limit.
    candidate := substring(base from 1 for 30 - length(suffix::text)) || suffix::text;
  end loop;

  return candidate;
end;
$$;

-- Backfill before the trigger starts depending on it.
update public.profiles p
set username = public.unique_username(coalesce(p.display_name, 'player'))
where p.username is null;

/**
 * Signup now also assigns a username.
 *
 * Derived automatically rather than asked for, because an extra required field
 * at signup is exactly the friction Booking Buddy is trying to avoid — and a
 * User who never opens settings still needs to be findable. They can change it
 * later.
 */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_name text;
begin
  chosen_name := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  )), '');

  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    chosen_name,
    -- Falls back to the email local part when no name was supplied, which is
    -- every magic-link signup.
    public.unique_username(coalesce(chosen_name, split_part(new.email, '@', 1)))
  );

  return new;
end;
$$;

-- The username is returned as well as matched on: two Users can share a
-- display name, and the handle is what tells them apart when deciding who to
-- send a request to. Safe to return, unlike the email.
drop function public.search_users(text);

alter type public.user_search_result add attribute username text;

-- Search gains the username as an exact-match key. Kept exact for the same
-- reason as email: a prefix search over handles would let someone walk the
-- membership. Name matching stays fuzzy because a name is not an identifier.
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
    c.status::text as connection_status,
    p.username
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.connections c
    on least(c.requester_id, c.addressee_id) = least(p.id, (select auth.uid()))
   and greatest(c.requester_id, c.addressee_id) = greatest(p.id, (select auth.uid()))
  where
    (select auth.uid()) is not null
    and p.id <> (select auth.uid())
    and length(trim(query)) >= 3
    and (
      p.display_name ilike '%' || trim(query) || '%'
      or lower(p.username) = lower(trim(query))
      -- Email stays a supported lookup key for anyone who would rather share
      -- an address than a handle. Exact match only, and never returned.
      or lower(u.email) = lower(trim(query))
    )
  order by p.display_name
  limit 10;
$$;

grant execute on function public.search_users(text) to authenticated;

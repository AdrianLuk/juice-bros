-- Personal invite link (issue #175). Every Booking Buddy connection until now
-- started from `search_users`, which only finds people who already have an
-- account — a cold start with zero friends on the app was a dead end. A
-- personal, shareable link (`/booking-buddy/join/<token>`) fixes that: the
-- link carries who sent it, and a first signup through it auto-creates a
-- pending friend request back to the owner (still mutual-accept — a link
-- never creates an accepted Connection silently).
--
-- One rotatable column, not an `invite_links` table: CONTEXT.md wants no
-- rotation history, just the ability to cut off a link shared too widely.

alter table public.profiles
  add column invite_token text;

-- Constrained because it lands in a URL and people paste it around. The
-- generator below emits 24 URL-safe base64 characters; the bound is loose
-- enough that a hand-rotated value isn't boxed in.
alter table public.profiles
  add constraint invite_token_format check (
    invite_token is null or invite_token ~ '^[A-Za-z0-9_-]{16,64}$'
  );

create unique index profiles_invite_token_unique
  on public.profiles (invite_token);

/**
 * A URL-safe, unguessable invite token — 18 bytes (144 bits) of entropy,
 * base64url so it drops into a path with no escaping. The token's own
 * unguessability is the whole protection on a join link, the same posture
 * `slot_links` already takes (see `generateSlotLinkToken`).
 */
create function public.generate_invite_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(
    encode(extensions.gen_random_bytes(18), 'base64'),
    '+/', '-_'
  );
$$;

/**
 * A token nobody else holds. `security definer` so the uniqueness check can
 * see every profile — an invoker-rights caller only sees their own row under
 * RLS and would never detect a collision. 144 bits makes a collision
 * essentially impossible; the loop is belt-and-suspenders, matching
 * `unique_username`'s own defensiveness.
 */
create function public.unique_invite_token()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  candidate text;
begin
  loop
    candidate := public.generate_invite_token();
    exit when not exists (
      select 1 from public.profiles where invite_token = candidate
    );
  end loop;
  return candidate;
end;
$$;

-- Backfill before the column goes NOT NULL and before the trigger starts
-- depending on it. One generation per row is fine for a table this size.
update public.profiles
set invite_token = public.unique_invite_token()
where invite_token is null;

alter table public.profiles
  alter column invite_token set not null;

/**
 * Signup now also assigns an invite token, the same "derived automatically,
 * never asked for" treatment `username` gets — a User who never opens the
 * Friends page still has a link a friend's request can be auto-created
 * against. The rest of the body is unchanged from
 * `20260825120000_username_fallback_prefers_email.sql`.
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

  insert into public.profiles (id, display_name, username, invite_token)
  values (
    new.id,
    chosen_name,
    public.unique_username(coalesce(chosen_name, split_part(new.email, '@', 1)), new.email),
    public.unique_invite_token()
  );

  return new;
end;
$$;

/**
 * Rotate the caller's own invite token, invalidating the old URL. Returns the
 * fresh token so the Friends page can show it back without a round trip.
 *
 * `security invoker`: the UPDATE runs as the caller and RLS ("profiles are
 * editable by their owner") is what scopes it to their row — a caller can
 * only ever rotate their own.
 */
create function public.rotate_invite_token()
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_token text := public.unique_invite_token();
begin
  update public.profiles
  set invite_token = new_token
  where id = (select auth.uid());

  if not found then
    raise exception 'no profile for the current user';
  end if;

  return new_token;
end;
$$;

grant execute on function public.rotate_invite_token() to authenticated;

/**
 * Resolve a join link's owner — name and handle only, for the "<Name> invited
 * you to Booking Buddy" landing an anonymous visitor sees.
 *
 * `security definer` and granted to `anon` because the visitor has no session
 * yet: this is the one thing about the owner a held token unlocks before
 * sign-in. Not a directory leak — the token is 144-bit and unguessable, and
 * nothing here is enumerable (exact-match on a unique column, one row).
 * Mirrors `search_users`' "narrow definer function, not a widened policy"
 * shape (ADR 0004).
 */
create function public.invite_link_owner(token text)
returns table (id uuid, display_name text, username text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.username
  from public.profiles p
  where p.invite_token = token
  limit 1;
$$;

comment on function public.invite_link_owner(text) is
  'Resolve a personal invite link''s owner (name + handle only) for the signed-out join landing. Exact-match on an unguessable token; deliberately not a directory.';

grant execute on function public.invite_link_owner(text) to anon, authenticated;

-- No RLS/grant changes on `profiles` itself: the existing owner-only
-- select/update policies already cover the new column, same as `gender` and
-- `funnel_signup_at` before it. The auto-created friend request goes through
-- the existing `connections` insert policy unchanged.

-- `unique_username`'s own fallback landed on the literal string "player"
-- whenever neither a display name nor the email-local-part `handle_new_user`
-- already tries as `source` slugified to anything usable (under 3 characters
-- after stripping) — a magic-link signup whose email happens to be short or
-- symbol-heavy, or an OAuth signup whose provided name doesn't survive
-- slugifying, could land on a Username as generic as "player3". Widened to
-- try the account email directly first, so a genuinely un-sluggable name
-- still has a real shot at a Username derived from something the User
-- actually recognizes as theirs — "player" is now the true last resort, for
-- when there's no usable email either.
--
-- Signature grows an `email` parameter, so the old one-argument version is
-- dropped explicitly first: `create or replace` with a different argument
-- list creates a second overload rather than replacing the original.

drop function public.unique_username(text);

create function public.unique_username(source text, email text default null)
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
  -- `source` didn't leave anything usable — try the account email before
  -- giving up on a real identifier. Redundant, not wrong, on a magic-link
  -- signup where `source` already *was* the email local part.
  if base is null or length(base) < 3 then
    base := public.slugify_username(split_part(coalesce(email, ''), '@', 1));
  end if;

  -- True last resort: no usable name, and no usable email either (or none
  -- at all).
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
    -- Falls back to the email local part when no name was supplied (every
    -- magic-link signup), then to the full email if even that doesn't slug
    -- into anything usable (see `unique_username`'s own comment above).
    public.unique_username(coalesce(chosen_name, split_part(new.email, '@', 1)), new.email)
  );

  return new;
end;
$$;

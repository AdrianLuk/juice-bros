-- A User's public-facing profile. `auth.users` holds the credentials; this
-- holds what other Users see. One row per User, created automatically on
-- signup so no application code has to remember to do it.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Public-facing profile for a User. Created automatically on signup by handle_new_user().';

alter table public.profiles enable row level security;

-- Coarse safety net only (ADR 0003): a User may read and edit their own
-- profile. Reading *other* Users'' profiles is gated on an accepted Connection,
-- which does not exist yet — that policy arrives with the Connections work
-- rather than being guessed at now.
create policy "profiles are readable by their owner"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles are editable by their owner"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Insert and delete are deliberately not granted: profiles are created by the
-- signup trigger and removed by the cascade from auth.users.

grant select, update on public.profiles to authenticated;

/**
 * Creates the profile whenever a User signs up.
 *
 * SECURITY DEFINER because the inserting role during signup is GoTrue's, which
 * has no rights on public.profiles. search_path is pinned so the elevated
 * function cannot be redirected to an attacker-controlled schema.
 */
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- Email/password signup can supply a name; magic-link and OAuth signups
    -- may supply nothing, so this is allowed to be null rather than blocking
    -- the signup.
    nullif(trim(coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )), '')
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

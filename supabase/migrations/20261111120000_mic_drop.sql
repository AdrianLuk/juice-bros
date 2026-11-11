-- Mic Drop: a live karaoke vote (spec #666; tickets #668 to #671).
--
--   mic_drop_hosts        accounts allowed to host. No policies and no grants:
--                         the one row is added by hand in the SQL editor, as
--                         with Team Tally's superadmin (the repo is public, so
--                         the email stays out of it):
--                           insert into public.mic_drop_hosts (user_id)
--                           select id from auth.users where email = '...';
--   mic_drop_polls        one night's vote, owned by the Host who made it,
--                         with the unguessable token behind its Guest Link
--   mic_drop_contestants  one entry on a Poll's list, in entry order
--   mic_drop_votes        a Guest's current pick: one row per (Poll, Guest
--                         id), so a changed Vote replaces the old one
--
-- Access (mic-drop/CONTEXT.md, Team Tally's token pattern):
--
--   * `anon` has no table access at all. A Guest reaches a Poll only through
--     the two SECURITY DEFINER functions keyed on the Guest Link token:
--     mic_drop_guest_poll (read) and mic_drop_cast_vote (write).
--   * A signed-in Host reads their own Polls and Contestants under RLS, and
--     writes only through the mic_drop_* Host functions, which check the
--     allowlist and ownership in the database.
--   * Votes are never readable as rows by anyone but the database itself:
--     the guest read returns counts, and the asking phone's own pick only.
--
-- Live updates: a trigger broadcasts a data-free "changed" message on the
-- public Realtime topic `mic-drop:<poll id>`, and clients re-read through the
-- guest read. Postgres Changes can't serve `anon` (same reason as Team Tally).

-- ---------------------------------------------------------------------------
-- Hosts
-- ---------------------------------------------------------------------------

create table public.mic_drop_hosts (
  user_id uuid primary key references auth.users (id) on delete cascade
);

comment on table public.mic_drop_hosts is
  'Mic Drop: accounts allowed to host Polls. No policies: only the SQL editor writes it, only mic_drop_is_host reads it.';

alter table public.mic_drop_hosts enable row level security;
revoke all on public.mic_drop_hosts from anon, authenticated;

/** True when the caller is on the Host allowlist. */
create function public.mic_drop_is_host()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mic_drop_hosts
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.mic_drop_is_host() from public, anon;
grant execute on function public.mic_drop_is_host() to authenticated;

-- ---------------------------------------------------------------------------
-- Polls, Contestants, Votes
-- ---------------------------------------------------------------------------

create table public.mic_drop_polls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 80),
  -- Bearer secret behind the Guest Link: 32 hex chars, ~122 bits.
  guest_token text not null unique
    default replace(gen_random_uuid()::text, '-', '')
    check (char_length(guest_token) between 24 and 128),
  -- Null while voting is open.
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create index mic_drop_polls_owner_created_idx
  on public.mic_drop_polls (owner_id, created_at desc);

comment on column public.mic_drop_polls.guest_token is
  'Bearer secret behind the Guest Link. Read by the owner to share it; anon reaches the Poll only through mic_drop_guest_poll and mic_drop_cast_vote.';

create table public.mic_drop_contestants (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.mic_drop_polls (id) on delete cascade,
  -- Whatever the Host typed. A duet is one Contestant.
  name text not null check (name = btrim(name) and char_length(name) between 1 and 80),
  -- Entry order. Gaps after a removal are fine.
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  constraint mic_drop_contestants_position_unique unique (poll_id, position),
  -- Target of the Votes' composite foreign key.
  constraint mic_drop_contestants_id_poll_unique unique (id, poll_id)
);

create table public.mic_drop_votes (
  poll_id uuid not null references public.mic_drop_polls (id) on delete cascade,
  -- A random id the Guest's browser made and kept: one phone.
  guest_id uuid not null,
  contestant_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (poll_id, guest_id),
  -- A Vote can only be for a Contestant in its own Poll, and removing the
  -- Contestant deletes their Votes.
  foreign key (contestant_id, poll_id)
    references public.mic_drop_contestants (id, poll_id) on delete cascade
);

create index mic_drop_votes_contestant_idx on public.mic_drop_votes (contestant_id, poll_id);

-- ---------------------------------------------------------------------------
-- Row Level Security and grants
-- ---------------------------------------------------------------------------

alter table public.mic_drop_polls enable row level security;
alter table public.mic_drop_contestants enable row level security;
alter table public.mic_drop_votes enable row level security;

create policy "Hosts read their own Polls"
  on public.mic_drop_polls for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "Hosts read their own Polls' Contestants"
  on public.mic_drop_contestants for select to authenticated
  using (exists (
    select 1 from public.mic_drop_polls p
    where p.id = poll_id and p.owner_id = (select auth.uid())
  ));

-- Supabase's default privileges hand every new public table to anon and
-- authenticated. Take them back: writes go through the functions below, and
-- Votes are only ever counted, never listed.
revoke all on public.mic_drop_polls, public.mic_drop_contestants, public.mic_drop_votes
  from anon, authenticated;
grant select on public.mic_drop_polls, public.mic_drop_contestants to authenticated;

-- ---------------------------------------------------------------------------
-- Host functions
-- ---------------------------------------------------------------------------

/**
 * The caller's own Poll, locked for the rest of the transaction, after
 * checking they are a Host. Internal: every Host write starts here, so the
 * allowlist and ownership checks live in one place. The row lock also makes
 * a Vote cast at the same moment (which takes a share lock) wait its turn.
 */
create function public.mic_drop_host_poll(p_poll_id uuid)
returns public.mic_drop_polls
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_poll public.mic_drop_polls;
begin
  if not public.mic_drop_is_host() then
    raise exception 'This account can''t host Mic Drop polls.' using errcode = '42501';
  end if;

  select * into v_poll
  from public.mic_drop_polls
  where id = p_poll_id and owner_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'That Poll doesn''t exist.' using errcode = 'P0002';
  end if;

  return v_poll;
end;
$$;

revoke all on function public.mic_drop_host_poll(uuid) from public, anon, authenticated;

/** A Poll or Contestant name, trimmed, or a readable refusal. Internal. */
create function public.mic_drop_clean_name(p_name text, p_what text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''), E' \t\r\n');
begin
  if char_length(v_name) = 0 then
    raise exception '% needs a name.', p_what using errcode = '22023';
  end if;
  if char_length(v_name) > 80 then
    raise exception '%''s name can be at most 80 characters.', p_what using errcode = '22023';
  end if;
  return v_name;
end;
$$;

revoke all on function public.mic_drop_clean_name(text, text) from public, anon, authenticated;

/** Creates an open Poll for the calling Host. Returns its id and Guest Link token. */
create function public.mic_drop_create_poll(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_poll public.mic_drop_polls;
begin
  if not public.mic_drop_is_host() then
    raise exception 'This account can''t host Mic Drop polls.' using errcode = '42501';
  end if;

  insert into public.mic_drop_polls (owner_id, name)
  values ((select auth.uid()), public.mic_drop_clean_name(p_name, 'A Poll'))
  returning * into v_poll;

  return jsonb_build_object('id', v_poll.id, 'guestToken', v_poll.guest_token);
end;
$$;

revoke all on function public.mic_drop_create_poll(text) from public, anon;
grant execute on function public.mic_drop_create_poll(text) to authenticated;

/**
 * Adds a Contestant to the end of the caller's open Poll. Returns its id.
 * A Poll holds at most 50 Contestants.
 */
create function public.mic_drop_add_contestant(p_poll_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_poll public.mic_drop_polls := public.mic_drop_host_poll(p_poll_id);
  v_name text := public.mic_drop_clean_name(p_name, 'A Contestant');
  v_id uuid;
begin
  if v_poll.closed_at is not null then
    raise exception 'This Poll is closed. Reopen it to change the line-up.' using errcode = '22023';
  end if;

  if (select count(*) from public.mic_drop_contestants where poll_id = v_poll.id) >= 50 then
    raise exception 'A Poll can have at most 50 Contestants.' using errcode = '22023';
  end if;

  insert into public.mic_drop_contestants (poll_id, name, position)
  values (
    v_poll.id,
    v_name,
    coalesce((select max(position) + 1 from public.mic_drop_contestants where poll_id = v_poll.id), 0)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.mic_drop_add_contestant(uuid, text) from public, anon;
grant execute on function public.mic_drop_add_contestant(uuid, text) to authenticated;

/**
 * Removes a Contestant from the caller's open Poll. Their Votes go with them,
 * which leaves those Guests with no Vote, free to pick again.
 */
create function public.mic_drop_remove_contestant(p_contestant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_poll_id uuid;
  v_poll public.mic_drop_polls;
begin
  if not public.mic_drop_is_host() then
    raise exception 'This account can''t host Mic Drop polls.' using errcode = '42501';
  end if;

  select poll_id into v_poll_id from public.mic_drop_contestants where id = p_contestant_id;
  if v_poll_id is null then
    raise exception 'That Contestant doesn''t exist.' using errcode = 'P0002';
  end if;

  v_poll := public.mic_drop_host_poll(v_poll_id);
  if v_poll.closed_at is not null then
    raise exception 'This Poll is closed. Reopen it to change the line-up.' using errcode = '22023';
  end if;

  delete from public.mic_drop_contestants where id = p_contestant_id;
end;
$$;

revoke all on function public.mic_drop_remove_contestant(uuid) from public, anon;
grant execute on function public.mic_drop_remove_contestant(uuid) to authenticated;

/** Closes (p_open false) or reopens (p_open true) the caller's Poll. Repeating either is harmless. */
create function public.mic_drop_set_open(p_poll_id uuid, p_open boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_poll public.mic_drop_polls := public.mic_drop_host_poll(p_poll_id);
begin
  update public.mic_drop_polls
  set closed_at = case when p_open then null else coalesce(v_poll.closed_at, now()) end
  where id = v_poll.id;
end;
$$;

revoke all on function public.mic_drop_set_open(uuid, boolean) from public, anon;
grant execute on function public.mic_drop_set_open(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Guest functions
-- ---------------------------------------------------------------------------

/**
 * A Guest id as a uuid, or null when it isn't one. Internal. PL/pgSQL so the
 * format check always runs before the cast: SQL doesn't promise to evaluate
 * `check and cast` in that order.
 */
create function public.mic_drop_guest_uuid(p_guest_id text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_guest_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return p_guest_id::uuid;
  end if;
  return null;
end;
$$;

revoke all on function public.mic_drop_guest_uuid(text) from public, anon, authenticated;

/**
 * The Poll behind a Guest Link token, as one JSON document, or null for any
 * token that isn't one:
 *
 *   id, name, open      the Poll (id names its Realtime topic)
 *   phonesIn            how many phones currently have a Vote
 *   contestants         [{id, name, votes}], most Votes first, entry order
 *                       breaking ties
 *   myVote              the asking phone's Contestant id, or null. A
 *                       malformed Guest id simply has no Vote.
 *   winnerIds           once closed: every Contestant tied on the top count,
 *                       in entry order. Empty while open or with no Votes.
 *
 * SECURITY DEFINER because the caller is `anon`. Never returns a Guest id,
 * another phone's Vote, the owner, or the token itself.
 */
create function public.mic_drop_guest_poll(p_token text, p_guest_id text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with poll as (
    select p.id, p.name, p.closed_at
    from public.mic_drop_polls p
    where char_length(btrim(coalesce(p_token, ''))) >= 24
      and p.guest_token = btrim(p_token)
  ),
  tallies as (
    select c.id, c.name, c.position, count(v.guest_id)::int as votes
    from public.mic_drop_contestants c
    join poll on poll.id = c.poll_id
    left join public.mic_drop_votes v on v.contestant_id = c.id and v.poll_id = c.poll_id
    group by c.id, c.name, c.position
  )
  select jsonb_build_object(
    'id', poll.id,
    'name', poll.name,
    'open', poll.closed_at is null,
    'phonesIn', (select count(*)::int from public.mic_drop_votes v where v.poll_id = poll.id),
    'contestants', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'votes', t.votes)
                       order by t.votes desc, t.position)
      from tallies t
    ), '[]'::jsonb),
    'myVote', (
      select v.contestant_id
      from public.mic_drop_votes v
      where v.poll_id = poll.id
        and v.guest_id = public.mic_drop_guest_uuid(p_guest_id)
    ),
    'winnerIds', case when poll.closed_at is null then '[]'::jsonb else coalesce((
      select jsonb_agg(t.id order by t.position)
      from tallies t
      where t.votes > 0 and t.votes = (select max(votes) from tallies)
    ), '[]'::jsonb) end
  )
  from poll;
$$;

comment on function public.mic_drop_guest_poll(text, text) is
  'The Poll behind a Guest Link token: name, open, phones in, Contestants with Vote counts highest first, the asking phone''s own Vote, and the winners once closed. Callable by anon; never returns a Guest id or another phone''s Vote.';

revoke all on function public.mic_drop_guest_poll(text, text) from public;
grant execute on function public.mic_drop_guest_poll(text, text) to anon, authenticated;

/**
 * Casts or changes a phone's Vote on the Poll behind a Guest Link token. Only
 * the latest pick counts. Refused, with a reason a Guest can read, when the
 * Poll is closed, the Contestant isn't in that Poll, or the Guest id isn't one.
 */
create function public.mic_drop_cast_vote(p_token text, p_guest_id text, p_contestant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_poll public.mic_drop_polls;
  v_guest_id uuid := public.mic_drop_guest_uuid(p_guest_id);
begin
  if v_guest_id is null then
    raise exception 'This phone''s Guest id isn''t valid. Reload the page and try again.' using errcode = '22023';
  end if;

  -- A share lock: a Host closing the Poll or removing a Contestant waits for
  -- this Vote, and this Vote waits for them.
  select * into v_poll
  from public.mic_drop_polls
  where char_length(btrim(coalesce(p_token, ''))) >= 24
    and guest_token = btrim(p_token)
  for share;

  if not found then
    raise exception 'There''s no such poll.' using errcode = 'P0002';
  end if;

  if v_poll.closed_at is not null then
    raise exception 'Voting is closed.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.mic_drop_contestants
    where id = p_contestant_id and poll_id = v_poll.id
  ) then
    raise exception 'That Contestant isn''t in this Poll.' using errcode = '22023';
  end if;

  insert into public.mic_drop_votes (poll_id, guest_id, contestant_id)
  values (v_poll.id, v_guest_id, p_contestant_id)
  on conflict (poll_id, guest_id)
  do update set contestant_id = excluded.contestant_id, updated_at = now();
end;
$$;

comment on function public.mic_drop_cast_vote(text, text, uuid) is
  'Casts or replaces one phone''s Vote on the Poll behind a Guest Link token. Callable by anon. Refuses a closed Poll, a Contestant from elsewhere and a malformed Guest id.';

revoke all on function public.mic_drop_cast_vote(text, text, uuid) from public;
grant execute on function public.mic_drop_cast_vote(text, text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Live updates
-- ---------------------------------------------------------------------------

/**
 * Broadcasts "changed", with no data, on the Poll's public topic. Whoever
 * holds the Guest Link re-reads through mic_drop_guest_poll, so the broadcast
 * leaks nothing but "something changed". SECURITY DEFINER so a Guest's Vote
 * can write realtime.messages.
 */
create function public.mic_drop_broadcast_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_poll_id uuid;
begin
  if tg_table_name = 'mic_drop_polls' then
    v_poll_id := new.id;
  elsif tg_op = 'DELETE' then
    v_poll_id := old.poll_id;
  else
    v_poll_id := new.poll_id;
  end if;

  perform realtime.send('{}'::jsonb, 'changed', 'mic-drop:' || v_poll_id, false);
  return null;
end;
$$;

revoke all on function public.mic_drop_broadcast_change() from public, anon, authenticated;

-- Votes are only deleted by a Contestant's removal, which broadcasts itself.
create trigger mic_drop_votes_broadcast
  after insert or update on public.mic_drop_votes
  for each row
  execute function public.mic_drop_broadcast_change();

create trigger mic_drop_contestants_broadcast
  after insert or delete on public.mic_drop_contestants
  for each row
  execute function public.mic_drop_broadcast_change();

create trigger mic_drop_polls_broadcast
  after update on public.mic_drop_polls
  for each row
  when (old.closed_at is distinct from new.closed_at or old.name is distinct from new.name)
  execute function public.mic_drop_broadcast_change();

-- Match Mixer: Live Mixers (spec #685, ADR 0006; this migration is #687).
--
--   match_mixer_live_mixers  one board committed at Go Live: its Config as the
--                            Share Link payload string (which pins
--                            GENERATOR_VERSION), the two unguessable tokens
--                            behind the Organizer Link and the Player Link, its
--                            Owner, and when it went live and finished
--   match_mixer_events       the append-only log above that Config (ADR 0001):
--                            empty until the scoring and late-arrival slices
--                            write to it
--
-- The Schedule is never stored. Every phone, and the server when it checks a
-- write, rebuilds it from the Config plus the player added and left events.
--
-- Access (Mic Drop's and Team Tally's token posture):
--
--   * Going live needs a signed-in organizer, who becomes the Owner (the beta
--     amendment to ADR 0006): no anonymous writes, and at most 20 Live
--     Mixers per Owner per day. Running and viewing a night need only a
--     link's token, no account.
--   * `anon` and `authenticated` have no table access at all. Going live and
--     reading a Live Mixer go through the SECURITY DEFINER functions below.
--   * The server validates the Config with the Share Link reader before it
--     calls match_mixer_go_live. The database only bounds its size: an
--     unreadable Config is a board nobody can open, not a leak.
--   * The Player Link token never reveals the Organizer Link token or the Owner.

-- ---------------------------------------------------------------------------
-- Live Mixers
-- ---------------------------------------------------------------------------

create table public.match_mixer_live_mixers (
  id uuid primary key default gen_random_uuid(),
  -- The Share Link payload, exactly as encodeSharePayload wrote it. A 64-name
  -- board of long names is under 3,000 characters.
  config text not null check (char_length(config) between 1 and 8000),
  -- Bearer secrets behind the two links: 32 hex chars, ~122 bits each.
  organizer_token text not null unique
    default replace(gen_random_uuid()::text, '-', '')
    check (char_length(organizer_token) between 24 and 128),
  player_token text not null unique
    default replace(gen_random_uuid()::text, '-', '')
    check (char_length(player_token) between 24 and 128),
  -- The organizer who went live. Deleting the account deletes their nights.
  owner_id uuid not null references auth.users (id) on delete cascade,
  went_live_at timestamptz not null default now(),
  -- Null while the night is running.
  finished_at timestamptz,
  constraint match_mixer_live_mixers_tokens_differ check (organizer_token <> player_token)
);

create index match_mixer_live_mixers_owner_idx
  on public.match_mixer_live_mixers (owner_id, went_live_at desc);

comment on column public.match_mixer_live_mixers.organizer_token is
  'Bearer secret behind the Organizer Link. Returned only to the browser that went live and to a holder of this same token.';
comment on column public.match_mixer_live_mixers.player_token is
  'Bearer secret behind the Player Link, the one pasted into the group chat.';

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create table public.match_mixer_events (
  -- Replay order.
  id bigint generated always as identity primary key,
  live_mixer_id uuid not null references public.match_mixer_live_mixers (id) on delete cascade,
  kind text not null check (kind in (
    'round_started',
    'score_entered',
    'score_cleared',
    'game_rule_changed',
    'player_added',
    'player_left',
    'finished'
  )),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create index match_mixer_events_live_mixer_idx
  on public.match_mixer_events (live_mixer_id, id);

/** Append-only: a correction is a new event, never an edited one. */
create function public.match_mixer_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Match Mixer events are append-only.' using errcode = '42501';
end;
$$;

revoke all on function public.match_mixer_events_append_only() from public, anon, authenticated;

create trigger match_mixer_events_no_update
  before update on public.match_mixer_events
  for each row
  execute function public.match_mixer_events_append_only();

-- ---------------------------------------------------------------------------
-- Row Level Security and grants
-- ---------------------------------------------------------------------------

alter table public.match_mixer_live_mixers enable row level security;
alter table public.match_mixer_events enable row level security;

-- Supabase's default privileges hand every new public table to anon and
-- authenticated. Take them back: everything goes through the functions below.
revoke all on public.match_mixer_live_mixers, public.match_mixer_events
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

/**
 * Commits a drawn board for the signed-in organizer, who becomes its Owner.
 * Returns both tokens; this is the only call that hands out the Organizer
 * Link token without being given it first. At most 20 per Owner per day.
 */
create function public.match_mixer_go_live(p_config text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mixer public.match_mixer_live_mixers;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to go live.' using errcode = '42501';
  end if;

  -- A real organizer takes a night or two live a day; this stops a script.
  if (
    select count(*) from public.match_mixer_live_mixers
    where owner_id = (select auth.uid()) and went_live_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'That''s 20 boards live in a day, the most one account can take. Try again tomorrow.'
      using errcode = '54000';
  end if;

  if char_length(coalesce(p_config, '')) not between 1 and 8000 then
    raise exception 'That board can''t go live.' using errcode = '22023';
  end if;

  insert into public.match_mixer_live_mixers (config, owner_id)
  values (p_config, (select auth.uid()))
  returning * into v_mixer;

  return jsonb_build_object(
    'organizerToken', v_mixer.organizer_token,
    'playerToken', v_mixer.player_token
  );
end;
$$;

revoke all on function public.match_mixer_go_live(text) from public, anon;
grant execute on function public.match_mixer_go_live(text) to authenticated;

/**
 * The Live Mixer behind either link's token, or null for any token that isn't
 * one:
 *
 *   role          'organizer' or 'player': which link the token is
 *   config        the Share Link payload
 *   playerToken   for the Organizer Link only, so it can show the Player Link
 *   wentLiveAt, finishedAt
 *
 * Never returns the Organizer Link token or the Owner.
 */
create function public.match_mixer_live_mixer(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'role', case when m.organizer_token = btrim(p_token) then 'organizer' else 'player' end,
    'config', m.config,
    'playerToken', case when m.organizer_token = btrim(p_token) then m.player_token end,
    'wentLiveAt', m.went_live_at,
    'finishedAt', m.finished_at
  )
  from public.match_mixer_live_mixers m
  where char_length(btrim(coalesce(p_token, ''))) >= 24
    and (m.organizer_token = btrim(p_token) or m.player_token = btrim(p_token));
$$;

comment on function public.match_mixer_live_mixer(text) is
  'The Live Mixer behind an Organizer Link or Player Link token: which link it is, the Config, and the Player Link token for the organizer only. Callable by anon.';

revoke all on function public.match_mixer_live_mixer(text) from public;
grant execute on function public.match_mixer_live_mixer(text) to anon, authenticated;

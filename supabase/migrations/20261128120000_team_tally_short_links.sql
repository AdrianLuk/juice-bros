-- Team Tally: short Public and Score Links for new Team Events.
--
-- The links were 32 hex characters. A Team Event saved from now on gets:
--   * Public Link: 5 characters. It only reads (32^5, about 33 million).
--   * Score Link: 10 characters per Team. It writes scores, so it stays out
--     of reach of guessing (32^10, about 10^15).
-- The alphabet leaves out 0, 1, l and o, which read alike. 32 symbols, so a
-- random byte mod 32 picks one with no bias.
-- Existing Team Events keep their long links: every captain already has
-- theirs. Both lengths open, so nothing is updated here.

/** A random token of `p_length` characters from the 32 that don't read alike. */
create function public.team_tally_short_token(p_length integer)
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('23456789abcdefghijkmnpqrstuvwxyz', 1 + get_byte(b.bytes, i) % 32, 1), '' order by i)
  from (select extensions.gen_random_bytes(p_length) as bytes) b,
       generate_series(0, p_length - 1) i;
$$;

-- Column defaults run as whoever inserts: an Organizer through
-- team_tally_save_event (security invoker).
revoke all on function public.team_tally_short_token(integer) from public, anon;
grant execute on function public.team_tally_short_token(integer) to authenticated;

-- shortcut: a 5-character Public Link collides about once in 8,000 Team
-- Events, and the unique constraint then refuses that save. Retry in the
-- insert if Team Events ever number in the thousands.
alter table public.team_tally_events
  drop constraint team_tally_events_public_token_check,
  alter column public_token set default public.team_tally_short_token(5),
  add constraint team_tally_events_public_token_check check (char_length(public_token) between 5 and 128);

alter table public.team_tally_teams
  drop constraint team_tally_teams_score_token_check,
  alter column score_token set default public.team_tally_short_token(10),
  add constraint team_tally_teams_score_token_check check (char_length(score_token) between 10 and 128);

comment on column public.team_tally_events.public_token is
  'Bearer secret behind the Public Link: 5 characters, or 32 hex on Team Events saved before short links. Read by the owner to print it in the Brief; anon reaches the Team Event only through team_tally_public_event.';

-- The two token lookups, as in #623 but opening a token of 5 characters or more.

create or replace function public.team_tally_public_event(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.team_tally_event_doc(e.id)
  from public.team_tally_events e
  where char_length(btrim(coalesce(p_token, ''))) >= 5
    and e.public_token = btrim(p_token);
$$;

create or replace function public.team_tally_team_for_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id
  from public.team_tally_teams t
  where char_length(btrim(coalesce(p_token, ''))) >= 5
    and t.score_token = btrim(p_token);
$$;

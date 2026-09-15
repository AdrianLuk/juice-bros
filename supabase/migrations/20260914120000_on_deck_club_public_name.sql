-- A Club's own name, on the one link it gives away (issue #510).
--
-- `/on-deck/c/<clubId>` is the only On Deck URL a Club hands out. It is what
-- the printed sign encodes, and it is what an Organizer pastes into their
-- group chat, so it is read by a Player with no account at all (ADR 0005).
-- While a Session is open the page redirects and the Session's own row carries
-- the venue name. When none is open there was nothing to render but our
-- product's name, because `on_deck_clubs` has exactly one RLS policy --
-- `auth.uid() = owner_id` -- and `anon` holds no grant on the table.
--
-- That posture is right and stays. A Club row carries an owner id and the
-- Club's operational defaults, and a Player has no business reading any of it.
-- But the Club's *name* is already the largest thing printed on a sheet taped
-- to a wall, so a function that returns that one column and nothing beside it
-- tells a scanner nothing the sign did not already tell them.
--
-- Deliberately narrower than the page could use. Venue name is on the sign too
-- (at 0.7em, under the code) and is not returned here, because the off-night
-- screen has no use for it and an exposed column is easier to add later than
-- to take back.

create function public.on_deck_club_name(p_club_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.name from public.on_deck_clubs c where c.id = p_club_id;
$$;

comment on function public.on_deck_club_name(uuid) is
  'One Club''s display name, by id, for anyone holding its link (issue #510).
   SECURITY DEFINER because `on_deck_clubs` is owner-only under RLS and a
   Player reads as `anon`. Returns null for an id that matches no Club, which
   the caller treats the same as any other unknown link rather than as a probe
   worth answering differently.';

revoke all on function public.on_deck_club_name(uuid) from public;
grant execute on function public.on_deck_club_name(uuid) to anon, authenticated;

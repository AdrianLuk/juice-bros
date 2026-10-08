-- Deleting an Organizer's account failed while their Club had an open Session
-- holding their own events.
--
-- `operator_user_id` was `on delete set null`, but
-- `on_deck_event_operator_user_id_matches_kind` requires every organizer event
-- to name an account. Postgres ran the set-null before the Club cascade
-- (auth.users -> on_deck_clubs -> on_deck_sessions -> events) reached the same
-- rows, the CHECK refused the null, and the whole delete rolled back.
--
-- Cascade instead. An organizer event is only ever written by the owner of the
-- event's Club (the append policy checks both), so these are exactly the rows
-- the Club cascade removes anyway; this just stops the two from colliding.

alter table public.on_deck_session_events
  drop constraint on_deck_session_events_operator_user_id_fkey,
  add constraint on_deck_session_events_operator_user_id_fkey
    foreign key (operator_user_id) references auth.users (id) on delete cascade;

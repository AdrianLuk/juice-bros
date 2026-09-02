-- On Deck: Realtime sync upgrade (issue #252, parent #238).
--
-- Every live surface already re-folds the same append-only event log on a
-- ~4s poll (issue #243). This ticket is an isolated swap of the *trigger*
-- mechanism: put `on_deck_session_events` on the `supabase_realtime`
-- publication so a client can subscribe to INSERTs and re-fetch within ~1s of
-- a "Court done" tap instead of waiting out a poll interval. Polling stays as
-- the automatic fallback when the socket drops.
--
-- No change to `reduceSession`, the event schema, or any RLS policy. Realtime
-- (Postgres Changes) enforces the *existing* SELECT policies on the table per
-- subscriber, so a client only ever receives events for a Session it can
-- already read — an open Session (readable by `anon`, ADR 0006) or one whose
-- Club the subscriber's account owns. The foundation migration
-- (20260831150000) already granted `select` on this table to `anon` and
-- `authenticated`; nothing further is needed for the channel to authorize.

-- Realtime replays the change payload from the WAL and, for a DELETE, matches
-- the channel's `session_id=eq` filter against the *old* row image — which
-- under the default REPLICA IDENTITY (primary key) carries only `id`, so the
-- filter can never match and Undo's delete would be dropped. FULL puts every
-- column in the old image so the subscriber sees `session_id` and the
-- re-fold-after-Undo notify lands. The log rows are tiny and append-only; the
-- extra WAL volume is negligible for one club's Session.
alter table public.on_deck_session_events replica identity full;

-- Add the table to the publication Realtime listens on. Guarded so a re-run
-- (or a project where the table is already published) is a no-op rather than a
-- "relation is already member of publication" error.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'on_deck_session_events'
  ) then
    alter publication supabase_realtime add table public.on_deck_session_events;
  end if;
end;
$$;

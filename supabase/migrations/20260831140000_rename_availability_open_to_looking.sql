-- Reframe the `open` Availability Window type as `looking` ("Looking to play").
--
-- `open` was nearly a no-op: "Find a time" only ever tests `!== 'busy'`, so an
-- `open` window and no window at all were treated identically. Renaming it to
-- `looking` gives it a job — an active "invite me to a game" signal, distinct
-- from both `busy` and "free but not soliciting" (which silence already covers).
-- The resolver precedence (ADR 0006) is unchanged; this is a rename only.
--
-- `ALTER TYPE ... RENAME VALUE` (PG10+) runs inside a transaction — unlike
-- `ADD VALUE`, which is why 20260815160000 had to stand alone. It relabels the
-- value in place: the enum OID and sort order are unchanged, so the column,
-- stored rows, indexes, RLS policies, and function bodies all keep working. Only
-- string literals comparing against 'open' had to change (app code + the pgTAP
-- fixtures in supabase/tests/availability_windows.test.sql, same PR).

alter type public.availability_type rename value 'open' to 'looking';

comment on type public.availability_type is
  'A User''s dated declaration: "looking" to play (an active invite-me signal) or "busy".';

comment on table public.availability_windows is
  'A User''s own dated looking-to-play / busy declaration, independent of Bookings. No uniqueness/overlap constraint — see ADR 0006. Visible to Connections at open_time-level Visibility.';

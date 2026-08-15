-- Adds `open_time` to `visibility_level` (#31): a Connection can now be
-- granted just the owner's Availability Windows without their Slots, not
-- only "nothing", "slots", or "slots + open time" (`calendar`). This turns
-- the level into a small lattice — `slots` and `open_time` are independent,
-- incomparable grants, and `calendar` is both together — rather than the
-- total order it used to be. See CONTEXT.md's Visibility entry and
-- visibility.ts for how the app resolves it now.
--
-- `ALTER TYPE ... ADD VALUE` cannot be used in the same transaction as a
-- statement that reads the new value, so this migration only adds it; the
-- functions and policies that check for it are the next migration.

alter type public.visibility_level add value 'open_time' after 'slots';

comment on type public.visibility_level is
  'How much of a User''s calendar/Slot data a Connection can see: none, slots, open_time (Availability Windows only), or calendar (slots + open_time). Not a total order — slots and open_time are independent grants; the app resolves multiple grants by union, not by picking a single "most permissive" rung.';

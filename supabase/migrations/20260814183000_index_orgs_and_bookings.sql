-- Two indexes the orgs/bookings migration should have carried and didn't.
--
-- A separate migration rather than an edit to that one because it has since
-- been pushed to the hosted project; the rewrite-in-place freedom that phase
-- used is spent.

-- Every read of `orgs` is "mine, newest first": the RLS policy filters on
-- owner_id and `listOrgs` orders by created_at. Neither of the existing indexes
-- can serve it — `orgs_unique_place_per_owner` and `orgs_unique_name_per_owner`
-- are both partial, so a row that isn't Place-backed is absent from the first
-- and a row that is, from the second. That left a sequential scan behind every
-- render of the places page and the booking form's picker.
create index orgs_owner_created_at on public.orgs (owner_id, created_at desc);

-- `bookings.org_id` is the referencing side of a `on delete cascade` foreign
-- key, and Postgres does not index those for you. Without it, removing one Org
-- scans every Booking in the table to find the rows to take with it.
create index bookings_org_id on public.bookings (org_id);

-- A Game shows its facility in the title once a court is booked
-- (`slot_bookings.org_name`, its own migration). Product now wants the same
-- for a still-bare proposal: a friend looking at "Tue, Sep 8 · 8–10 PM"
-- should be able to see which facility the organizer is planning to book,
-- not just that it's a proposal.
--
-- `slots.intended_org_id` already carries that hint, but it's a foreign key
-- to `orgs`, which is owner-only: a friend can read the `slots` row (via
-- `has_slot_visibility`) yet has nothing on their side to join the id
-- against. So this copies the resolved display name onto the Slot itself —
-- the exact "snapshot the text, not a foreign key" shape
-- `slot_bookings.org_name` uses for the booked-court case, and for the same
-- reason. `orgs` never has to open up.

alter table public.slots add column intended_org_name text;

-- Backfill whatever already has an intended org. Mirrors `orgDisplayName`
-- (src/lib/booking-buddy/orgs.ts) and the `slot_bookings.org_name` backfill:
-- the owner's own typed name first, the cached Place's name second, the same
-- fallback string third.
update public.slots s
set intended_org_name = coalesce(
  nullif(btrim(o.name), ''),
  nullif(btrim(pc.name), ''),
  'Facility details unavailable'
)
from public.orgs o
left join public.place_cache pc on pc.place_id = o.google_place_id
where o.id = s.intended_org_id;

comment on column public.slots.intended_org_name is
  'The intended facility (intended_org_id), resolved to display text at write time (mirrors orgDisplayName). Friend-visible, unlike orgs itself — it''s what puts the facility in a bare proposal''s title. Always null when intended_org_id is null; kept in step by assert_slot_intended_org_coherent.';

-- Re-derive the coherence trigger to also stamp the resolved name. Same
-- "one lookup does both jobs" shape `assert_slot_booking_coherent` took for
-- `slot_bookings.org_name`: the row it reads to prove same-owner is the same
-- row it reads the name off, so "no row" is exactly the ownership violation.
--
-- This fires on every insert and update of `slots`, including the
-- `intended_org_id` foreign key's own `on delete set null` — that arrives
-- here as an update with `new.intended_org_id` newly null, and the guard
-- below clears `intended_org_name` with it rather than leaving a dangling
-- snapshot. (Renaming an Org in place isn't a path the app has — Orgs are
-- created, never renamed — so, like `slot_bookings.org_name`, there's no
-- orgs-side re-sync trigger.)
create or replace function public.assert_slot_intended_org_coherent()
returns trigger
language plpgsql
as $$
declare
  resolved_org_name text;
begin
  if new.intended_org_id is null then
    new.intended_org_name := null;
    return new;
  end if;

  select coalesce(nullif(btrim(o.name), ''), nullif(btrim(pc.name), ''), 'Facility details unavailable')
    into resolved_org_name
    from public.orgs o
    left join public.place_cache pc on pc.place_id = o.google_place_id
    where o.id = new.intended_org_id and o.owner_id = new.owner_id;

  if resolved_org_name is null then
    raise exception 'a slot''s intended org must belong to the same owner'
      using errcode = 'check_violation';
  end if;

  new.intended_org_name := resolved_org_name;
  return new;
end;
$$;

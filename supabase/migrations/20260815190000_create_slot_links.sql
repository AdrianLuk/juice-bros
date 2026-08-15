-- Slot Link + Guest RSVP (issue #10, Phase 7). A Slot Link is a shareable
-- token letting anyone view and RSVP to one specific Slot without an account
-- or Connection (CONTEXT.md's Slot Link entry) — the low-friction path a
-- WhatsApp-poll invite needs, replacing it the same way a bare-proposal Slot
-- already replaces the poll itself for signed-in friends (#8).
--
-- A Guest never gets a Supabase session, so there is no `auth.uid()` to gate
-- an RLS policy on. Rather than inventing an `anon`-role policy driven by a
-- token read out of a header or claim (which would make `slot_links` a
-- publicly-callable surface an attacker could hammer directly against
-- Postgres, bypassing whatever per-request logging/throttling the app wants
-- to do), the Guest path stays entirely server-side: every table a Guest's
-- Server Action touches is granted to `service_role` (ADR 0003's existing
-- precedent — `place_cache` is the first table this pattern used) and to
-- nobody else new. A Guest never talks to Postgres except through those
-- actions, which do the token check themselves before reading or writing
-- anything.

create table public.slot_links (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.slots (id) on delete cascade,
  -- Crypto-random, unguessable (Q7/CLAUDE.md: the token's own unguessability
  -- is the primary protection — no CAPTCHA, no hard rate limit in v1).
  token text not null unique,
  created_at timestamptz not null default now(),

  -- CONTEXT.md speaks of "its Slot Link", singular — one per Slot.
  -- `generateSlotLink` reuses the existing row rather than minting a second.
  constraint slot_links_one_per_slot unique (slot_id)
);

comment on table public.slot_links is
  'A shareable, unguessable token granting Guest access to exactly one Slot (CONTEXT.md). One per Slot.';

alter table public.slot_links enable row level security;

create policy "a Slot owner manages their own slot links"
  on public.slot_links for all
  to authenticated
  using (
    exists (
      select 1 from public.slots s
      where s.id = slot_id and s.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.slots s
      where s.id = slot_id and s.owner_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.slot_links to authenticated;

-- The Guest RSVP abuse-detection audit trail (Q7, issue #10's acceptance
-- criteria): every Guest RSVP is logged with IP, user agent and timestamp,
-- and flagged — not blocked — once it's past a soft per-link threshold.
-- `service_role`-only by design: there is no UI reading this yet, and no
-- User, including the Slot's own owner, has a legitimate reason to read
-- another Guest's IP through the API today.
create table public.guest_rsvp_log (
  id uuid primary key default gen_random_uuid(),
  slot_link_id uuid not null references public.slot_links (id) on delete cascade,
  guest_name text not null,
  ip inet,
  user_agent text,
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.guest_rsvp_log is
  'Abuse-detection audit trail for Guest RSVPs via a Slot Link (issue #10, Q7). service_role-only; nothing here is read through the app today.';

-- What `guestRespondViaLink` counts against the soft threshold: prior
-- attempts on this same link, from this same IP.
create index guest_rsvp_log_link_ip on public.guest_rsvp_log (slot_link_id, ip);

alter table public.guest_rsvp_log enable row level security;

-- No policies for `authenticated`/`anon` — default-deny, the same posture
-- Automatic RLS already gives a brand-new table with zero policies (see
-- PROGRESS.md's "Hosted environment" note). Only `service_role`, which
-- bypasses RLS, can reach this table at all, and only once granted below.
grant select, insert on public.guest_rsvp_log to service_role;

-- Guest reads and writes run through the admin client (service_role), the
-- same pattern `place_cache` established. Automatic table exposure is off
-- project-wide, so each table the Guest path touches needs its own explicit
-- grant — RLS bypass and API grants are independent checks.
grant select on public.slots to service_role;
grant select on public.slot_bookings to service_role;
grant select, insert on public.responses to service_role;
grant select on public.slot_links to service_role;
-- So a Guest's preview page can show who proposed the Slot and who (as a
-- User) has already responded to it, by display name.
grant select on public.profiles to service_role;

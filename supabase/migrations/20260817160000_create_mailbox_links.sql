-- Mailbox Link (issue #62, CONTEXT.md's Mailbox Link entry) — a User's own
-- OAuth grant to their own Gmail inbox, used only by the email-sync feature
-- (ADR-0009) to search for CourtReserve confirmation/cancellation mail on
-- request. Not tied to any single Org, and not a Supabase Auth session:
-- connecting Gmail never changes who the User is signed in as.
--
-- One per User, so `owner_id` is the primary key rather than a separate
-- `id` + unique index — the same shape `notification_preferences` already
-- uses. Reconnecting (including after Google's 7-day Testing-mode refresh
-- token expiry — ADR-0009) is an upsert onto this key, not a second row.

create table public.mailbox_links (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  google_account_email text not null,
  -- AES-256-GCM ciphertext ("iv.authTag.ciphertext", base64 each part) —
  -- see token-encryption.ts. Never the raw refresh token, and never selected
  -- into anything a client component reads; the app's own code always
  -- column-picks rather than `select("*")`, the same discipline
  -- SUPABASE_SERVICE_ROLE_KEY already gets.
  encrypted_refresh_token text not null,
  status text not null default 'active' check (status in ('active', 'expired')),
  connected_at timestamptz not null default now()
);

comment on table public.mailbox_links is
  'One Gmail OAuth grant per User (issue #62 / ADR-0009). refresh_token is encrypted at rest — see token-encryption.ts.';

alter table public.mailbox_links enable row level security;

create policy "a User manages only their own Mailbox Link"
  on public.mailbox_links for all
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.mailbox_links to authenticated;

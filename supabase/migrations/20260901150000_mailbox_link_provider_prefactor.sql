-- Mailbox Link provider prefactor (issue #281, spec #280) — a pure schema
-- prefactor with no behaviour change. Generalises the Mailbox Link storage and
-- every Gmail-specific name so a second provider (Microsoft, #280) can be added
-- without touching these things again. Existing rows all belong to Google, so
-- every new column backfills to 'google' and then drops its default so future
-- inserts must name the provider explicitly.

-- mailbox_links: one grant per User, still keyed on owner_id. The account-email
-- column loses its Google-specific name, and a provider column records which
-- identity platform the grant is against.
alter table public.mailbox_links
  rename column google_account_email to account_email;

alter table public.mailbox_links
  add column provider text not null default 'google'
    check (provider in ('google', 'microsoft'));

-- Backfill is done (the default filled every existing row); make future inserts
-- state the provider rather than silently inheriting 'google'.
alter table public.mailbox_links
  alter column provider drop default;

comment on table public.mailbox_links is
  'One mailbox OAuth grant per User (issue #62 / ADR-0009, #280). provider names the identity platform; refresh_token is encrypted at rest — see token-encryption.ts.';

-- The processed-messages table drops "gmail" from its own name, its message-id
-- column, and its policy, and gains the same provider column. Opaque provider
-- message ids can collide across providers, so uniqueness becomes
-- (owner, provider, message id).
alter table public.processed_gmail_messages
  rename to processed_messages;

alter table public.processed_messages
  rename column gmail_message_id to provider_message_id;

alter index public.processed_gmail_messages_owner_id
  rename to processed_messages_owner_id;

-- The auto-generated constraint names carry the old table name too — rename
-- them so a reader (and #280's later slices) sees a table named consistently
-- rather than half-and-half.
alter table public.processed_messages
  rename constraint processed_gmail_messages_pkey to processed_messages_pkey;

alter table public.processed_messages
  rename constraint processed_gmail_messages_owner_id_fkey to processed_messages_owner_id_fkey;

alter table public.processed_messages
  rename constraint processed_gmail_messages_outcome_check to processed_messages_outcome_check;

alter table public.processed_messages
  add column provider text not null default 'google'
    check (provider in ('google', 'microsoft'));

alter table public.processed_messages
  alter column provider drop default;

alter table public.processed_messages
  drop constraint processed_gmail_messages_unique_message;

alter table public.processed_messages
  add constraint processed_messages_unique_message
    unique (owner_id, provider, provider_message_id);

alter policy "a User sees only their own processed Gmail messages"
  on public.processed_messages
  rename to "a User sees only their own processed messages";

comment on table public.processed_messages is
  'A confirmed, dismissed, cancelled or updated CourtReserve email (issue #64 / #65 / #91), so a later sync never re-shows it. provider + provider_message_id together are the opaque id.';

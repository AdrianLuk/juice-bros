---
Status: accepted
---

# Email sync from an Outlook / Hotmail inbox via Microsoft OAuth

Extends [ADR-0009](0009-email-sync-via-gmail-oauth.md) — it does not supersede
it. ADR-0009's design stands unchanged: "Sync from Email" reads the User's own
inbox on demand for CourtReserve confirmation/cancellation/update mail from
`notifications@courtreserve.com`, matches become Import Candidates on a review
screen, nothing becomes (or removes) a Booking without confirmation. This ADR
records the choices specific to adding Microsoft personal accounts
(outlook.com, hotmail.com, live.com, msn.com) as a second Mailbox Link
provider alongside Gmail, behind the `MailAdapter` seam from
[#282](../../PROGRESS.md).

**Why**: the first friends on the feature use Outlook/Hotmail, not Gmail. The
provider seam already existed; what was missing was the Graph transport, the
Azure app registration, and the decision record for a reviewer to check the
OAuth choices against.

**Decisions**:

- **`consumers` authority, not `common` or `organizations`.** The app registers
  against `https://login.microsoftonline.com/consumers`, which only personal
  Microsoft accounts can consent through. Work/school (Entra ID) accounts are
  out of scope — they bring conditional-access and admin-consent surface this
  hobby app has no reason to take on, and CourtReserve mail lands in personal
  inboxes.
- **Read-only scope: `Mail.Read` + `offline_access` + `openid email`.** The
  direct counterpart of Gmail's `gmail.readonly`. `Mail.Read` is the narrowest
  Graph scope that still allows `GET /me/messages`; there is no "one sender
  only" Graph permission, same limitation ADR-0009 notes for Gmail.
  `offline_access` for the refresh token the unattended sync needs; `openid
  email` so the connected address comes back in the `id_token` and the callback
  route needs no extra Graph `/me` call.
- **Refresh-token rotation is handled, not avoided.** Microsoft returns a new
  refresh token on every exchange and expires the old one; the shared
  token-lifecycle helper (`mailbox-token-lifecycle.ts`) persists the rotated
  token each sync. Google never rotates, so this path is Microsoft-only but
  lives in the one shared helper.
- **No app-side allowlist for Microsoft.** ADR-0009's addendum added an
  `EMAIL_SYNC_ALLOWLIST` because Google's Testing-mode test-user list caps the
  app at 100 users, expires refresh tokens weekly, and isn't queryable at
  runtime. Microsoft's consumer platform has no equivalent cap or Testing
  mode, so an Outlook Mailbox Link is gated only on `MICROSOFT_OAUTH_CLIENT_ID`
  being configured (which is what renders the "Connect Outlook" button). The
  allowlist stays **Gmail-only** — `isGmailConnectAllowed` is not consulted for
  a Microsoft link, in the Settings UI, the connect action, the callback
  re-check, or the sync/confirm actions.
- **A Graph `429` is a transient `unreachable` with no automatic retry.** The
  adapter's search/fetch return the interface's `unreachable` outcome on any
  non-`ok` response including `429`; the User's retry is the "Sync from Email"
  button. A hobby-app inbox with one sender and a 90-day floor is nowhere near
  Graph's throttling limits, so a retry/backoff layer would be dead weight.
- **`$filter` + `@odata.nextLink` pagination, capped at ~5 pages.** The Graph
  search filters on the CourtReserve sender address and a received-after date,
  selects ids only, newest first, and follows `@odata.nextLink` up to a small
  fixed cap — the cap only exists so a Graph bug can't spin the loop forever.

**Consequences**: Azure caps a confidential client's secret lifetime at ~24
months, so rotating `MICROSOFT_OAUTH_CLIENT_SECRET` is a recurring operational
task (unlike the Gmail client secret, which doesn't expire) — tracked in
[microsoft-oauth-setup.md](../microsoft-oauth-setup.md). Publisher verification
is optional; until it's done the consent screen shows an unverified-app notice,
same posture as Gmail's Testing-mode warning. Preview deployments have the same
per-deployment redirect-URI awkwardness Gmail does — see the runbook.

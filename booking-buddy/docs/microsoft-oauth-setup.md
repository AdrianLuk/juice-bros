# Setting up Microsoft OAuth for email sync (Outlook / Hotmail)

Operational steps for the human-only setup behind spec #280's Outlook provider
— the Microsoft counterpart of [gmail-oauth-setup.md](gmail-oauth-setup.md).
See [adr/0018-email-sync-microsoft-provider.md](adr/0018-email-sync-microsoft-provider.md)
for why the choices below are what they are. Until this is done, the "Connect
Outlook" button simply doesn't render (`MICROSOFT_OAUTH_CLIENT_ID` unset) — the
feature is invisible, not broken.

## 1. Register the app

Azure portal → **Microsoft Entra ID → App registrations → New registration**.

1. **Name**: `Booking Buddy — email sync` (User-visible on the consent screen).
2. **Supported account types**: *Personal Microsoft accounts only*. This is the
   `consumers` authority — outlook.com, hotmail.com, live.com, msn.com. Do
   **not** pick "any organizational directory" — work/school accounts are out
   of scope (ADR-0018).
3. **Redirect URI**: platform *Web*, value
   `<your-origin>/booking-buddy/settings/mailbox-callback` — the **same** path
   Google registers. See §3 for which origins.
4. Register.

## 2. API permissions and client secret

**API permissions** → Add a permission → Microsoft Graph → *Delegated*:

| Permission | Why |
| --- | --- |
| `Mail.Read` | `GET /me/messages` — the mailbox read. Narrowest scope that allows it. |
| `offline_access` | The refresh token the unattended sync needs. |
| `openid`, `email` | The connected address comes back in the `id_token`; no extra Graph `/me` call. |

No admin consent needed for a `consumers` app — the User consents at connect
time.

**Certificates & secrets** → New client secret. **Azure caps the lifetime at
~24 months.** Record the expiry date somewhere you'll see it — when it lapses,
every sync fails with a reconnect prompt until a new secret is set. Rotating it
is a recurring task, unlike the Gmail client secret (which doesn't expire).
Copy the secret **value** (not the ID) immediately — it's shown once.

## 3. Env vars

| Var | Notes |
| --- | --- |
| `MICROSOFT_OAUTH_CLIENT_ID` | The Application (client) ID from the registration overview. Setting this is what renders "Connect Outlook". |
| `MICROSOFT_OAUTH_CLIENT_SECRET` | The secret **value** from §2. Server-only, never `NEXT_PUBLIC_*`. Renew every ~24 months. |

`MAILBOX_LINK_ENCRYPTION_KEY` and the rest are shared with the Gmail path — see
gmail-oauth-setup.md. There is **no** `EMAIL_SYNC_ALLOWLIST` entry needed for
Outlook (ADR-0018 — Microsoft has no Testing-mode cap).

Set these on Vercel for whichever environments need the real flow (production
at minimum).

## 4. Redirect URIs, and Vercel previews

Same exact-string-match constraint Google has, and the same per-deployment
preview-URL awkwardness (see gmail-oauth-setup.md §3 for the full explanation).
In short:

- **Production**: register
  `https://<production-domain>/booking-buddy/settings/mailbox-callback` once.
- **Preview**: either register the stable per-branch alias
  (`https://juice-bros-git-<branch>-<team>.vercel.app/booking-buddy/settings/mailbox-callback`)
  per branch you want to exercise real OAuth on, or don't test real Microsoft
  OAuth on preview at all — the e2e suite hits a fully mocked Graph/identity
  host (`MICROSOFT_API_BASE_URL` → `e2e/support/microsoft-mock.ts`), never real
  Microsoft. An app registration can hold multiple redirect URIs, so a
  throwaway per-deployment URL can be added, tested, and removed ad hoc.

## 5. Publisher verification (optional)

Until the Azure app's publisher is verified, the consent screen shows an
"unverified" notice. That's expected — the in-app "you'll see an unverified-app
screen" note tells the User to review the permissions and choose Accept. Doing
publisher verification later removes the notice; it isn't a blocker.

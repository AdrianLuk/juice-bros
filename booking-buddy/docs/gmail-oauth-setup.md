# Setting up Gmail OAuth for email sync

Operational steps for the human-only setup #62 left pending (see
[PROGRESS.md](../PROGRESS.md) and
[adr/0009-email-sync-via-gmail-oauth.md](adr/0009-email-sync-via-gmail-oauth.md)
for why this exists). None of this is set yet as of the #62 merge — until it
is, "Sync from Email" stays invisible in production (nobody is in
`EMAIL_SYNC_ALLOWLIST`), not broken.

## 1. Create a new OAuth client — same GCP project, separate client

Reuse the Google Cloud project Supabase's own "Sign in with Google" provider
is already on, but create a **new, separate OAuth 2.0 Client ID** inside it —
don't reuse the sign-in client. Two reasons this is deliberate:

- **Different grant, different lifecycle.** A Mailbox Link is a standalone
  OAuth grant the app manages (stored, encrypted, disconnectable
  independently) — it isn't tied to a Supabase Auth session. Mixing it into
  the sign-in client would couple two things that need to be
  revoked/rotated independently.
- **Different scope.** Gmail sync needs `gmail.readonly`, one of Google's
  *Restricted Scopes*, which carries its own verification posture. The
  sign-in client never requests it and shouldn't — bundling it in would put
  the sign-in client through Restricted Scope review for no reason and widen
  what a compromised sign-in client could do.

Steps in Cloud Console (same project as the sign-in client):

1. **Credentials → Create Credentials → OAuth Client ID → Web application.**
2. Add the redirect URI(s) — see §3 below for which ones.
3. Leave the consent screen in **Testing** mode per ADR-0009 (refresh tokens
   expire every 7 days in Testing mode; full verification was rejected as
   disproportionate for a friends-only hobby app).
4. Add each approved user as a **Cloud Console test user** — separate from
   `EMAIL_SYNC_ALLOWLIST` (§2). Being on one list doesn't put you on the
   other; both are hand-maintained.

## 2. Set env vars

Four vars, documented inline in `.env.example`:

| Var | Notes |
| --- | --- |
| `GOOGLE_OAUTH_CLIENT_ID` | From the new client above. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Server-only, never exposed to the browser. |
| `MAILBOX_LINK_ENCRYPTION_KEY` | Encrypts `mailbox_links.encrypted_refresh_token` at rest. Generate one per environment: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Treat as sensitively as `SUPABASE_SERVICE_ROLE_KEY`. |
| `EMAIL_SYNC_ALLOWLIST` | Comma-separated Usernames. Blank/unset means nobody is allowed — fails closed, not open. |

Set these on Vercel for whichever environments need the real flow
(production at minimum — see §3 for why preview is optional).

## 3. Authorized redirect URIs, and why Vercel previews are awkward

Google's "Authorized redirect URIs" require an **exact string match** — no
wildcards for subdomains or paths. The app computes its own redirect URI at
request time from whatever `Host` header the request arrived on
(`absoluteAppUrl` in `src/lib/booking-buddy/request-origin.ts`), so it sends
Google a different `redirect_uri` for every distinct domain that hits it —
including Vercel's per-deployment preview URL, which has a random hash and
changes on every push (e.g.
`https://juice-bros-m78sstibf-lukabaseballs-projects.vercel.app`). Those
can't be pre-registered one by one.

Two practical options:

**Option A — register the stable per-branch alias, not the per-deployment one.**
Vercel also assigns a fixed alias per branch that doesn't change between
pushes:

```
https://juice-bros-git-<branch-name>-lukabaseballs-projects.vercel.app
```

(Find it in the Vercel dashboard → the project → a deployment → its
"Domains" section, alongside the random per-deployment one.) Register:

```
https://juice-bros-git-<branch-name>-lukabaseballs-projects.vercel.app/booking-buddy/settings/mailbox-callback
```

once in Cloud Console, and every future push to that branch keeps working
without touching Google again. Do this per branch you actually want to
exercise real Gmail OAuth on.

**Option B — don't test real Google OAuth on preview at all.**
This is what #62 already assumes: the e2e suite hits a fully mocked OAuth
flow (`GMAIL_API_BASE_URL` → `e2e/support/gmail-mock.ts`), never real
Google, so preview deploys don't need real credentials to pass CI. The PR's
own notes only flag the real credentials as needed "before this ships to
**production**." If that's sufficient, skip preview registration entirely
and only register the production redirect URI:

```
https://<production-domain>/booking-buddy/settings/mailbox-callback
```

**Ad hoc exception:** to manually click through the real Google consent
screen on one specific preview deployment, temporarily add that exact
per-deployment URL to Cloud Console, test, then remove it — a client can
hold multiple redirect URIs at once, so this doesn't conflict with anything
else registered.

## 4. Push the DB migration to the hosted project

`supabase db push` — `mailbox_links` has only been applied locally
(`supabase migration up --local`) as of the #62 merge.

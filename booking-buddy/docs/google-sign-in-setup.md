# Setting up Google Identity Services for sign-in

Human-only Cloud Console + Supabase Dashboard steps for "Continue with Google" — see
[adr/0013-google-sign-in-via-identity-services.md](adr/0013-google-sign-in-via-identity-services.md)
for why this replaced the old `signInWithOAuth` redirect flow. Until these are done in
a given environment, the button simply doesn't render (`NEXT_PUBLIC_GOOGLE_SIGN_IN_CLIENT_ID`
unset) — magic link and password sign-in are unaffected.

## 1. Find the existing sign-in OAuth client

Supabase Dashboard → **Authentication → Providers → Google** shows a **Client IDs**
field (comma-separated — Supabase's current dashboard uses one field for "Web, OAuth,
Android apps, One Tap, and Chrome extensions" rather than separate ones per flow)
already holding the ID wired up for the (now-unused) redirect flow. Reuse it — per
ADR-0013, GSI sign-in is the same grant as the old redirect flow, just a different
transport, so there's no reason to provision a second client the way the Gmail-sync one
(`gmail-oauth-setup.md`) deliberately was. Confirm the value matches "Booking Buddy
Web" in Cloud Console, not "Booking Buddy Mail Link" (the separate Gmail-sync client).

## 2. Add Authorized JavaScript origins (Cloud Console)

Same Google Cloud project as the Gmail-sync client. **Credentials → (the sign-in
client) → Authorized JavaScript origins.** Exact origin match, no wildcards, no path:

- `http://localhost:3000` — for local dev (Google allows plain `http://localhost`
  as an exception to the usual HTTPS-only rule).
- `https://<production-domain>`.
- Optionally, a stable per-branch Vercel alias
  (`https://juice-bros-git-<branch-name>-lukabaseballs-projects.vercel.app`) to
  exercise the real button on a preview deploy — same tradeoff `gmail-oauth-setup.md`
  §3 documents (the per-*deployment* URL has a random hash and changes every push;
  the per-*branch* one is stable). Skipping preview entirely and only testing
  locally/production is also fine — nothing here is mockable in e2e either way.

Leaving the client's old **Authorized redirect URI** (the `supabase.co` callback)
registered is harmless — it's just unused now. Removing it is optional cleanup, not
required.

## 3. Supabase Dashboard — nothing to change

Because this reuses the same Client ID that's already in the **Client IDs** field from
step 1, and that field already covers "Web, OAuth, ... One Tap" together,
`supabase.auth.signInWithIdToken` already accepts tokens from this client. No dashboard
edit needed here — only relevant if a *different* client were used, in which case its
ID would need adding to that same comma-separated field.

## 4. Set the env var

One var, documented inline in `.env.example`:

| Var | Notes |
| --- | --- |
| `NEXT_PUBLIC_GOOGLE_SIGN_IN_CLIENT_ID` | The same Client ID from step 1. Public by design — only the Client Secret is sensitive, and this flow never uses one. |

Set on Vercel for whichever environments should show the Google button (production at
minimum). Locally, add it to `.env`.

## Not needed

- No new GCP OAuth client, no Client Secret, no redirect URI change.
- No `supabase/config.toml` change — Google auth config stays Dashboard-only (see
  `PROGRESS.md`'s note on why that file carries no `[auth.external.google]` section).
- **No consent-screen publishing or Google verification.** This flow is Identity
  Services (`signInWithIdToken`) — OpenID Connect authentication only, no scope
  request, so it never touches the OAuth consent screen. It works for any Google
  account regardless of whether the Cloud Console screen is in Testing or In
  production, and there's no "test users" list to maintain and no "unverified app"
  interstitial. (That machinery only matters for the separate Gmail-sync client —
  `gmail-oauth-setup.md`.)

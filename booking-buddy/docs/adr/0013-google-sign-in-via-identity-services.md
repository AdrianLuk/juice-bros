# ADR-0013: Google sign-in via Identity Services, not `signInWithOAuth`

## Status

Accepted.

## Context

"Continue with Google" used `supabase.auth.signInWithOAuth`, which redirects the
browser through Supabase's own `.../auth/v1/authorize` endpoint before Google is ever
reached. Google's account chooser therefore showed "to continue to
`<project-ref>.supabase.co`" — the raw Supabase project URL — rather than this app's
own domain. Two ways to fix that:

1. **Supabase Custom Domain** — put the Auth service behind `auth.juicebrospickleball.com`.
   Requires the Pro plan plus a paid custom-domain add-on, for a purely cosmetic fix.
2. **Google Identity Services (GSI), client-side** — run the OAuth exchange entirely on
   this app's own origin and hand Supabase the resulting ID token via
   `signInWithIdToken` instead of a code exchange. Free, more moving parts.

We chose (2): no new recurring cost, and it's the pattern most production apps already
use rather than a full-page OAuth redirect through the auth provider's own domain.

## Decision

- **Google Identity Services renders the button**, loaded via a plain `<script
  src="https://accounts.google.com/gsi/client">` (`next/script`, no new npm
  dependency) in `google-sign-in-button.tsx`. `google.accounts.id.renderButton` draws
  the button — Google's branding guidelines require its own chrome here, so this one
  control no longer matches the shadcn `Button` used everywhere else on the sign-in
  form. Accepted tradeoff, not an oversight.
- **No One Tap / automatic prompt.** Only the explicit rendered button. One Tap adds
  FedCM/cooldown/dismissal edge cases for a feature (frictionless silent sign-in) this
  app doesn't need yet — magic link and password are already one click away.
- **A nonce, hashed before it reaches Google.** The button generates a random nonce,
  SHA-256-hashes it (Web Crypto, `crypto.subtle.digest`), and passes the *hash* to
  `google.accounts.id.initialize`. The ID token Google returns carries that hash in its
  `nonce` claim. The *raw* nonce is what gets sent on to
  `signInWithGoogleIdToken` → `supabase.auth.signInWithIdToken`, which hashes it again
  itself to compare. Without this, a stolen ID token could be replayed to mint a
  session; the nonce ties one token to the one sign-in attempt that requested it.
- **The existing GCP OAuth client is reused**, not split into a new one the way
  ADR-0009 deliberately split the Gmail-sync client from the sign-in client. That split
  was about a *different grant* (a standalone, revocable Mailbox Link) needing a
  *different scope* (`gmail.readonly`, a Restricted Scope with its own verification
  posture). GSI sign-in and the old redirect flow are the same grant — authenticating a
  Booking Buddy user via Google — just a different transport. Reusing the client means
  only one Cloud Console edit (add this app's origins to **Authorized JavaScript
  origins**) is needed — see `google-sign-in-setup.md`. No Supabase Dashboard change:
  its Google provider has a single **Client IDs** field covering "Web, OAuth, ... One
  Tap" together, and the reused client's ID is already in it from the old flow.
- **The Client ID is public** (`NEXT_PUBLIC_GOOGLE_SIGN_IN_CLIENT_ID`). OAuth Client IDs
  aren't secrets — only the Client Secret is, and this flow never uses one. This is a
  deliberate departure from the boundary `env.ts` drew before this ADR ("the
  [Supabase-held] client id never reaches this repo's env at all") — GSI has to run in
  the browser, so the Client ID has to become part of the bundle.
- **Reading the Client ID never fails the page.** `readGoogleSignInClientId` returns
  `undefined` rather than throwing when unset, and the sign-in page simply omits the
  Google button in that case. Magic link and password sign-in must keep working in any
  environment where the Cloud Console/Supabase Dashboard setup hasn't happened yet
  (fresh preview deploys, local dev before setup).
- **`supabase/config.toml` is untouched.** It deliberately carries no
  `[auth.external.google]` section (see `PROGRESS.md`) — Google auth config lives only
  in the Supabase Dashboard, not something `supabase config push` should touch.

## Consequences

- Google's sign-in prompt now shows this app's own domain, not the Supabase project
  URL — the whole point.
- **The Cloud Console consent screen's publishing status no longer gates sign-in.**
  GSI `signInWithIdToken` is pure OpenID Connect authentication (`openid`/`email`/
  `profile`, no access token, no extra scopes) — it never hits the OAuth
  authorization/consent path where "Testing" mode limits access to listed test users
  and where the "unverified app" interstitial appears. Any Google account can sign in
  regardless of whether that screen is Testing or In production. The Testing-mode
  restriction still applies to the *Gmail-sync* client (`gmail.readonly`, a Restricted
  Scope — see ADR-0009), which is a separate OAuth client and unaffected by this ADR.
- The old redirect-based `signInWithGoogle` action and its `?error=google_unavailable`
  failure path are gone from that code path, replaced by `signInWithGoogleIdToken`
  (same error copy, reused, since the client component's failure path routes to the
  same query param).
- No e2e coverage: there wasn't any for the old redirect flow either (real Google
  sign-in isn't mockable the way Gmail sync's OAuth is). Verification is manual,
  against the hosted Supabase project — `supabase start` can't exercise Google sign-in
  locally regardless of this change.

# Instagram feed setup

The "On Instagram" grid on the homepage and Contact page pulls the latest posts
from **@juicebrospickleball** via the Instagram API with Instagram Login. Until
a token is in place the section is simply hidden, so everything below can wait
until the account login is available.

Design rationale for the token storage: [docs/adr/0003-instagram-token-in-edge-config.md](adr/0003-instagram-token-in-edge-config.md).

## What you need

- The **@juicebrospickleball** login, with the account set to **Business** or
  **Creator** (Instagram app → Settings → Account type → Switch — it's free and
  reversible).
- Access to the **"Juice Bros Pickleball"** Meta app
  (developers.facebook.com → Apps).
- Access to the project on Vercel.

## 1. Configure the Meta app (once)

1. In the Meta app dashboard, add the **Instagram** product → **API setup with
   Instagram login**.
2. Under **Business login settings**:
   - Add an **OAuth redirect URI**. Anything you can open in a browser works;
     `https://juicebrospickleball.com/instagram-oauth` is fine even though no
     route lives there — you only need to read the `?code=` it lands with.
   - Note the **Instagram app ID** and **Instagram app secret**.
3. Under **Roles → Roles**, add the @juicebrospickleball account as an
   **Instagram Tester**, then accept the invite from that account
   (Instagram app → Settings → Apps and websites → Tester invites).

## 2. Mint the first long-lived token

In a shell with these set (see `.env.example`):

```
INSTAGRAM_APP_ID=...
INSTAGRAM_APP_SECRET=...
INSTAGRAM_OAUTH_REDIRECT_URI=...   # exactly what you registered above
```

```
node scripts/instagram-token.mts            # prints the login URL
# open it, approve as @juicebrospickleball, copy the ?code= from the redirect
node scripts/instagram-token.mts "<code>"   # prints the long-lived token + JSON
```

The token is valid for ~60 days. The script also prints the exact JSON for the
next step.

## 3. Store it

### Production (Vercel)

1. **Storage → Edge Config** → create a store (e.g. `juice-bros-config`) and
   connect it to the project. This adds `EDGE_CONFIG` to the project's env vars.
2. In that store, add an item:
   - key: `instagram_token`
   - value: the JSON the script printed —
     `{"token":"...","expiresAt":1699999999}`
3. Add the rest of the project's env vars (Production):
   - `EDGE_CONFIG_ID` — the `ecfg_...` id from the store's URL
   - `VERCEL_API_TOKEN` — vercel.com/account/tokens, scoped to this project
   - `VERCEL_TEAM_ID` — only if the project is under a team
   - `CRON_SECRET` — any long random string (Vercel Cron sends it automatically)
   - `INSTAGRAM_ALERT_EMAIL` — optional; where refresh failures are emailed
4. Redeploy. Within an hour (ISR) the feed appears.

### Local dev

Just put the token in `.env`:

```
INSTAGRAM_ACCESS_TOKEN=<the long-lived token>
```

No Edge Config needed — `getInstagramToken()` falls back to this.

## 4. Ongoing

`/api/cron/refresh-instagram-token` runs daily (`vercel.json`). Once the stored
token is within 14 days of expiring, the next run exchanges it for a fresh
60-day token and writes it back to Edge Config. Nothing to do.

If a refresh ever fails (token revoked, account type changed back, app
credentials rotated), it emails `INSTAGRAM_ALERT_EMAIL` / `CONTACT_TO_EMAIL`.
Recovery is just steps 2–3 again.

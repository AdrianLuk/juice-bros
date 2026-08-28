# The Instagram feed's token lives in Vercel Edge Config, not Supabase

The "On Instagram" grid (homepage + Contact page) reads from the Instagram API
with Instagram Login. Its long-lived access token expires every 60 days;
`refresh_access_token` resets that to another 60, and a daily Vercel Cron
(`/api/cron/refresh-instagram-token`) does the rotation. That means the token
has to be **readable by server components on every render** and **writable by
the cron at runtime** — and a plain environment variable is neither: Vercel
injects env vars at build time, so a running deployment never picks up a value
the cron changed.

Supabase was the obvious alternative — it's already in the repo and a one-row
`app_secrets` table would do it. Rejected: `CONTEXT-MAP.md` and `PRODUCT.md`
scope Supabase strictly to Booking Buddy's routes, and the marketing/podcast
pages (which now includes this feed) stay backend-free. Putting a marketing-side
secret in Supabase erodes that line for no real gain.

**Decision:** store the token in a Vercel Edge Config store, as
`{ token, expiresAt }` under the key `instagram_token`. Server components read
it through `@vercel/edge-config` (replicated, sub-millisecond reads); the cron
writes the rotated value back via the Vercel REST API. Local dev has no Edge
Config, so `getInstagramToken()` falls back to an `INSTAGRAM_ACCESS_TOKEN` env
var — a blank token there just hides the section.

**Trade-off accepted:** one more managed store to provision and one more place a
secret lives (plus a `VERCEL_API_TOKEN` for the write path), in exchange for
keeping the marketing surface off Supabase and off any request-time database.
Edge Config's write limits are far above a token that rotates roughly every 45
days. If a future feature needs per-user Instagram data this wouldn't fit — but
that would be a different feature with its own datastore decision.

# Magic-link email delivery (hosted Supabase)

Human-only Supabase Dashboard steps for the "Email me a sign-in link" option on
`/booking-buddy/sign-in`. Sibling of [google-sign-in-setup.md](google-sign-in-setup.md) —
where that covers "Continue with Google", this covers the magic-link path.

Magic link calls `supabase.auth.signInWithOtp` (`src/lib/booking-buddy/actions/auth.ts`),
which hands the email to GoTrue on the hosted project. GoTrue then sends it one of two
ways, and that choice is the whole subject of this doc.

## Symptom this doc fixes

The sign-in form shows a rate-limit error under the email field — *"For security
purposes, you can only request this after N seconds"* or *"email rate limit
exceeded"*. `signInWithMagicLink` returns Supabase's message verbatim, so whatever
GoTrue says is what the user sees.

That message means the request reached GoTrue fine and was throttled by the
**email send rate limit**, not that the address or the key is wrong.

## Why the built-in sender is not enough

With no custom SMTP configured, GoTrue uses Supabase's built-in email service. It
is deliberately crippled for production use:

- roughly **2 emails per hour**, project-wide (not per user), and
- it only delivers to addresses that are members of the Supabase org.

So the second or third person to try a magic link in an hour gets the rate-limit
error, and non-member addresses never receive anything at all. The per-hour
number **cannot be raised** while the built-in sender is in use — custom SMTP is a
prerequisite for touching it.

## Fix: custom SMTP via Resend

Reuse the domain already verified in Resend for the contact form and Booking
Buddy reminders (`RESEND_API_KEY` / `REMINDER_FROM_EMAIL` in `.env.example`) — no
new domain or account needed.

Dashboard → **Authentication → Emails → SMTP Settings** (older dashboards:
**Project Settings → Authentication → SMTP Settings**). Enable "Custom SMTP" and
set:

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` (TLS; `587` also works) |
| Username | `resend` |
| Password | a Resend API key (create a dedicated one in the Resend dashboard) |
| Sender email | an address on the verified domain, e.g. `noreply@juicebrospickleball.com` |
| Sender name | `Juice Bros Pickleball` |

The sender address must be on a domain that is **verified in Resend**, or Resend
rejects the send and GoTrue surfaces a generic "error sending magic link email"
on the form.

## Raising the rate limit

Once custom SMTP is on: Dashboard → **Authentication → Rate Limits** → *"Rate
limit for sending emails"*. Raise it from the default `2` to something that fits
real usage (30–100/hour is reasonable for Booking Buddy's size). Resend's own
free-tier cap (100/day at time of writing) is the real ceiling — keep the GoTrue
number under it.

This is the knob to reach for first if magic link starts failing again with a
rate-limit message.

## Related, and easy to confuse

- **Redirect allow-list.** A magic link that sends fine but lands on `/` with a
  bare `?code=` is the Site URL / redirect allow-list problem, not this one — see
  `PROGRESS.md` → "Auth URL configuration on the hosted project". The callback
  target (`/booking-buddy/auth/callback`) must match an allow-list entry or
  GoTrue silently falls back to Site URL.
- **Local dev needs none of this.** `.env` points at the local Docker stack,
  which captures every outbound email in Mailpit at <http://127.0.0.1:54324>.
  `config.toml`'s `[auth.rate_limit] email_sent = 2` applies there too, but the
  local mailbox is instant and unmetered in practice.
- **Not in `config.toml`.** Hosted auth config is dashboard-only on this project
  — `config.toml` carries no `[auth.external.google]` section, so a
  `supabase config push` would risk disabling providers. SMTP settings stay in
  the dashboard for the same reason (PROGRESS.md, same section as above).

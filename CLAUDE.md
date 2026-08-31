@AGENTS.md

# Juice Bros Pickleball - Product Context

## What this is
Juice Bros Pickleball is a pickleball podcast (already live on YouTube + Spotify) expanding into a
full brand platform: podcast site → blog/content hub → web apps (pickleball tools) →
Shopify merch store → possibly mobile apps later. Treat it as a startup-style product
ecosystem under one brand, not a single static website. Start simple, evolve into a
multi-product platform - don't build the monorepo/apps/Supabase structure before it's needed.

Team: solo full-stack dev (frontend-leaning) + a friend (Daven) doing graphic
design/Figma. Design comes from Daven; implementation is done here.

## Locked tech stack
- Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui
- Hosting: Vercel. Version control: GitHub.
- No backend / no Supabase for the MVP marketing + podcast site.
- Data fetching default: Next.js server components for simple content (marketing/podcast
  pages). That trigger is now live for **Booking Buddy**: it uses TanStack Query for its
  interactive routes (friend groups, Slot Responses, live-feeling state), paired with
  server components for initial data fetch + hydration - not a client-only fetch. Other
  simple content stays on server components; don't reach for Query outside Booking Buddy
  without the same trigger (interactive state / client syncing / API-heavy).

## Site structure (target, beyond current MVP)
```
/
  Home
  Podcast
    Episodes
    Clips
    Guests
  Apps
    Rating Calculator
    Tournament Tracker
    Drill Generator
    Booking Buddy
  Store
  Blog
  About
  Contact
```

## Future repo structure (only once apps/mobile start - not yet)
```
juicebros/
  apps/
    web (Next.js site)
    mobile (Expo app later)
    admin (optional later)
  packages/
    ui
    utils
    types
    config
    api-client
```
Tooling for that stage: Turborepo + pnpm. Don't introduce this until there's an actual
second app to justify it.

## Shopify (merch) strategy
- Phase 1 (do first): `/store` just redirects to the Shopify storefront. Lowest effort.
- Phase 2 (later): headless Shopify via the Storefront API for a fully integrated
  in-site store. Only build this once Phase 1 has validated demand.

## When to add Supabase
Supabase is now in scope: **Booking Buddy** (friend-group scheduling app, under `Apps`)
needs user accounts/auth, friend connections, and saved availability/slot data, so wire
it up for that app now. It lives as a route/section in this repo (not a separate
monorepo app) - Supabase is scoped to Booking Buddy's routes. The static marketing/
podcast pages (Home, Podcast, Gear, About, Contact) still need no backend - do not
pull them onto Supabase or add auth to them.

## Mobile (later stage)
Expo, sharing code with web via the future monorepo. Build after the web apps are
validated - not part of MVP.

## Build philosophy
- Ship fast, but keep structure clean; avoid overengineering early.
- No backend/no Supabase/no monorepo until a specific feature requires it.
- Optimize for clarity, maintainability, and incremental growth over premature
  architecture.

## MVP scope (current phase)
Marketing + podcast hub. Must-have pages: Home, Podcast (episodes embedded from
YouTube/Spotify), Gear, About, Contact. Nice-to-have: basic blog, newsletter signup
(Beehiiv is the pick - free tier, creator-focused, easy embed; place signup in the
footer on all pages, on the Home page CTA, and optionally a dedicated `/newsletter`
page), simple analytics (already wired via Vercel Analytics/Speed Insights).

Page-by-page intent:
- **Home**: explain Juice Bros Pickleball in 5 seconds - hero (brand/vibe/logo), latest episode
  embed, CTA to Podcast page, CTA to newsletter, social links.
- **Podcast**: central content hub - embedded YouTube playlist/latest videos, Spotify
  embed, episode list (manual/hardcoded is fine at this stage), optional featured episode.
- **Gear**: monetizable + SEO + credibility. Sections: Paddles (current + backup/experiment),
  Shoes, Accessories (grips/bags/balls), each with a "why we use it" blurb. No affiliate
  links yet - that's a later upgrade, along with comparison tables and skill-level guides.
- **About**: who we are, why Juice Bros Pickleball exists, mission, photo of both hosts.
- **Contact**: simple form or email link, social links.

## After MVP (do not start early)
Phase 2: Supabase (only if apps/users need it), blog system, analytics dashboard.
Phase 3: pickleball web apps, affiliate gear monetization, Shopify merch store.
Phase 4: mobile app (Expo), community features.

## Product framing
This is not "a website" - it's a sports media + tools + merch ecosystem. The MVP goal
is to get a real brand site live fast, then expand vertically from there.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (github.com/AdrianLuk/juice-bros), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context layout: root `CONTEXT-MAP.md` indexes per-context `CONTEXT.md` files (currently just `booking-buddy/`). See `docs/agents/domain.md`.

## Git Workflow & Worktrees
- Always perform code changes, feature development, or refactoring in an isolated Git worktree rather than the main working directory.
- Use `.claude/worktrees/` for task isolation or spin up subagents with worktree isolation enabled.
- Never commit directly or make destructive changes to the main checkout branch.

